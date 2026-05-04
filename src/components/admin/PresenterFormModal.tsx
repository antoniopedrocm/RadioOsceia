import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { AdminPresenterRecord, PresenterFormValues, PresenterStatus } from '@/types/presenter';

interface PresenterFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialPresenter?: AdminPresenterRecord | null;
  onClose: () => void;
  onSubmit: (values: PresenterFormValues) => Promise<void>;
}

const initialForm: PresenterFormValues = {
  name: '',
  shortBio: '',
  photoUrl: '',
  status: 'ACTIVE'
};

export function PresenterFormModal({
  isOpen,
  mode,
  initialPresenter,
  onClose,
  onSubmit
}: PresenterFormModalProps) {
  const [form, setForm] = useState<PresenterFormValues>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (mode === 'edit' && initialPresenter) {
      setForm({
        name: initialPresenter.name,
        shortBio: initialPresenter.shortBio,
        photoUrl: initialPresenter.photoUrl,
        status: initialPresenter.status
      });
    } else {
      setForm(initialForm);
    }

    setFormError(null);
    setIsSubmitting(false);
  }, [initialPresenter, isOpen, mode]);

  if (!isOpen) {
    return null;
  }

  const updateField = <TKey extends keyof PresenterFormValues>(key: TKey, value: PresenterFormValues[TKey]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setFormError('Informe o nome do apresentador.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await onSubmit({
        name: form.name.trim(),
        shortBio: form.shortBio.trim(),
        photoUrl: form.photoUrl.trim(),
        status: form.status
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Falha ao salvar apresentador.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">{mode === 'create' ? 'Novo apresentador' : 'Editar apresentador'}</h2>
            <p className="text-sm text-muted-foreground">Atualize nome, bio pública, foto e status.</p>
          </div>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Fechar</Button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="presenter-name">Nome</Label>
              <Input
                id="presenter-name"
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="presenter-status">Status</Label>
              <Select
                id="presenter-status"
                value={form.status}
                onChange={(event) => updateField('status', event.target.value as PresenterStatus)}
                disabled={isSubmitting}
              >
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="presenter-photo">URL da foto</Label>
            <Input
              id="presenter-photo"
              value={form.photoUrl}
              onChange={(event) => updateField('photoUrl', event.target.value)}
              placeholder="https://..."
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="presenter-bio">Bio curta</Label>
            <Textarea
              id="presenter-bio"
              value={form.shortBio}
              onChange={(event) => updateField('shortBio', event.target.value)}
              rows={4}
              disabled={isSubmitting}
            />
          </div>

          {form.photoUrl ? (
            <div className="flex items-center gap-3 rounded-lg border bg-slate-50 p-3">
              <img src={form.photoUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
              <p className="text-sm text-muted-foreground">Prévia da foto cadastrada.</p>
            </div>
          ) : null}

          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-4">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
