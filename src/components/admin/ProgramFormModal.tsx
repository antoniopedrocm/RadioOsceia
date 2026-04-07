import { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { AdminProgramRecord, ProgramFormValues, ProgramPresenterOption, ProgramStatus } from '@/types/program';

interface ProgramFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  presenters: ProgramPresenterOption[];
  initialProgram?: AdminProgramRecord | null;
  onClose: () => void;
  onSubmit: (values: ProgramFormValues) => Promise<void>;
}

const INITIAL_VALUES: ProgramFormValues = {
  title: '',
  slug: '',
  description: '',
  shortDescription: '',
  coverUrl: '',
  presenterId: '',
  categoryName: '',
  tags: '',
  status: 'DRAFT'
};

function isValidSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function toInitialValues(program?: AdminProgramRecord | null): ProgramFormValues {
  if (!program) {
    return INITIAL_VALUES;
  }

  return {
    title: program.title ?? '',
    slug: program.slug ?? '',
    description: program.description ?? '',
    shortDescription: program.shortDescription ?? '',
    coverUrl: program.coverUrl ?? '',
    presenterId: program.presenterId ?? '',
    categoryName: program.categoryName ?? '',
    tags: Array.isArray(program.tags) ? program.tags.join(', ') : '',
    status: program.status
  };
}

export function ProgramFormModal({ isOpen, mode, presenters, initialProgram, onClose, onSubmit }: ProgramFormModalProps) {
  const [values, setValues] = useState<ProgramFormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setValues(toInitialValues(initialProgram));
    setErrors({});
    setSubmitError(null);
    setIsSubmitting(false);
  }, [isOpen, initialProgram]);

  const modalTitle = mode === 'create' ? 'Novo Programa' : 'Editar Programa';
  const modalDescription = mode === 'create'
    ? 'Cadastre um novo programa e publique quando estiver pronto.'
    : 'Atualize os dados do programa selecionado.';

  const presenterOptions = useMemo(() => presenters.slice().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [presenters]);

  if (!isOpen) {
    return null;
  }

  const setField = <TKey extends keyof ProgramFormValues>(key: TKey, value: ProgramFormValues[TKey]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
    setSubmitError(null);
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!values.title.trim()) {
      nextErrors.title = 'Título é obrigatório.';
    }

    const normalizedSlug = values.slug.trim();
    if (normalizedSlug && !isValidSlug(normalizedSlug)) {
      nextErrors.slug = 'Use apenas letras minúsculas, números e hífens.';
    }

    if (values.coverUrl.trim() && !isValidHttpUrl(values.coverUrl.trim())) {
      nextErrors.coverUrl = 'Informe uma URL válida iniciando com http:// ou https://.';
    }

    return nextErrors;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const normalizedValues: ProgramFormValues = {
      title: values.title.trim(),
      slug: values.slug.trim(),
      description: values.description.trim(),
      shortDescription: values.shortDescription.trim(),
      coverUrl: values.coverUrl.trim(),
      presenterId: values.presenterId.trim(),
      categoryName: values.categoryName.trim(),
      tags: values.tags.trim(),
      status: values.status as ProgramStatus
    };

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await onSubmit(normalizedValues);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Não foi possível salvar o programa.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/55 p-4 md:p-8">
      <div className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{modalTitle}</h3>
            <p className="text-sm text-slate-500">{modalDescription}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting} aria-label="Fechar modal">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form className="space-y-5 p-6" onSubmit={handleSubmit} noValidate>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="program-title">Título</Label>
              <Input id="program-title" value={values.title} onChange={(event) => setField('title', event.target.value)} placeholder="Ex.: Manhã de Luz" />
              {errors.title ? <p className="mt-1 text-xs text-red-600">{errors.title}</p> : null}
            </div>
            <div>
              <Label htmlFor="program-slug">Slug</Label>
              <Input id="program-slug" value={values.slug} onChange={(event) => setField('slug', event.target.value.toLowerCase())} placeholder="gerado automaticamente se vazio" />
              {errors.slug ? <p className="mt-1 text-xs text-red-600">{errors.slug}</p> : null}
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="program-description">Descrição</Label>
              <Textarea id="program-description" value={values.description} onChange={(event) => setField('description', event.target.value)} rows={4} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="program-short-description">Descrição curta</Label>
              <Textarea id="program-short-description" value={values.shortDescription} onChange={(event) => setField('shortDescription', event.target.value)} rows={2} />
            </div>
            <div>
              <Label htmlFor="program-cover-url">URL da capa</Label>
              <Input id="program-cover-url" value={values.coverUrl} onChange={(event) => setField('coverUrl', event.target.value)} placeholder="https://..." />
              {errors.coverUrl ? <p className="mt-1 text-xs text-red-600">{errors.coverUrl}</p> : null}
            </div>
            <div>
              <Label htmlFor="program-category">Categoria</Label>
              <Input id="program-category" value={values.categoryName} onChange={(event) => setField('categoryName', event.target.value)} placeholder="Ex.: Entrevista" />
            </div>
            <div>
              <Label htmlFor="program-presenter">Apresentador</Label>
              <Select id="program-presenter" value={values.presenterId} onChange={(event) => setField('presenterId', event.target.value)}>
                <option value="">Nenhum apresentador</option>
                {presenterOptions.map((presenter) => (
                  <option key={presenter.id} value={presenter.id}>{presenter.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="program-status">Status</Label>
              <Select id="program-status" value={values.status} onChange={(event) => setField('status', event.target.value as ProgramStatus)}>
                <option value="ACTIVE">Ativo</option>
                <option value="DRAFT">Rascunho</option>
                <option value="INACTIVE">Inativo</option>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="program-tags">Tags (separadas por vírgula)</Label>
              <Input id="program-tags" value={values.tags} onChange={(event) => setField('tags', event.target.value)} placeholder="espiritualidade, entrevistas" />
            </div>
          </div>

          {submitError ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</p> : null}

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar Programa
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
