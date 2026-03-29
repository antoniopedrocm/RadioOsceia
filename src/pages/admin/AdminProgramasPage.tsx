import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { PageHeader } from '@/components/admin/PageHeader';

const programas = [
  { nome: 'Mensagem de Luz', apresentador: 'Ana Clara', categoria: 'Reflexão', status: 'Ativo' },
  { nome: 'Jornal da Esperança', apresentador: 'Rafael Dias', categoria: 'Jornal', status: 'Ativo' },
  { nome: 'Momento Musical', apresentador: 'Equipe Irmão Áureo', categoria: 'Musical', status: 'Rascunho' }
];

export function AdminProgramasPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Programas" description="Gerencie todos os programas e quadros da rádio." action="Novo Programa" />

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Buscar programa..." />
        </div>
        <Select className="md:max-w-52" defaultValue="todas" aria-label="Filtrar por categoria">
          <option value="todas">Todas as categorias</option>
          <option value="reflexao">Reflexão</option>
          <option value="jornal">Jornal</option>
          <option value="musical">Musical</option>
        </Select>
      </div>

      <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
        <Table>
          <Thead>
            <Tr>
              <Th>Programa</Th>
              <Th>Apresentador</Th>
              <Th>Categoria</Th>
              <Th>Status</Th>
              <Th>Ações</Th>
            </Tr>
          </Thead>
          <Tbody>
            {programas.map((programa) => (
              <Tr key={programa.nome}>
                <Td className="font-medium text-slate-800">{programa.nome}</Td>
                <Td>{programa.apresentador}</Td>
                <Td>
                  <Badge className="bg-slate-100 text-slate-600">{programa.categoria}</Badge>
                </Td>
                <Td>
                  <Badge className={programa.status === 'Ativo' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : ''}>
                    {programa.status}
                  </Badge>
                </Td>
                <Td className="text-blue-600">Editar | Arquivar</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>
    </div>
  );
}
