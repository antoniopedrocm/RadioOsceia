import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/admin/PageHeader';
import { UserForm, type UserFormValues } from '@/components/admin/UserForm';
import { UserTable } from '@/components/admin/UserTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { api, getApiErrorMessage } from '@/lib/api';
import type { CanonicalUser } from '@/types/user';

type FormMode = 'create' | 'edit' | 'password';

function isAdministrative(user: CanonicalUser) {
  return user.role === 'ADMIN' || user.role === 'ROOT';
}

export function SettingsUsersPage() {
  const { user, isLocalRoot, sessionType } = useAdminAuth();
  const requiresLocalRootMessage = 'Faça login local-root para gerenciar usuários.';
  const isUsersApiSessionAllowed = sessionType === 'LOCAL' && isLocalRoot && user?.role === 'root';
  const canManageUsers = isUsersApiSessionAllowed;

  const [users, setUsers] = useState<CanonicalUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<CanonicalUser | null>(null);
  const [formMode, setFormMode] = useState<FormMode>('create');

  const currentUserUids = useMemo(() => {
    if (!user) return [];
    return [user.id];
  }, [user]);

  const activeAdministrativeCount = useMemo(
    () => users.filter((item) => item.status === 'ACTIVE' && isAdministrative(item)).length,
    [users]
  );

  const loadUsers = useCallback(async () => {
    if (!isUsersApiSessionAllowed) {
      setUsers([]);
      setError(requiresLocalRootMessage);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await api.listAppUsers();
      const sorted = [...data.users].sort((a, b) => a.name.localeCompare(b.name));
      setUsers(sorted);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, 'Falha ao carregar usuários administrativos.'));
    } finally {
      setIsLoading(false);
    }
  }, [isUsersApiSessionAllowed, requiresLocalRootMessage]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleRefresh = () => {
    if (!isUsersApiSessionAllowed) {
      setFeedback(null);
      setError(requiresLocalRootMessage);
      setIsLoading(false);
      return;
    }

    loadUsers();
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingUser(null);
    setFormMode('create');
  };

  const openCreate = () => {
    setEditingUser(null);
    setFormMode('create');
    setIsFormOpen(true);
  };

  const handleEdit = (targetUser: CanonicalUser) => {
    setEditingUser(targetUser);
    setFormMode('edit');
    setIsFormOpen(true);
  };

  const handleChangePassword = (targetUser: CanonicalUser) => {
    setEditingUser(targetUser);
    setFormMode('password');
    setIsFormOpen(true);
  };

  const wouldDemoteLastAdministrative = (target: CanonicalUser, nextRole: CanonicalUser['role'], nextStatus: CanonicalUser['status']) => {
    const isCurrentlyAdministrative = target.status === 'ACTIVE' && isAdministrative(target);
    const willRemainAdministrative = nextStatus === 'ACTIVE' && (nextRole === 'ADMIN' || nextRole === 'ROOT');
    return isCurrentlyAdministrative && !willRemainAdministrative && activeAdministrativeCount <= 1;
  };

  const handleSaveUser = async (values: UserFormValues) => {
    setIsSubmitting(true);
    setError(null);
    setFeedback(null);

    try {
      if (formMode === 'password' && editingUser) {
        if (editingUser.authSource !== 'LOCAL') {
          throw new Error('Alteração de senha disponível apenas para usuários LOCAL.');
        }

        await api.setAppUserPassword({ uid: editingUser.firebaseUid ?? editingUser.id, password: values.senha });
        setFeedback('Senha alterada com sucesso.');
        closeForm();
        return;
      }

      if (formMode === 'edit' && editingUser) {
        const nextRole = values.perfil;
        const nextStatus = values.status;

        if (editingUser.role === 'ROOT' || editingUser.isProtected) {
          throw new Error('Usuário root/protegido não pode ser alterado por esta interface.');
        }

        const editingUid = editingUser.firebaseUid ?? editingUser.id;
        if (currentUserUids.includes(editingUid) && nextStatus === 'INACTIVE') {
          throw new Error('Você não pode desativar sua própria conta.');
        }

        if (wouldDemoteLastAdministrative(editingUser, nextRole, nextStatus)) {
          throw new Error('Não é permitido remover ou rebaixar o último usuário administrativo ativo.');
        }

        await api.updateAppUser({
          uid: editingUid,
          name: values.nome,
          role: nextRole,
          status: nextStatus
        });

        await loadUsers();
        setFeedback('Usuário atualizado com sucesso.');
        closeForm();
        return;
      }

      const payload = {
        name: values.nome,
        email: values.email,
        authSource: values.origem,
        role: values.perfil,
        status: values.status,
        ...(values.origem === 'LOCAL' ? { password: values.senha } : {})
      } as const;

      await api.createAppUser(payload);
      await loadUsers();
      setFeedback('Usuário criado com sucesso.');
      closeForm();
    } catch (saveError) {
      setError(getApiErrorMessage(saveError, 'Não foi possível salvar o usuário.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (target: CanonicalUser) => {
    setError(null);
    setFeedback(null);

    try {
      if (target.role === 'ROOT' || target.isProtected) {
        throw new Error('Usuário root/protegido não pode ter status alterado.');
      }

      const targetUid = target.firebaseUid ?? target.id;
      const nextStatus = target.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

      if (currentUserUids.includes(targetUid) && nextStatus === 'INACTIVE') {
        throw new Error('Você não pode desativar sua própria conta.');
      }

      if (wouldDemoteLastAdministrative(target, target.role, nextStatus)) {
        throw new Error('Não é permitido desativar o último usuário administrativo ativo.');
      }

      await api.updateAppUser({ uid: targetUid, status: nextStatus });
      await loadUsers();
      setFeedback(`Usuário ${nextStatus === 'ACTIVE' ? 'ativado' : 'desativado'} com sucesso.`);
    } catch (toggleError) {
      setError(getApiErrorMessage(toggleError, 'Falha ao atualizar status.'));
    }
  };

  const handleDeleteUser = async (target: CanonicalUser) => {
    const targetUid = target.firebaseUid ?? target.id;

    if (!window.confirm(`Confirma a exclusão do usuário ${target.name}?`)) {
      return;
    }

    setError(null);
    setFeedback(null);

    try {
      if (target.role === 'ROOT' || target.isProtected) {
        throw new Error('Usuário root/protegido não pode ser excluído.');
      }

      if (currentUserUids.includes(targetUid)) {
        throw new Error('Você não pode excluir sua própria conta.');
      }

      if (target.status === 'ACTIVE' && isAdministrative(target) && activeAdministrativeCount <= 1) {
        throw new Error('Não é permitido excluir o último usuário administrativo ativo.');
      }

      await api.deleteAppUser({ uid: targetUid });
      await loadUsers();
      setFeedback('Usuário excluído com sucesso.');
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError, 'Falha ao excluir usuário.'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/admin/configuracoes" className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            Geral
          </Link>
          <span className="rounded-md bg-blue-50 px-3 py-1.5 font-medium text-blue-700">Usuários</span>
        </div>

        <PageHeader title="Usuários do Sistema" description="Gerencie acessos administrativos reais" />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex justify-between gap-2">
            <div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              {feedback ? <p className="text-sm text-emerald-700">{feedback}</p> : null}
              {!canManageUsers ? <p className="text-xs text-muted-foreground">{requiresLocalRootMessage}</p> : null}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>Atualizar</Button>
              {canManageUsers && <Button onClick={openCreate}>+ Novo usuário</Button>}
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
              currentUserUids={currentUserUids}
              onEdit={handleEdit}
              onChangePassword={handleChangePassword}
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
              <h3 className="mb-1 text-lg font-semibold">
                {formMode === 'create' ? 'Novo usuário' : formMode === 'edit' ? 'Editar usuário' : 'Alterar senha'}
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                {formMode === 'create'
                  ? 'Cadastre um novo acesso administrativo.'
                  : formMode === 'edit'
                    ? 'Atualize nome, perfil e status do usuário selecionado.'
                    : 'Defina uma nova senha para o usuário local selecionado.'}
              </p>
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
