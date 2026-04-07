import { useCallback, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { EmptyState, LoadingState } from '@/components/shared/LoadableMessage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { PageHeader } from '@/components/admin/PageHeader';
import { ProgramFormModal } from '@/components/admin/ProgramFormModal';
import { ProgramStatusBadge } from '@/components/admin/ProgramStatusBadge';
import { useApiResource } from '@/hooks/useApiResource';
import { api, getApiErrorMessage } from '@/lib/api';
import type { AdminProgramRecord, ProgramFormValues, ProgramPresenterOption, ProgramStatus } from '@/types/program';

function normalizeProgramStatus(status: string | null | undefined, isActive?: boolean) {
  const normalized = String(status ?? '').trim().toUpperCase();
  if (normalized === 'ACTIVE') return 'ACTIVE' as ProgramStatus;
  if (normalized === 'INACTIVE') return 'INACTIVE' as ProgramStatus;
  if (normalized === 'DRAFT') return 'DRAFT' as ProgramStatus;
  return isActive ? 'ACTIVE' : 'INACTIVE';
}

export function AdminProgramasPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todas');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedProgram, setSelectedProgram] = useState<AdminProgramRecord | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rowActionId, setRowActionId] = useState<string | null>(null);

  const programsLoader = useCallback((signal: AbortSignal) => api.get<AdminProgramRecord[]>('/programs', { signal }), []);
  const programsState = useApiResource(programsLoader, {
    initialData: [] as AdminProgramRecord[],
    fallbackMessage: 'Não foi possível carregar os programas.'
  });

  const presentersLoader = useCallback((signal: AbortSignal) => api.get<ProgramPresenterOption[]>('/presenters', { signal }), []);
  const presentersState = useApiResource(presentersLoader, {
    initialData: [] as ProgramPresenterOption[],
    fallbackMessage: 'Não foi possível carregar os apresentadores ativos.'
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

  const openCreate = () => {
    setFormMode('create');
    setSelectedProgram(null);
    setActionError(null);
    setIsFormOpen(true);
  };

  const openEdit = (program: AdminProgramRecord) => {
    setFormMode('edit');
    setSelectedProgram(program);
    setActionError(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setSelectedProgram(null);
  };

  const handleSubmitProgram = async (values: ProgramFormValues) => {
    try {
      setActionError(null);
      if (formMode === 'create') {
        await api.post('/programs', values);
        setFeedback(`Programa "${values.title}" criado com sucesso.`);
      } else if (selectedProgram) {
        await api.put(`/programs/${selectedProgram.id}`, values);
        setFeedback(`Programa "${values.title}" atualizado com sucesso.`);
      }

      closeForm();
      programsState.reload();
      window.setTimeout(() => setFeedback(null), 4000);
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'Não foi possível salvar o programa.'));
    }
  };

  const handleArchiveToggle = async (program: AdminProgramRecord) => {
    const status = normalizeProgramStatus(program.status, program.isActive);
    const shouldArchive = status === 'ACTIVE';
    const actionLabel = shouldArchive ? 'arquivar' : 'ativar';
    const confirmMessage = shouldArchive
      ? `Deseja arquivar o programa "${program.title}"?`
      : `Deseja ativar o programa "${program.title}"?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setRowActionId(program.id);
    setActionError(null);

    try {
      await api.post(`/programs/${program.id}/${shouldArchive ? 'archive' : 'activate'}`);
      programsState.reload();
      setFeedback(`Programa "${program.title}" ${shouldArchive ? 'arquivado' : 'ativado'} com sucesso.`);
      window.setTimeout(() => setFeedback(null), 4000);
    } catch (error) {
      setActionError(getApiErrorMessage(error, `Não foi possível ${actionLabel} o programa.`));
    } finally {
      setRowActionId(null);
    }
  };

  const isLoading = programsState.isLoading || presentersState.isLoading;
  const errorMessage = programsState.errorMessage || presentersState.errorMessage;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Programas"
        description="Gerencie todos os programas e quadros da rádio."
        action="Novo Programa"
        onActionClick={openCreate}
      />

      {feedback ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{feedback}</div>
      ) : null}

      {actionError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
      ) : null}

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
          description={getApiErrorMessage(programsState.error ?? presentersState.error ?? errorMessage)}
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
                const status = normalizeProgramStatus(program.status, program.isActive);

                return (
                  <Tr key={program.id}>
                    <Td className="font-medium text-slate-800">{program.title}</Td>
                    <Td>{program.presenterName ?? 'Não informado'}</Td>
                    <Td>
                      <Badge className="bg-slate-100 text-slate-600">{program.categoryName ?? 'Sem categoria'}</Badge>
                    </Td>
                    <Td>
                      <ProgramStatusBadge status={status} />
                    </Td>
                    <Td>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(program)}>Editar</Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleArchiveToggle(program)}
                          disabled={rowActionId === program.id}
                        >
                          {status === 'ACTIVE' ? 'Arquivar' : 'Ativar'}
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </div>
      ) : null}

      <ProgramFormModal
        isOpen={isFormOpen}
        mode={formMode}
        initialProgram={selectedProgram}
        presenters={presentersState.data}
        onClose={closeForm}
        onSubmit={handleSubmitProgram}
      />
    </div>
  );
}
