import { useMemo, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, getApiErrorMessage } from '@/lib/api';

export type MediaSource = 'YOUTUBE' | 'UPLOAD' | 'EXISTING_FILE';
export type MediaStatus = 'ACTIVE' | 'DRAFT' | 'INACTIVE';

export interface ProgramOption {
  id: string;
  title: string;
}

interface BasePayload {
  title: string;
  mediaType: string;
  programId: string | null;
  durationSeconds: number;
  status: MediaStatus;
  notes?: string;
}

export interface YoutubePayload extends BasePayload {
  source: 'YOUTUBE';
  youtubeUrl: string;
  thumbnailUrl?: string;
}

export interface UploadPayload extends BasePayload {
  source: 'UPLOAD';
  file: File;
}

export interface ExistingFilePayload extends BasePayload {
  source: 'EXISTING_FILE';
  filePath: string;
  publicUrl?: string;
  fileName?: string;
}

export type MediaCreatePayload = YoutubePayload | UploadPayload | ExistingFilePayload;

interface MediaCreateModalProps {
  isOpen: boolean;
  programs: ProgramOption[];
  onClose: () => void;
  onSubmit: (payload: MediaCreatePayload) => Promise<void>;
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

function isYoutubeUrl(value: string) {
  try {
    const parsed = new URL(value);
    return ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be'].includes(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function getStatusLabel(status: MediaStatus) {
  if (status === 'ACTIVE') return 'Ativo';
  if (status === 'DRAFT') return 'Rascunho';
  return 'Inativo';
}

export function MediaCreateModal({ isOpen, programs, onClose, onSubmit }: MediaCreateModalProps) {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedUploadType = useMemo(() => form.uploadFile?.type || 'Não detectado', [form.uploadFile]);

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

    if (form.source === 'UPLOAD' && !form.uploadFile) {
      nextErrors.uploadFile = 'Selecione um arquivo para upload.';
    }

    if (form.source === 'EXISTING_FILE' && !form.filePath.trim()) {
      nextErrors.filePath = 'Informe o caminho do arquivo no repositório.';
    }

    return { nextErrors, durationSeconds: durationSeconds ?? 0 };
  };

  const resetAndClose = () => {
    setForm(INITIAL_STATE);
    setErrors({});
    setSubmitError(null);
    setIsSubmitting(false);
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    console.debug('[MediaCreateModal] submit:start', { source: form.source, title: form.title });

    const { nextErrors, durationSeconds } = validate();
    if (Object.keys(nextErrors).length > 0) {
      console.debug('[MediaCreateModal] submit:validation_error', nextErrors);
      setErrors(nextErrors);
      return;
    }

    const basePayload: BasePayload = {
      title: form.title.trim(),
      mediaType: form.mediaType,
      programId: form.programId || null,
      durationSeconds,
      status: form.status,
      notes: form.notes.trim() || undefined
    };

    let payload: MediaCreatePayload;
    if (form.source === 'YOUTUBE') {
      payload = {
        ...basePayload,
        source: 'YOUTUBE',
        youtubeUrl: form.youtubeUrl.trim(),
        thumbnailUrl: form.thumbnailUrl.trim() || undefined
      };
    } else if (form.source === 'UPLOAD') {
      if (!form.uploadFile) {
        setErrors((current) => ({ ...current, uploadFile: 'Selecione um arquivo para upload.' }));
        return;
      }

      payload = {
        ...basePayload,
        source: 'UPLOAD',
        file: form.uploadFile
      };
    } else {
      payload = {
        ...basePayload,
        source: 'EXISTING_FILE',
        filePath: form.filePath.trim(),
        publicUrl: form.publicUrl.trim() || undefined,
        fileName: form.fileName.trim() || undefined
      };
    }

    setIsSubmitting(true);
    setSubmitError(null);
    console.debug('[MediaCreateModal] submit:payload', payload);

    try {
      await onSubmit(payload);
      console.debug('[MediaCreateModal] submit:success');
      resetAndClose();
    } catch (error) {
      console.error('[MediaCreateModal] submit:error', error);
      const errorMessage = error instanceof ApiError
        ? getApiErrorMessage(error, 'Não foi possível cadastrar a mídia.')
        : error instanceof Error
          ? error.message
          : 'Não foi possível cadastrar a mídia.';
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
            <h3 className="text-lg font-semibold text-slate-900">Nova Mídia</h3>
            <p className="text-sm text-slate-500">Cadastre YouTube, upload local ou arquivo já existente.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={resetAndClose} disabled={isSubmitting} aria-label="Fechar modal">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form className="space-y-6 p-6" onSubmit={handleSubmit} noValidate>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="media-title">Título</Label>
              <Input id="media-title" name="title" value={form.title} onChange={(event) => setField('title', event.target.value)} placeholder="Ex.: Entrevista especial" />
              {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
            </div>
            <div>
              <Label htmlFor="media-type">Tipo da mídia</Label>
              <Select id="media-type" name="mediaType" value={form.mediaType} onChange={(event) => setField('mediaType', event.target.value)}>
                <option value="">Selecione</option>
                {MEDIA_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
              {errors.mediaType && <p className="mt-1 text-xs text-red-600">{errors.mediaType}</p>}
            </div>
            <div>
              <Label htmlFor="media-program">Programa vinculado</Label>
              <Select id="media-program" name="programId" value={form.programId} onChange={(event) => setField('programId', event.target.value)}>
                <option value="">Nenhum programa</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>{program.title}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="media-duration">Duração (mm:ss ou hh:mm:ss)</Label>
              <Input id="media-duration" name="duration" value={form.duration} onChange={(event) => setField('duration', event.target.value)} placeholder="Ex.: 03:20 ou 01:02:05" />
              {errors.duration && <p className="mt-1 text-xs text-red-600">{errors.duration}</p>}
            </div>
            <div>
              <Label htmlFor="media-status">Status</Label>
              <Select id="media-status" name="status" value={form.status} onChange={(event) => setField('status', event.target.value as MediaStatus)}>
                <option value="ACTIVE">Ativo</option>
                <option value="DRAFT">Rascunho</option>
                <option value="INACTIVE">Inativo</option>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="media-notes">Observações</Label>
            <Textarea id="media-notes" name="notes" value={form.notes} onChange={(event) => setField('notes', event.target.value)} placeholder="Informações adicionais sobre a mídia" />
          </div>

          <div className="space-y-3">
            <Label>Origem da mídia</Label>
            <div className="grid gap-2 md:grid-cols-3">
              <Button type="button" variant={form.source === 'YOUTUBE' ? 'default' : 'outline'} onClick={() => setField('source', 'YOUTUBE')}>YouTube</Button>
              <Button type="button" variant={form.source === 'UPLOAD' ? 'default' : 'outline'} onClick={() => setField('source', 'UPLOAD')}>Upload local</Button>
              <Button type="button" variant={form.source === 'EXISTING_FILE' ? 'default' : 'outline'} onClick={() => setField('source', 'EXISTING_FILE')}>Arquivo existente</Button>
            </div>
            {errors.source && <p className="text-xs text-red-600">{errors.source}</p>}
          </div>

          {form.source === 'YOUTUBE' && (
            <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="youtube-url">URL do YouTube</Label>
                <Input id="youtube-url" name="youtubeUrl" value={form.youtubeUrl} onChange={(event) => setField('youtubeUrl', event.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
                {errors.youtubeUrl && <p className="mt-1 text-xs text-red-600">{errors.youtubeUrl}</p>}
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="youtube-thumb">Thumbnail (opcional)</Label>
                <Input id="youtube-thumb" name="thumbnailUrl" value={form.thumbnailUrl} onChange={(event) => setField('thumbnailUrl', event.target.value)} placeholder="https://..." />
              </div>
            </div>
          )}

          {form.source === 'UPLOAD' && (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <Label htmlFor="upload-file">Arquivo local</Label>
                <Input
                  id="upload-file"
                  name="uploadFile"
                  type="file"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] ?? null;
                  setField('uploadFile', nextFile);
                }}
              />
              {errors.uploadFile && <p className="text-xs text-red-600">{errors.uploadFile}</p>}
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
                <Label htmlFor="existing-file-path">Caminho do arquivo no repositório</Label>
                <Input id="existing-file-path" name="filePath" value={form.filePath} onChange={(event) => setField('filePath', event.target.value)} placeholder="/var/storage/audio/vinheta.mp3" />
                {errors.filePath && <p className="mt-1 text-xs text-red-600">{errors.filePath}</p>}
              </div>
              <div>
                <Label htmlFor="existing-public-url">URL pública (opcional)</Label>
                <Input id="existing-public-url" name="publicUrl" value={form.publicUrl} onChange={(event) => setField('publicUrl', event.target.value)} placeholder="https://..." />
              </div>
              <div>
                <Label htmlFor="existing-file-name">Nome do arquivo (opcional)</Label>
                <Input id="existing-file-name" name="fileName" value={form.fileName} onChange={(event) => setField('fileName', event.target.value)} placeholder="vinheta.mp3" />
              </div>
            </div>
          )}

          {submitError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</p>}

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <Button type="button" variant="outline" onClick={resetAndClose} disabled={isSubmitting}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : 'Salvar Mídia'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
