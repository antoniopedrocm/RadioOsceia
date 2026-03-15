import { FilterBar } from '@/components/admin/FilterBar';
import { PageHeader } from '@/components/admin/PageHeader';
import { DataTable } from '@/components/admin/DataTable';

export function AdminProgramasPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Programas"
        description="Gerencie todos os programas e quadros da rádio."
        action="Novo Programa"
      />
      <FilterBar searchPlaceholder="Buscar programa..." categoryLabel="Filtrar por categoria" />
      <DataTable
        headers={['Programa', 'Apresentador', 'Categoria', 'Status', 'Ações']}
        rows={[
          ['Mensagem de Luz', 'Ana Clara', 'Reflexão', 'Ativo', 'Editar | Arquivar'],
          ['Jornal da Esperança', 'Rafael Dias', 'Jornal', 'Ativo', 'Editar | Arquivar'],
          ['Momento Musical', 'Equipe', 'Musical', 'Rascunho', 'Editar | Arquivar']
        ]}
      />
      <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
        <p>Mostrando 1-3 de 24 programas</p>
        <p>Página 1 de 8</p>
      </div>
    </div>
  );
}
