import { useCallback, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { PageHeader } from '@/components/admin/PageHeader';
import { EmptyState, LoadingState } from '@/components/shared/LoadableMessage';
import { useApiResource } from '@/hooks/useApiResource';
import { api, getApiErrorMessage } from '@/lib/api';
import { MediaCreateModal, type MediaCreatePayload, type MediaStatus } from '@/components/admin/MediaCreateModal';

interface ApiProgram {
  id: string;
  title: string;
}

interface ApiMedia {
  id: string;
  title: string;
  mediaType: string;
  sourceType: 'YOUTUBE' | 'LOCAL' | 'EXTERNAL_PLACEHOLDER' | string;
  durationSeconds: number | null;
  program?: { title: string } | null;
  isActive: boolean;
  notes?: string | null;
  youtubeUrl?: string | null;
  fileName?: string | null;
}

const STATUS_NOTE_PREFIX = '[status:';

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

function getSourceLabel(media: ApiMedia) {
  const source = media.sourceType.toUpperCase();
  if (source === 'YOUTUBE') {
    return 'YouTube';
  }

  if (source === 'EXTERNAL_PLACEHOLDER') {
    return 'Arquivo externo';
  }

  const fileName = media.fileName?.toLowerCase() ?? '';
  if (fileName.endsWith('.mp3') || fileName.endsWith('.wav') || fileName.endsWith('.ogg')) {
    return 'Áudio local';
  }

  return 'Arquivo local';
}

function getStatusFromMedia(media: ApiMedia): MediaStatus {
  if (media.notes?.includes(`${STATUS_NOTE_PREFIX}DRAFT]`)) {
    return 'DRAFT';
  }

  return media.isActive ? 'ACTIVE' : 'INACTIVE';
}

function getStatusLabel(status: MediaStatus) {
  if (status === 'ACTIVE') return 'Ativo';
  if (status === 'DRAFT') return 'Rascunho';
  return 'Inativo';
}

function debugLog(...args: Parameters<typeof console.debug>) {
  if (import.meta.env.DEV) {
    console.debug(...args);
  }
}

export function AdminMidiasPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const programsLoader = useCallback((signal: AbortSignal) => api.get<ApiProgram[]>('/programs', { signal }), []);
  const programsState = useApiResource(programsLoader, {
    initialData: [] as ApiProgram[],
    fallbackMessage: 'Não foi possível carregar os programas vinculáveis.'
  });

  const mediaLoader = useCallback((signal: AbortSignal) => api.get<ApiMedia[]>('/media', { signal }), []);
  const mediaState = useApiResource(mediaLoader, {
    initialData: [] as ApiMedia[],
    fallbackMessage: 'Não foi possível carregar a listagem de mídias.'
  });

  const isLoading = programsState.isLoading || mediaState.isLoading;
  const errorMessage = programsState.errorMessage || mediaState.errorMessage;

  const tableRows = useMemo(() => mediaState.data.map((media) => ({
    id: media.id,
    title: media.title,
    type: getMediaTypeLabel(media.mediaType),
    source: getSourceLabel(media),
    duration: parseDurationLabel(media.durationSeconds),
    linkedProgram: media.program?.title ?? 'Sem programa',
    status: getStatusLabel(getStatusFromMedia(media))
  })), [mediaState.data]);

  const handleCreateMedia = async (payload: MediaCreatePayload) => {
    debugLog('[AdminMidiasPage] createMedia:start', payload);

    const notesWithStatus = [
      `[status:${payload.status}]`,
      payload.notes?.trim() || ''
    ].filter(Boolean).join('\n');

    if (payload.source === 'YOUTUBE') {
      debugLog('[AdminMidiasPage] createMedia:request', { endpoint: '/media/youtube' });
      await api.post('/media/youtube', {
        title: payload.title,
        mediaType: payload.mediaType,
        programId: payload.programId,
        youtubeUrl: payload.youtubeUrl,
        durationSeconds: payload.durationSeconds,
        thumbnailUrl: payload.thumbnailUrl,
        status: payload.status,
        notes: notesWithStatus
      });
    }

    if (payload.source === 'UPLOAD') {
      throw new Error('Upload local ainda não está habilitado nesta fase Firebase. Use YouTube por enquanto.');
    }

    if (payload.source === 'EXISTING_FILE') {
      debugLog('[AdminMidiasPage] createMedia:request', { endpoint: '/media/local-register' });
      await api.post('/media/local-register', {
        title: payload.title,
        mediaType: payload.mediaType,
        filePath: payload.filePath,
        publicUrl: payload.publicUrl,
        durationSeconds: payload.durationSeconds,
        programId: payload.programId,
        status: payload.status,
        notes: notesWithStatus
      });
    }

    debugLog('[AdminMidiasPage] createMedia:success', { title: payload.title });
    mediaState.reload();
    setFeedback(`Mídia "${payload.title}" cadastrada com sucesso.`);
    window.setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mídias"
        description="Liste e cadastre mídias da rádio."
        action="Nova Mídia"
        onActionClick={() => setIsCreateOpen(true)}
      />

      {feedback ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {feedback}
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
                </Tr>
              ) : tableRows.map((row) => (
                <Tr key={row.id}>
                  <Td className="font-medium text-slate-900">{row.title}</Td>
                  <Td>{row.type}</Td>
                  <Td>{row.source}</Td>
                  <Td>{row.duration}</Td>
                  <Td>{row.linkedProgram}</Td>
                  <Td>
                    <Badge>{row.status}</Badge>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      ) : null}

      <MediaCreateModal
        isOpen={isCreateOpen}
        programs={programsState.data.map((program) => ({ id: program.id, title: program.title }))}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateMedia}
      />
    </div>
  );
}
