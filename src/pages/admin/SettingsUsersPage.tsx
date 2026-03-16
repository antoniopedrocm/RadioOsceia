import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/admin/PageHeader';
import { UserForm } from '@/components/admin/UserForm';
import { UserTable } from '@/components/admin/UserTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import type { AdminUser, UserFormValues } from '@/types/user';

const initialUsers: AdminUser[] = [
  {
    id: '1',
    nome: 'Administrador',
    email: 'admin@radio.org',
    perfil: 'admin',
    status: 'ativo',
    dataCriacao: '2026-01-02',
    ultimoAcesso: '2026-03-14'
  },
  {
    id: '2',
    nome: 'Operador Rádio',
    email: 'operador@radio.org',
    perfil: 'operador',
    status: 'ativo',
    dataCriacao: '2026-01-05',
    ultimoAcesso: '2026-03-13'
  }
];

export function SettingsUsersPage() {
  const { user } = useAdminAuth();
  const canManageUsers = user?.role === 'admin';

  const [users, setUsers] = useState(initialUsers);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  const formMode = useMemo(() => (editingUser ? 'edit' : 'create'), [editingUser]);

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingUser(null);
  };

  const openCreateForm = () => {
    setEditingUser(null);
    setIsFormOpen(true);
  };

  const handleEdit = (targetUser: AdminUser) => {
    setEditingUser(targetUser);
    setIsFormOpen(true);
  };

  const handleSaveUser = (values: UserFormValues) => {
    if (editingUser) {
      setUsers((current) =>
        current.map((existingUser) =>
          existingUser.id === editingUser.id
            ? {
                ...existingUser,
                nome: values.nome,
                perfil: values.perfil,
                status: values.status
              }
            : existingUser
        )
      );
      closeForm();
      return;
    }

    const newUser: AdminUser = {
      id: crypto.randomUUID(),
      nome: values.nome,
      email: values.email,
      perfil: values.perfil,
      status: 'ativo',
      dataCriacao: new Date().toISOString().split('T')[0],
      ultimoAcesso: ''
    };

    setUsers((current) => [newUser, ...current]);
    closeForm();
  };

  const toggleUserStatus = (userId: string) => {
    setUsers((current) =>
      current.map((targetUser) =>
        targetUser.id === userId
          ? {
              ...targetUser,
              status: targetUser.status === 'ativo' ? 'inativo' : 'ativo'
            }
          : targetUser
      )
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/admin/configuracoes" className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            Geral
          </Link>
          <button type="button" className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            Instituição
          </button>
          <span className="rounded-md bg-blue-50 px-3 py-1.5 font-medium text-blue-700">Usuários</span>
        </div>

        <PageHeader title="Usuários do Sistema" description="Gerencie acessos administrativos" />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex justify-end">
            {canManageUsers && <Button onClick={openCreateForm}>+ Novo usuário</Button>}
          </div>

          <UserTable users={users} canManage={canManageUsers} onEdit={handleEdit} onToggleStatus={toggleUserStatus} />
        </CardContent>
      </Card>

      {isFormOpen && canManageUsers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-xl">
            <CardContent className="p-6">
              <h3 className="mb-1 text-lg font-semibold">{editingUser ? 'Editar usuário' : 'Novo usuário'}</h3>
              <p className="mb-4 text-sm text-muted-foreground">{editingUser ? 'Atualize os dados do usuário selecionado.' : 'Cadastre um novo acesso administrativo.'}</p>
              <UserForm mode={formMode} initialUser={editingUser ?? undefined} onCancel={closeForm} onSubmit={handleSaveUser} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
