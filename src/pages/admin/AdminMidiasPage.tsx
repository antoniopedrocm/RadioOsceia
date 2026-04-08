import { useCallback, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { PageHeader } from '@/components/admin/PageHeader';
import { EmptyState, LoadingState } from '@/components/shared/LoadableMessage';
import { useApiResource } from '@/hooks/useApiResource';
import { api, getApiErrorMessage } from '@/lib/api';
import { MediaFormModal } from '@/components/admin/MediaFormModal';
import type { AdminMediaRecord, MediaStatus, MediaUpdatePayload, MediaUpsertPayload } from '@/types/media';

interface ApiProgram {
  id: string;
  title: string;
}

function parseDurationLabel(durationSeconds?: number | null) {
  if (!durationSeconds || durationSeconds < 0) {
    return '-';
  }

  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.floor((durationSeconds % 3600) / 60);
  const seconds = durationSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getMediaTypeLabel(mediaType: string) {
  const map: Record<string, string> = {
    PROGRAMA: 'Programa',
    VINHETA: 'Vinheta',
    INTRODUCAO: 'Introdução',
    ENCERRAMENTO: 'Encerramento',
    CHAMADA: 'Chamada',
    AUDIO: 'Áudio',
    VIDEO: 'Vídeo'
  };

  return map[mediaType] ?? mediaType;
}

function getSourceLabel(media: AdminMediaRecord) {
  const source = media.sourceType.toUpperCase();
  if (source === 'YOUTUBE') {
    return 'YouTube';
  }

  if (source === 'EXTERNAL_PLACEHOLDER') {
    return 'Arquivo externo';
  }

  return 'Arquivo local';
}

function getStatusLabel(status: MediaStatus) {
  if (status === 'ACTIVE') return 'Ativo';
  if (status === 'DRAFT') return 'Rascunho';
  return 'Inativo';
}

export function AdminMidiasPage() {
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view' | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<AdminMediaRecord | null>(null);
  const [loadingActionById, setLoadingActionById] = useState<string | null>(null);

  const programsLoader = useCallback((signal: AbortSignal) => api.get<ApiProgram[]>('/programs', { signal }), []);
  const programsState = useApiResource(programsLoader, {
    initialData: [] as ApiProgram[],
    fallbackMessage: 'Não foi possível carregar os programas vinculáveis.'
  });

  const mediaLoader = useCallback((signal: AbortSignal) => api.get<AdminMediaRecord[]>('/media', { signal }), []);
  const mediaState = useApiResource(mediaLoader, {
    initialData: [] as AdminMediaRecord[],
    fallbackMessage: 'Não foi possível carregar a listagem de mídias.'
  });

  const isLoading = programsState.isLoading || mediaState.isLoading;
  const errorMessage = programsState.errorMessage || mediaState.errorMessage;

  const tableRows = useMemo(() => mediaState.data.map((media) => ({
    ...media,
    type: getMediaTypeLabel(media.mediaType),
    source: getSourceLabel(media),
    duration: parseDurationLabel(media.durationSeconds),
    linkedProgram: media.program?.title ?? 'Sem programa',
    statusLabel: getStatusLabel(media.status)
  })), [mediaState.data]);

  const showFeedback = (tone: 'success' | 'error', message: string) => {
    setFeedback({ tone, message });
    window.setTimeout(() => setFeedback(null), 4500);
  };

  const handleCreateMedia = async (payload: MediaUpsertPayload) => {
    if (payload.source === 'UPLOAD') {
      throw new Error('Upload local ainda não está habilitado nesta fase Firebase. Use YouTube ou arquivo existente.');
    }

    if (payload.source === 'YOUTUBE') {
      await api.post('/media/youtube', {
        title: payload.title,
        mediaType: payload.mediaType,
        programId: payload.programId,
        youtubeUrl: payload.youtubeUrl,
        durationSeconds: payload.durationSeconds,
        thumbnailUrl: payload.thumbnailUrl,
        status: payload.status,
        notes: payload.notes
      });
    }

    if (payload.source === 'EXISTING_FILE') {
      await api.post('/media/local-register', {
        title: payload.title,
        mediaType: payload.mediaType,
        filePath: payload.filePath,
        publicUrl: payload.publicUrl,
        fileName: payload.fileName,
        durationSeconds: payload.durationSeconds,
        programId: payload.programId,
        status: payload.status,
        notes: payload.notes
      });
    }

    await mediaState.reload();
    showFeedback('success', `Mídia "${payload.title}" cadastrada com sucesso.`);
  };

  const handleUpdateMedia = async (payload: MediaUpdatePayload) => {
    await api.put(`/media/${payload.id}`, {
      title: payload.title,
      mediaType: payload.mediaType,
      programId: payload.programId,
      durationSeconds: payload.durationSeconds,
      status: payload.status,
      notes: payload.notes,
      youtubeUrl: payload.youtubeUrl,
      thumbnailUrl: payload.thumbnailUrl,
      filePath: payload.filePath,
      publicUrl: payload.publicUrl,
      fileName: payload.fileName
    });

    await mediaState.reload();
    showFeedback('success', `Mídia "${payload.title}" atualizada com sucesso.`);
  };

  const openView = async (mediaId: string) => {
    try {
      const details = await api.get<AdminMediaRecord>(`/media/${mediaId}`);
      setSelectedMedia(details);
      setModalMode('view');
    } catch (error) {
      showFeedback('error', getApiErrorMessage(error, 'Não foi possível carregar detalhes da mídia.'));
    }
  };

  const openEdit = async (mediaId: string) => {
    try {
      const details = await api.get<AdminMediaRecord>(`/media/${mediaId}`);
      setSelectedMedia(details);
      setModalMode('edit');
    } catch (error) {
      showFeedback('error', getApiErrorMessage(error, 'Não foi possível carregar mídia para edição.'));
    }
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedMedia(null);
  };

  const handleStatusChange = async (media: AdminMediaRecord, nextStatus: MediaStatus) => {
    const actionLabel = nextStatus === 'ACTIVE' ? 'ativar' : nextStatus === 'INACTIVE' ? 'arquivar' : 'mover para rascunho';
    const confirmed = window.confirm(`Deseja ${actionLabel} a mídia "${media.title}"?`);
    if (!confirmed) {
      return;
    }

    try {
      setLoadingActionById(media.id);
      await api.post(`/media/${media.id}/status`, { status: nextStatus });
      await mediaState.reload();
      showFeedback('success', `Status da mídia "${media.title}" atualizado para ${getStatusLabel(nextStatus)}.`);
    } catch (error) {
      showFeedback('error', getApiErrorMessage(error, 'Não foi possível atualizar o status da mídia.'));
    } finally {
      setLoadingActionById(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mídias"
        description="Liste, visualize, edite e cadastre mídias da rádio."
        action="Nova Mídia"
        onActionClick={() => setModalMode('create')}
      />

      {feedback ? (
        <div className={`rounded-lg border px-4 py-3 text-sm ${feedback.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {feedback.message}
        </div>
      ) : null}

      {isLoading ? <LoadingState title="Carregando mídias" description="Buscando programas e mídias cadastradas." /> : null}

      {!isLoading && errorMessage ? (
        <EmptyState
          title="Não foi possível carregar as mídias"
          description={getApiErrorMessage(mediaState.error ?? programsState.error ?? errorMessage)}
          tone="warning"
        />
      ) : null}

      {!isLoading && !errorMessage ? (
        <div className="overflow-auto rounded-xl border bg-card">
          <Table>
            <Thead>
              <Tr>
                <Th>Título</Th>
                <Th>Tipo</Th>
                <Th>Origem</Th>
                <Th>Duração</Th>
                <Th>Programa vinculado</Th>
                <Th>Status</Th>
                <Th>Ações</Th>
              </Tr>
            </Thead>
            <Tbody>
              {tableRows.length === 0 ? (
                <Tr>
                  <Td className="py-8 text-sm text-slate-500">Nenhuma mídia cadastrada.</Td>
                  <Td>-</Td>
                  <Td>-</Td>
                  <Td>-</Td>
                  <Td>-</Td>
                  <Td>-</Td>
                  <Td>-</Td>
                </Tr>
              ) : tableRows.map((row) => (
                <Tr key={row.id}>
                  <Td className="font-medium text-slate-900">{row.title}</Td>
                  <Td>{row.type}</Td>
                  <Td>{row.source}</Td>
                  <Td>{row.duration}</Td>
                  <Td>{row.linkedProgram}</Td>
                  <Td>
                    <Badge>{row.statusLabel}</Badge>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => openView(row.id)}>Visualizar</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => openEdit(row.id)}>Editar</Button>
                      {row.status === 'ACTIVE' ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => handleStatusChange(row, 'INACTIVE')} disabled={loadingActionById === row.id}>
                          Arquivar
                        </Button>
                      ) : (
                        <Button type="button" size="sm" onClick={() => handleStatusChange(row, 'ACTIVE')} disabled={loadingActionById === row.id}>
                          Ativar
                        </Button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      ) : null}

      <MediaFormModal
        isOpen={modalMode === 'create'}
        mode="create"
        programs={programsState.data.map((program) => ({ id: program.id, title: program.title }))}
        onClose={closeModal}
        onCreate={handleCreateMedia}
      />

      <MediaFormModal
        isOpen={modalMode === 'edit'}
        mode="edit"
        programs={programsState.data.map((program) => ({ id: program.id, title: program.title }))}
        initialMedia={selectedMedia}
        onClose={closeModal}
        onUpdate={handleUpdateMedia}
      />

      <MediaFormModal
        isOpen={modalMode === 'view'}
        mode="view"
        programs={programsState.data.map((program) => ({ id: program.id, title: program.title }))}
        initialMedia={selectedMedia}
        onClose={closeModal}
      />
    </div>
  );
}
