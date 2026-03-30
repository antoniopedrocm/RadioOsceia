import { useCallback, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { EmptyState, LoadingState } from '@/components/shared/LoadableMessage';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { PageHeader } from '@/components/admin/PageHeader';
import { useApiResource } from '@/hooks/useApiResource';
import { api, getApiErrorMessage } from '@/lib/api';

interface ApiProgram {
  id: string;
  title: string;
  presenterName?: string | null;
  categoryName?: string | null;
  isActive?: boolean;
  status?: string | null;
}

function getProgramStatus(program: ApiProgram) {
  const status = String(program.status ?? '').trim().toUpperCase();
  if (status === 'DRAFT' || status === 'RASCUNHO') {
    return 'Rascunho';
  }

  if (status === 'INACTIVE' || status === 'INATIVO') {
    return 'Inativo';
  }

  if (program.isActive === false) {
    return 'Inativo';
  }

  return 'Ativo';
}

export function AdminProgramasPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todas');

  const programsLoader = useCallback((signal: AbortSignal) => api.get<ApiProgram[]>('/programs', { signal }), []);
  const programsState = useApiResource(programsLoader, {
    initialData: [] as ApiProgram[],
    fallbackMessage: 'Não foi possível carregar os programas.'
  });

  const categoryOptions = useMemo(() => {
    const categories = Array.from(
      new Set(
        programsState.data
          .map((program) => String(program.categoryName ?? '').trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    return categories;
  }, [programsState.data]);

  const filteredPrograms = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return programsState.data.filter((program) => {
      const title = String(program.title ?? '');
      const presenter = String(program.presenterName ?? '');
      const category = String(program.categoryName ?? '');

      const matchesSearch = normalizedSearch.length === 0
        || title.toLowerCase().includes(normalizedSearch)
        || presenter.toLowerCase().includes(normalizedSearch)
        || category.toLowerCase().includes(normalizedSearch);

      const matchesCategory = selectedCategory === 'todas'
        || category.toLowerCase() === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [programsState.data, searchTerm, selectedCategory]);

  const isLoading = programsState.isLoading;
  const errorMessage = programsState.errorMessage;

  return (
    <div className="space-y-4">
      <PageHeader title="Programas" description="Gerencie todos os programas e quadros da rádio." action="Novo Programa" />

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Buscar programa..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <Select
          className="md:max-w-52"
          value={selectedCategory}
          onChange={(event) => setSelectedCategory(event.target.value)}
          aria-label="Filtrar por categoria"
        >
          <option value="todas">Todas as categorias</option>
          {categoryOptions.map((category) => (
            <option key={category} value={category.toLowerCase()}>
              {category}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? <LoadingState title="Carregando programas" description="Buscando programas cadastrados para administração." /> : null}

      {!isLoading && errorMessage ? (
        <EmptyState
          title="Não foi possível carregar os programas"
          description={getApiErrorMessage(programsState.error ?? errorMessage)}
          tone="warning"
        />
      ) : null}

      {!isLoading && !errorMessage ? (
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
              {filteredPrograms.length === 0 ? (
                <Tr>
                  <Td className="py-8 text-sm text-slate-500">Nenhum programa encontrado com os filtros atuais.</Td>
                  <Td>-</Td>
                  <Td>-</Td>
                  <Td>-</Td>
                  <Td>-</Td>
                </Tr>
              ) : filteredPrograms.map((program) => {
                const status = getProgramStatus(program);

                return (
                  <Tr key={program.id}>
                    <Td className="font-medium text-slate-800">{program.title}</Td>
                    <Td>{program.presenterName ?? 'Não informado'}</Td>
                    <Td>
                      <Badge className="bg-slate-100 text-slate-600">{program.categoryName ?? 'Sem categoria'}</Badge>
                    </Td>
                    <Td>
                      <Badge className={status === 'Ativo' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : ''}>
                        {status}
                      </Badge>
                    </Td>
                    <Td className="text-blue-600">Editar | Arquivar</Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
