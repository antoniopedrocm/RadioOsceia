import { useEffect, useMemo, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, getApiErrorMessage } from '@/lib/api';
import type { AdminMediaRecord, MediaSource, MediaStatus, MediaUpdatePayload, MediaUpsertPayload } from '@/types/media';

export interface ProgramOption {
  id: string;
  title: string;
}

interface MediaFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit' | 'view';
  programs: ProgramOption[];
  initialMedia?: AdminMediaRecord | null;
  onClose: () => void;
  onCreate?: (payload: MediaUpsertPayload) => Promise<void>;
  onUpdate?: (payload: MediaUpdatePayload) => Promise<void>;
}

interface FormState {
  title: string;
  mediaType: string;
  programId: string;
  duration: string;
  status: MediaStatus;
  notes: string;
  source: MediaSource;
  youtubeUrl: string;
  thumbnailUrl: string;
  filePath: string;
  publicUrl: string;
  fileName: string;
  uploadFile: File | null;
}

const MEDIA_TYPE_OPTIONS = [
  { label: 'Programa', value: 'PROGRAMA' },
  { label: 'Vinheta', value: 'VINHETA' },
  { label: 'Introdução', value: 'INTRODUCAO' },
  { label: 'Encerramento', value: 'ENCERRAMENTO' },
  { label: 'Chamada', value: 'CHAMADA' },
  { label: 'Áudio', value: 'AUDIO' },
  { label: 'Vídeo', value: 'VIDEO' }
];

const INITIAL_STATE: FormState = {
  title: '',
  mediaType: '',
  programId: '',
  duration: '',
  status: 'ACTIVE',
  notes: '',
  source: 'YOUTUBE',
  youtubeUrl: '',
  thumbnailUrl: '',
  filePath: '',
  publicUrl: '',
  fileName: '',
  uploadFile: null
};

function parseFriendlyDuration(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  const parts = trimmed.split(':');
  if (parts.length !== 2 && parts.length !== 3) {
    return null;
  }

  const numbers = parts.map((part) => Number(part));
  if (numbers.some((part) => !Number.isInteger(part) || part < 0)) {
    return null;
  }

  if (parts.length === 2) {
    const [minutes, seconds] = numbers;
    if (seconds >= 60) {
      return null;
    }
    return minutes * 60 + seconds;
  }

  const [hours, minutes, seconds] = numbers;
  if (minutes >= 60 || seconds >= 60) {
    return null;
  }

  return (hours * 3600) + (minutes * 60) + seconds;
}

