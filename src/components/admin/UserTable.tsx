import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import type { AdminUser } from '@/types/user';

interface UserTableProps {
  users: AdminUser[];
  canManage: boolean;
  currentUserUid?: string;
  onEdit: (user: AdminUser) => void;
  onToggleStatus: (user: AdminUser) => void;
  onDelete: (user: AdminUser) => void;
}

const profileLabel: Record<AdminUser['perfil'], string> = {
  admin: 'Admin',
  operador: 'Operador',
  root: 'Root'
};

export function UserTable({ users, canManage, currentUserUid, onEdit, onToggleStatus, onDelete }: UserTableProps) {
  const activeAdminsCount = users.filter((user) => user.perfil === 'admin' && user.status === 'ativo' && user.authSource === 'firebase').length;

  return (
    <div className="overflow-x-auto">
      <Table>
        <Thead>
          <Tr>
            <Th>Nome</Th>
            <Th>Email</Th>
            <Th>Perfil</Th>
            <Th>Origem</Th>
            <Th>Status</Th>
            <Th>Último acesso</Th>
            <Th className="text-right">Ações</Th>
          </Tr>
        </Thead>
        <Tbody>
          {users.map((user) => {
            const isCurrentUser = user.uid === currentUserUid;
            const isLocalRoot = user.isLocalRoot;
            const isOnlyActiveAdmin = user.perfil === 'admin' && user.status === 'ativo' && user.authSource === 'firebase' && activeAdminsCount <= 1;
            const blockDelete = isLocalRoot || isCurrentUser || isOnlyActiveAdmin || user.isProtected;
            const blockToggle = isOnlyActiveAdmin || isLocalRoot || isCurrentUser || user.isProtected;
            const blockEdit = isLocalRoot;

            return (
              <Tr key={user.id}>
                <Td className="font-medium text-slate-800">{user.nome}</Td>
                <Td>{user.email}</Td>
                <Td>
                  <Badge className={user.perfil === 'root' ? 'bg-amber-100 text-amber-800' : user.perfil === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'}>
                    {profileLabel[user.perfil]}
                  </Badge>
                </Td>
                <Td>
                  <Badge className={isLocalRoot ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}>
                    {isLocalRoot ? 'Local' : user.provider ?? 'firebase'}
                  </Badge>
                </Td>
                <Td>
                  <Badge className={user.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>{user.status}</Badge>
                </Td>
                <Td>{user.ultimoAcesso || '—'}</Td>
                <Td>
                  {canManage ? (
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => onEdit(user)} disabled={blockEdit}>
                        Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onToggleStatus(user)} disabled={blockToggle}>
                        {user.status === 'ativo' ? 'Desativar' : 'Ativar'}
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
