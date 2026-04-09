import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import type { CanonicalUser } from '@/types/user';

export interface UserFormValues {
  nome: string;
  email: string;
  origem: CanonicalUser['authSource'];
  perfil: Exclude<CanonicalUser['role'], 'ROOT'>;
  status: CanonicalUser['status'];
  senha: string;
  confirmarSenha: string;
}

interface UserFormProps {
  mode: 'create' | 'edit' | 'password';
  initialUser?: CanonicalUser;
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (values: UserFormValues) => Promise<void> | void;
}

const defaultValues: UserFormValues = {
  nome: '',
  email: '',
  origem: 'LOCAL',
  perfil: 'OPERADOR',
  status: 'ACTIVE',
  senha: '',
  confirmarSenha: ''
};

export function UserForm({ mode, initialUser, isSubmitting = false, onCancel, onSubmit }: UserFormProps) {
  const [values, setValues] = useState<UserFormValues>(defaultValues);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if ((mode === 'edit' || mode === 'password') && initialUser) {
      setValues({
        nome: initialUser.name,
        email: initialUser.email,
        origem: initialUser.authSource,
        perfil: initialUser.role === 'ADMIN' ? 'ADMIN' : 'OPERADOR',
        status: initialUser.status,
        senha: '',
        confirmarSenha: ''
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
    if (mode !== 'password') {
      const nome = values.nome.trim();
      const email = values.email.trim();

      if (!nome) return 'Informe o nome do usuário.';
      if (!email) return 'Informe o e-mail do usuário.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Informe um e-mail válido.';
      if (!['ADMIN', 'OPERADOR'].includes(values.perfil)) return 'Perfil inválido.';
      if (!['ACTIVE', 'INACTIVE'].includes(values.status)) return 'Status inválido.';
      if (!['LOCAL', 'GOOGLE'].includes(values.origem)) return 'Origem inválida.';
    }

    const shouldRequirePassword = mode === 'password' || (mode === 'create' && values.origem === 'LOCAL');

    if (shouldRequirePassword) {
      if (values.senha.trim().length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
      if (values.senha !== values.confirmarSenha) return 'Senha e confirmação não conferem.';
    }

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
      senha: values.senha.trim(),
      confirmarSenha: values.confirmarSenha.trim()
    });
  };

  const requiresPasswordInCreate = mode === 'create' && values.origem === 'LOCAL';
  const showPasswordSection = mode === 'password' || requiresPasswordInCreate;

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {mode !== 'password' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" value={values.nome} onChange={(event) => updateField('nome', event.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={values.email}
              onChange={(event) => updateField('email', event.target.value)}
              required
              disabled={mode === 'edit'}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="origem">Origem</Label>
              <Select
                id="origem"
                value={values.origem}
                onChange={(event) => updateField('origem', event.target.value as UserFormValues['origem'])}
                disabled={mode === 'edit'}
              >
                <option value="LOCAL">LOCAL</option>
                <option value="GOOGLE">GOOGLE</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="perfil">Perfil</Label>
              <Select id="perfil" value={values.perfil} onChange={(event) => updateField('perfil', event.target.value as UserFormValues['perfil'])}>
                <option value="ADMIN">ADMIN</option>
                <option value="OPERADOR">OPERADOR</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select id="status" value={values.status} onChange={(event) => updateField('status', event.target.value as UserFormValues['status'])}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </Select>
            </div>
          </div>
        </>
      )}

      {showPasswordSection && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="senha">Senha</Label>
            <Input id="senha" type="password" value={values.senha} onChange={(event) => updateField('senha', event.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmarSenha">Confirmar senha</Label>
            <Input
              id="confirmarSenha"
              type="password"
              value={values.confirmarSenha}
              onChange={(event) => updateField('confirmarSenha', event.target.value)}
              required
            />
          </div>
        </div>
      )}

      {mode === 'create' && values.origem === 'GOOGLE' ? (
        <p className="rounded-md border border-sky-200 bg-sky-50 p-2 text-xs text-sky-700">
          Usuários GOOGLE não recebem senha local neste cadastro.
        </p>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Salvando...' : 'Salvar'}</Button>
      </div>
    </form>
  );
}