function formatDurationValue(durationSeconds?: number | null) {
  if (!durationSeconds || durationSeconds <= 0) {
    return '';
  }

  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.floor((durationSeconds % 3600) / 60);
  const seconds = durationSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function isYoutubeUrl(value: string) {
  try {
    const parsed = new URL(value);
    return ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be'].includes(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function getSourceFromMedia(media?: AdminMediaRecord | null): MediaSource {
  if (!media) return 'YOUTUBE';
  return media.sourceType === 'YOUTUBE' ? 'YOUTUBE' : 'EXISTING_FILE';
}

function buildInitialState(mode: 'create' | 'edit' | 'view', media?: AdminMediaRecord | null): FormState {
  if (mode === 'create' || !media) {
    return INITIAL_STATE;
  }

  return {
    title: media.title,
    mediaType: media.mediaType,
    programId: media.programId ?? '',
    duration: formatDurationValue(media.durationSeconds),
    status: media.status,
    notes: media.notes ?? '',
    source: getSourceFromMedia(media),
    youtubeUrl: media.youtubeUrl ?? '',
    thumbnailUrl: media.thumbnailUrl ?? '',
    filePath: media.filePath ?? '',
    publicUrl: media.publicUrl ?? '',
    fileName: media.fileName ?? '',
    uploadFile: null
  };
}

function getStatusLabel(status: MediaStatus) {
  if (status === 'ACTIVE') return 'Ativo';
  if (status === 'DRAFT') return 'Rascunho';
  return 'Inativo';
}

function getModalTitle(mode: 'create' | 'edit' | 'view') {
  if (mode === 'create') return 'Nova Mídia';
  if (mode === 'edit') return 'Editar Mídia';
  return 'Detalhes da Mídia';
}

function getModalDescription(mode: 'create' | 'edit' | 'view') {
  if (mode === 'view') return 'Visualize os dados cadastrados para esta mídia.';
  return 'Cadastre e gerencie mídias YouTube e arquivo existente. Upload local segue indisponível nesta fase.';
}

export function MediaFormModal({ isOpen, mode, programs, initialMedia, onClose, onCreate, onUpdate }: MediaFormModalProps) {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const readOnly = mode === 'view';
  const selectedUploadType = useMemo(() => form.uploadFile?.type || 'Não detectado', [form.uploadFile]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setForm(buildInitialState(mode, initialMedia));
    setErrors({});
    setSubmitError(null);
    setIsSubmitting(false);
  }, [isOpen, mode, initialMedia]);

  if (!isOpen) {
    return null;
  }

  const setField = <TKey extends keyof FormState>(key: TKey, value: FormState[TKey]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
    setSubmitError(null);
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!form.title.trim()) nextErrors.title = 'Título é obrigatório.';
    if (!form.mediaType) nextErrors.mediaType = 'Selecione o tipo da mídia.';
    if (!form.source) nextErrors.source = 'Selecione uma origem da mídia.';

    const durationSeconds = parseFriendlyDuration(form.duration);
    if (durationSeconds === null || durationSeconds <= 0) {
      nextErrors.duration = 'Use mm:ss ou hh:mm:ss (ex.: 03:25 ou 01:03:25).';
    }

    if (form.source === 'YOUTUBE' && !form.youtubeUrl.trim()) {
      nextErrors.youtubeUrl = 'Informe a URL do YouTube.';
    } else if (form.source === 'YOUTUBE' && !isYoutubeUrl(form.youtubeUrl.trim())) {
      nextErrors.youtubeUrl = 'Informe uma URL válida do YouTube.';
    }

    if (form.source === 'UPLOAD') {
      nextErrors.uploadFile = 'Upload local ainda não está disponível nesta fase.';
    }

    if (form.source === 'EXISTING_FILE' && !form.filePath.trim()) {
      nextErrors.filePath = 'Informe o caminho do arquivo no repositório.';
    }

    return { nextErrors, durationSeconds: durationSeconds ?? 0 };
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (readOnly) {
      onClose();
      return;
    }

    const { nextErrors, durationSeconds } = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (mode === 'create') {
        if (!onCreate) {
          throw new Error('Fluxo de criação não disponível.');
        }

        if (form.source === 'UPLOAD') {
          throw new Error('Upload local ainda não está habilitado nesta fase Firebase. Use YouTube ou arquivo existente.');
        }

        const createPayload: MediaUpsertPayload = form.source === 'YOUTUBE'
          ? {
            source: 'YOUTUBE',
            title: form.title.trim(),
            mediaType: form.mediaType,
            programId: form.programId || null,
            durationSeconds,
            status: form.status,
            notes: form.notes.trim() || undefined,
            youtubeUrl: form.youtubeUrl.trim(),
            thumbnailUrl: form.thumbnailUrl.trim() || undefined
          }
          : {
            source: 'EXISTING_FILE',
            title: form.title.trim(),
            mediaType: form.mediaType,
            programId: form.programId || null,
            durationSeconds,
            status: form.status,
            notes: form.notes.trim() || undefined,
            filePath: form.filePath.trim(),
            publicUrl: form.publicUrl.trim() || undefined,
            fileName: form.fileName.trim() || undefined
          };

        await onCreate(createPayload);
      }

      if (mode === 'edit') {
        if (!onUpdate || !initialMedia) {
          throw new Error('Fluxo de edição não disponível.');
        }

        const updatePayload: MediaUpdatePayload = {
          id: initialMedia.id,
          title: form.title.trim(),
          mediaType: form.mediaType,
          programId: form.programId || null,
          durationSeconds,
          status: form.status,
          notes: form.notes.trim() || undefined,
          youtubeUrl: form.source === 'YOUTUBE' ? form.youtubeUrl.trim() : undefined,
          thumbnailUrl: form.source === 'YOUTUBE' ? form.thumbnailUrl.trim() || undefined : undefined,
          filePath: form.source === 'EXISTING_FILE' ? form.filePath.trim() : undefined,
          publicUrl: form.source === 'EXISTING_FILE' ? form.publicUrl.trim() || undefined : undefined,
          fileName: form.source === 'EXISTING_FILE' ? form.fileName.trim() || undefined : undefined
        };

        await onUpdate(updatePayload);
      }

      onClose();
    } catch (error) {
      const errorMessage = error instanceof ApiError
        ? getApiErrorMessage(error, 'Não foi possível salvar a mídia.')
        : error instanceof Error
          ? error.message
          : 'Não foi possível salvar a mídia.';
      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/55 p-4 md:p-8">
      <div className="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{getModalTitle(mode)}</h3>
            <p className="text-sm text-slate-500">{getModalDescription(mode)}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting} aria-label="Fechar modal">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form className="space-y-6 p-6" onSubmit={handleSubmit} noValidate>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="media-title">Título</Label>
              <Input id="media-title" name="title" value={form.title} onChange={(event) => setField('title', event.target.value)} disabled={readOnly} />
              {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
            </div>
            <div>
              <Label htmlFor="media-type">Tipo da mídia</Label>
              <Select id="media-type" name="mediaType" value={form.mediaType} onChange={(event) => setField('mediaType', event.target.value)} disabled={readOnly}>
                <option value="">Selecione</option>
                {MEDIA_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
              {errors.mediaType && <p className="mt-1 text-xs text-red-600">{errors.mediaType}</p>}
            </div>
            <div>
              <Label htmlFor="media-program">Programa vinculado</Label>
              <Select id="media-program" name="programId" value={form.programId} onChange={(event) => setField('programId', event.target.value)} disabled={readOnly}>
                <option value="">Nenhum programa</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>{program.title}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="media-duration">Duração (mm:ss ou hh:mm:ss)</Label>
              <Input id="media-duration" name="duration" value={form.duration} onChange={(event) => setField('duration', event.target.value)} disabled={readOnly} />
              {errors.duration && <p className="mt-1 text-xs text-red-600">{errors.duration}</p>}
            </div>
            <div>
              <Label htmlFor="media-status">Status</Label>
              <Select id="media-status" name="status" value={form.status} onChange={(event) => setField('status', event.target.value as MediaStatus)} disabled={readOnly}>
                <option value="ACTIVE">{getStatusLabel('ACTIVE')}</option>
                <option value="DRAFT">{getStatusLabel('DRAFT')}</option>
                <option value="INACTIVE">{getStatusLabel('INACTIVE')}</option>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="media-notes">Observações</Label>
            <Textarea id="media-notes" name="notes" value={form.notes} onChange={(event) => setField('notes', event.target.value)} disabled={readOnly} />
          </div>

          <div className="space-y-3">
            <Label>Origem da mídia</Label>
            <div className="grid gap-2 md:grid-cols-3">
              <Button type="button" variant={form.source === 'YOUTUBE' ? 'default' : 'outline'} onClick={() => setField('source', 'YOUTUBE')} disabled={readOnly || mode === 'edit'}>YouTube</Button>
              <Button type="button" variant={form.source === 'UPLOAD' ? 'default' : 'outline'} onClick={() => setField('source', 'UPLOAD')} disabled>Upload local</Button>
              <Button type="button" variant={form.source === 'EXISTING_FILE' ? 'default' : 'outline'} onClick={() => setField('source', 'EXISTING_FILE')} disabled={readOnly || mode === 'edit'}>Arquivo existente</Button>
            </div>
            {mode === 'create' ? <p className="text-xs text-slate-500">Upload local permanece indisponível nesta fase para evitar fluxo parcial.</p> : null}
            {errors.source && <p className="text-xs text-red-600">{errors.source}</p>}
          </div>

          {form.source === 'YOUTUBE' && (
            <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="youtube-url">URL do YouTube</Label>
                <Input id="youtube-url" name="youtubeUrl" value={form.youtubeUrl} onChange={(event) => setField('youtubeUrl', event.target.value)} disabled={readOnly} />
                {errors.youtubeUrl && <p className="mt-1 text-xs text-red-600">{errors.youtubeUrl}</p>}
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="youtube-thumb">Thumbnail (opcional)</Label>
                <Input id="youtube-thumb" name="thumbnailUrl" value={form.thumbnailUrl} onChange={(event) => setField('thumbnailUrl', event.target.value)} disabled={readOnly} />
              </div>
              {mode === 'view' && form.thumbnailUrl ? (
                <div className="md:col-span-2">
                  <img src={form.thumbnailUrl} alt={`Thumbnail de ${form.title}`} className="h-32 rounded-md border object-cover" />
                </div>
              ) : null}
            </div>
          )}

          {form.source === 'UPLOAD' && (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-800">Upload local ainda não disponível nesta fase. Use YouTube ou Arquivo existente.</p>
              <Label htmlFor="upload-file">Arquivo local</Label>
              <Input
                id="upload-file"
                name="uploadFile"
                type="file"
                disabled
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] ?? null;
                  setField('uploadFile', nextFile);
                }}
              />
              {form.uploadFile && (
                <div className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-600">
                  <p className="flex items-center gap-2 font-medium text-slate-800"><Upload className="h-4 w-4" /> {form.uploadFile.name}</p>
                  <p className="mt-1">Tipo detectado: {selectedUploadType}</p>
                </div>
              )}
            </div>
          )}

          {form.source === 'EXISTING_FILE' && (
            <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="existing-file-path">Caminho do arquivo</Label>
                <Input id="existing-file-path" name="filePath" value={form.filePath} onChange={(event) => setField('filePath', event.target.value)} disabled={readOnly} />
                {errors.filePath && <p className="mt-1 text-xs text-red-600">{errors.filePath}</p>}
              </div>
              <div>
                <Label htmlFor="existing-public-url">URL pública (opcional)</Label>
                <Input id="existing-public-url" name="publicUrl" value={form.publicUrl} onChange={(event) => setField('publicUrl', event.target.value)} disabled={readOnly} />
              </div>
              <div>
                <Label htmlFor="existing-file-name">Nome do arquivo (opcional)</Label>
                <Input id="existing-file-name" name="fileName" value={form.fileName} onChange={(event) => setField('fileName', event.target.value)} disabled={readOnly} />
              </div>
            </div>
          )}

          {submitError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</p>}

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>{readOnly ? 'Fechar' : 'Cancelar'}</Button>
            {!readOnly ? (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : mode === 'edit' ? 'Salvar alterações' : 'Salvar Mídia'}
              </Button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
