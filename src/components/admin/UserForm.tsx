import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import type { AdminUser, UserFormValues } from '@/types/user';

interface UserFormProps {
  mode: 'create' | 'edit';
  initialUser?: AdminUser;
  onCancel: () => void;
  onSubmit: (values: UserFormValues) => void;
}

const defaultValues: UserFormValues = {
  nome: '',
  email: '',
  senha: '',
  perfil: 'operador',
  status: 'ativo'
};

export function UserForm({ mode, initialUser, onCancel, onSubmit }: UserFormProps) {
  const [values, setValues] = useState<UserFormValues>(defaultValues);

  useEffect(() => {
    if (mode === 'edit' && initialUser) {
      setValues({
        nome: initialUser.nome,
        email: initialUser.email,
        senha: '',
        perfil: initialUser.perfil,
        status: initialUser.status
      });
      return;
    }

    setValues(defaultValues);
  }, [mode, initialUser]);

  const updateField = <K extends keyof UserFormValues>(field: K, value: UserFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(values);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" value={values.nome} onChange={(event) => updateField('nome', event.target.value)} required />
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
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="perfil">Perfil</Label>
          <Select id="perfil" value={values.perfil} onChange={(event) => updateField('perfil', event.target.value as UserFormValues['perfil'])}>
            <option value="admin">Administrador</option>
            <option value="operador">Operador</option>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select id="status" value={values.status} onChange={(event) => updateField('status', event.target.value as UserFormValues['status'])}>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  );
}
