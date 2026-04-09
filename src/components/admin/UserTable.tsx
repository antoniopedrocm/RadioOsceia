import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import type { CanonicalUser } from '@/types/user';

interface UserTableProps {
  users: CanonicalUser[];
  canManage: boolean;
  currentUserUids: string[];
  onEdit: (user: CanonicalUser) => void;
  onChangePassword: (user: CanonicalUser) => void;
  onToggleStatus: (user: CanonicalUser) => void;
  onDelete: (user: CanonicalUser) => void;
}

function isAdministrative(user: CanonicalUser) {
  return user.role === 'ADMIN' || user.role === 'ROOT';
}

function formatDate(value?: string) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

export function UserTable({ users, canManage, currentUserUids, onEdit, onChangePassword, onToggleStatus, onDelete }: UserTableProps) {
  const activeAdministrativeCount = users.filter((user) => user.status === 'ACTIVE' && isAdministrative(user)).length;

  return (
    <div className="overflow-x-auto">
      <Table>
        <Thead>
          <Tr>
            <Th>Nome</Th>
            <Th>E-mail</Th>
            <Th>Origem</Th>
            <Th>Perfil</Th>
            <Th>Status</Th>
            <Th>Último acesso</Th>
            <Th className="text-right">Ações</Th>
          </Tr>
        </Thead>
        <Tbody>
          {users.map((user) => {
            const uidKey = user.firebaseUid ?? user.id;
            const isCurrentUser = currentUserUids.includes(uidKey) || currentUserUids.includes(user.id);
            const isRoot = user.role === 'ROOT' || user.isProtected;
            const isLastAdministrative = user.status === 'ACTIVE' && isAdministrative(user) && activeAdministrativeCount <= 1;

            const blockEdit = isRoot || isCurrentUser;
            const blockToggle = isRoot || isCurrentUser || (user.status === 'ACTIVE' && isLastAdministrative);
            const blockDelete = isRoot || isCurrentUser || isLastAdministrative;
            const canChangePassword = user.authSource === 'LOCAL' && !isRoot;

            return (
              <Tr key={user.id}>
                <Td className="font-medium text-slate-800">{user.name}</Td>
                <Td>{user.email}</Td>
                <Td>
                  <Badge className={user.authSource === 'LOCAL' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}>
                    {user.authSource}
                  </Badge>
                </Td>
                <Td>
                  <Badge className={user.role === 'ROOT' ? 'bg-violet-100 text-violet-800' : user.role === 'ADMIN' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'}>
                    {user.role}
                  </Badge>
                </Td>
                <Td>
                  <Badge className={user.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>{user.status}</Badge>
                </Td>
                <Td>{formatDate(user.lastLoginAt)}</Td>
                <Td>
                  {canManage ? (
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => onEdit(user)} disabled={blockEdit}>
                        Editar
                      </Button>
                      {canChangePassword ? (
                        <Button size="sm" variant="outline" onClick={() => onChangePassword(user)}>
                          Alterar senha
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost" onClick={() => onToggleStatus(user)} disabled={blockToggle}>
                        {user.status === 'ACTIVE' ? 'Desativar' : 'Ativar'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onDelete(user)} disabled={blockDelete}>
                        Excluir
                      </Button>
                    </div>
                  ) : (
                    <p className="text-right text-xs text-muted-foreground">Somente visualização</p>
                  )}
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </div>
  );
}
