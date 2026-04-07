import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import type { AdminUser, UserFormValues } from '@/types/user';

interface UserFormProps {
  mode: 'create' | 'edit';
  initialUser?: AdminUser;
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (values: UserFormValues) => Promise<void> | void;
}

const defaultValues: UserFormValues = {
  nome: '',
  email: '',
  senha: '',
  perfil: 'operador',
  status: 'ativo'
};

export function UserForm({ mode, initialUser, isSubmitting = false, onCancel, onSubmit }: UserFormProps) {
  const [values, setValues] = useState<UserFormValues>(defaultValues);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'edit' && initialUser) {
      setValues({
        nome: initialUser.nome,
        email: initialUser.email,
        senha: '',
        perfil: initialUser.perfil === 'root' ? 'admin' : initialUser.perfil,
        status: initialUser.status
      });
      setError(null);
      return;
    }

    setValues(defaultValues);
    setError(null);
  }, [mode, initialUser]);

  const updateField = <K extends keyof UserFormValues>(field: K, value: UserFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const validate = () => {
    const nome = values.nome.trim();
    const email = values.email.trim();

    if (!nome) return 'Informe o nome do usuário.';
    if (!email) return 'Informe o e-mail do usuário.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Informe um e-mail válido.';
    if (mode === 'create' && values.senha.trim().length < 8) return 'A senha inicial deve ter pelo menos 8 caracteres.';
    if (mode === 'edit' && values.senha.trim().length > 0 && values.senha.trim().length < 8) return 'A nova senha deve ter pelo menos 8 caracteres.';
    if (!['admin', 'operador'].includes(values.perfil)) return 'Perfil inválido.';
    if (!['ativo', 'inativo'].includes(values.status)) return 'Status inválido.';
    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    await onSubmit({
      ...values,
      nome: values.nome.trim(),
      email: values.email.trim().toLowerCase(),
      senha: values.senha.trim()
    });
  };

  const isLocalRoot = initialUser?.isLocalRoot;

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {isLocalRoot && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          Usuário root local é protegido e não pode ser editado por este formulário.
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" value={values.nome} onChange={(event) => updateField('nome', event.target.value)} required disabled={isLocalRoot} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={values.email}
          onChange={(event) => updateField('email', event.target.value)}
          required
          disabled={mode === 'edit'}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="senha">{mode === 'create' ? 'Senha' : 'Redefinir senha (opcional)'}</Label>
        <Input
          id="senha"
          type="password"
          value={values.senha}
          onChange={(event) => updateField('senha', event.target.value)}
          required={mode === 'create'}
          disabled={isLocalRoot}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="perfil">Perfil</Label>
          <Select id="perfil" value={values.perfil} onChange={(event) => updateField('perfil', event.target.value as UserFormValues['perfil'])} disabled={isLocalRoot}>
            <option value="admin">Administrador</option>
            <option value="operador">Operador</option>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select id="status" value={values.status} onChange={(event) => updateField('status', event.target.value as UserFormValues['status'])} disabled={isLocalRoot}>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </Select>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting || isLocalRoot}>{isSubmitting ? 'Salvando...' : 'Salvar'}</Button>
      </div>
    </form>
  );
}
