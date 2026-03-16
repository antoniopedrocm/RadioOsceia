import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import type { AdminUser } from '@/types/user';

interface UserTableProps {
  users: AdminUser[];
  canManage: boolean;
  onEdit: (user: AdminUser) => void;
  onToggleStatus: (userId: string) => void;
}

const profileLabel: Record<AdminUser['perfil'], string> = {
  admin: 'Admin',
  operador: 'Operador'
};

export function UserTable({ users, canManage, onEdit, onToggleStatus }: UserTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <Thead>
          <Tr>
            <Th>Nome</Th>
            <Th>Email</Th>
            <Th>Perfil</Th>
            <Th>Status</Th>
            <Th>Último acesso</Th>
            <Th className="text-right">Ações</Th>
          </Tr>
        </Thead>
        <Tbody>
          {users.map((user) => (
            <Tr key={user.id}>
              <Td className="font-medium text-slate-800">{user.nome}</Td>
              <Td>{user.email}</Td>
              <Td>
                <Badge className={user.perfil === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'}>{profileLabel[user.perfil]}</Badge>
              </Td>
              <Td>
                <Badge className={user.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>{user.status}</Badge>
              </Td>
              <Td>{user.ultimoAcesso || '—'}</Td>
              <Td>
                {canManage ? (
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => onEdit(user)}>
                      Editar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onToggleStatus(user.id)}>
                      {user.status === 'ativo' ? 'Desativar' : 'Ativar'}
                    </Button>
                  </div>
                ) : (
                  <p className="text-right text-xs text-muted-foreground">Sem permissão</p>
                )}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </div>
  );
}
