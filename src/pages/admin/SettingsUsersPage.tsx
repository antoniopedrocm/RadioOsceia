import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/admin/PageHeader';
import { UserForm } from '@/components/admin/UserForm';
import { UserTable } from '@/components/admin/UserTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { createAdminUser, deleteAdminUser, listAdminUsers, toggleAdminUserStatus, updateAdminUser } from '@/lib/adminUsersApi';
import type { AdminUser, UserFormValues } from '@/types/user';

export function SettingsUsersPage() {
  const { user } = useAdminAuth();
  const canManageUsers = user?.role === 'admin' && user?.authSource === 'firebase';

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  const formMode = useMemo(() => (editingUser ? 'edit' : 'create'), [editingUser]);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listAdminUsers();
      setUsers(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar usuários administrativos.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

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

  const handleSaveUser = async (values: UserFormValues) => {
    setIsSubmitting(true);
    setError(null);
    setFeedback(null);

    try {
      if (editingUser?.authSource === 'local-breakglass') {
        setUsers((current) => current.map((item) => (item.id === editingUser.id ? { ...item, status: values.status } : item)));
        setFeedback('Conta local de contingência atualizada.');
        closeForm();
        return;
      }

      if (editingUser) {
        const updated = await updateAdminUser({
          uid: editingUser.uid,
          nome: values.nome,
          perfil: values.perfil,
          status: values.status,
          senha: values.senha.trim() ? values.senha : undefined
        });

        setUsers((current) => current.map((item) => (item.uid === updated.uid ? updated : item)));
        setFeedback('Usuário atualizado com sucesso.');
        closeForm();
        return;
      }

      const created = await createAdminUser({
        nome: values.nome,
        email: values.email,
        senha: values.senha,
        perfil: values.perfil,
        status: values.status
      });

      setUsers((current) => [created, ...current]);
      setFeedback('Usuário criado com sucesso.');
      closeForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o usuário.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (target: AdminUser) => {
    if (target.authSource === 'local-breakglass') {
      setUsers((current) => current.map((item) => (item.id === target.id ? { ...item, status: item.status === 'ativo' ? 'inativo' : 'ativo' } : item)));
      return;
    }

    setError(null);
    setFeedback(null);

    try {
      const nextStatus = target.status === 'ativo' ? 'inativo' : 'ativo';
      const updated = await toggleAdminUserStatus({ uid: target.uid, status: nextStatus });
      setUsers((current) => current.map((item) => (item.uid === updated.uid ? updated : item)));
      setFeedback(`Usuário ${nextStatus === 'ativo' ? 'ativado' : 'desativado'} com sucesso.`);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Falha ao atualizar status.');
    }
  };

  const handleDeleteUser = async (target: AdminUser) => {
    if (target.authSource === 'local-breakglass') {
      setError('A conta local de contingência não pode ser excluída.');
      return;
    }

    if (!window.confirm(`Confirma a exclusão do usuário ${target.nome}?`)) {
      return;
    }

    setError(null);
    setFeedback(null);

    try {
      await deleteAdminUser({ uid: target.uid });
      setUsers((current) => current.filter((item) => item.uid !== target.uid));
      setFeedback('Usuário excluído com sucesso.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Falha ao excluir usuário.');
    }
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
          <div className="flex justify-between gap-2">
            <div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              {feedback ? <p className="text-sm text-emerald-700">{feedback}</p> : null}
              {!canManageUsers ? <p className="text-xs text-muted-foreground">Somente administradores Firebase podem gerenciar usuários.</p> : null}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={loadUsers} disabled={isLoading}>Atualizar</Button>
              {canManageUsers && <Button onClick={openCreateForm}>+ Novo usuário</Button>}
            </div>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando usuários administrativos...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum usuário administrativo encontrado.</p>
          ) : (
            <UserTable
              users={users}
              canManage={canManageUsers}
              currentUserUid={user?.id}
              onEdit={handleEdit}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDeleteUser}
            />
          )}
        </CardContent>
      </Card>

      {isFormOpen && canManageUsers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-xl">
            <CardContent className="p-6">
              <h3 className="mb-1 text-lg font-semibold">{editingUser ? 'Editar usuário' : 'Novo usuário'}</h3>
              <p className="mb-4 text-sm text-muted-foreground">{editingUser ? 'Atualize os dados do usuário selecionado.' : 'Cadastre um novo acesso administrativo.'}</p>
              <UserForm
                mode={formMode}
                initialUser={editingUser ?? undefined}
                isSubmitting={isSubmitting}
                onCancel={closeForm}
                onSubmit={handleSaveUser}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
