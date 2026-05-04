import { useCallback, useMemo, useState } from 'react';
import { Pencil, Search } from 'lucide-react';

import { PresenterFormModal } from '@/components/admin/PresenterFormModal';
import { PageHeader } from '@/components/admin/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState } from '@/components/shared/LoadableMessage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useApiResource } from '@/hooks/useApiResource';
import { api, getApiErrorMessage } from '@/lib/api';
import type { AdminPresenterRecord, PresenterFormValues } from '@/types/presenter';

function getStatusLabel(isActive: boolean) {
  return isActive ? 'Ativo' : 'Inativo';
}

function getInitials(name: string) {
  return (
    name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'AP'
  );
}

export function AdminApresentadoresPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedPresenter, setSelectedPresenter] = useState<AdminPresenterRecord | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rowActionId, setRowActionId] = useState<string | null>(null);

  const presentersState = useApiResource(
    useCallback((signal: AbortSignal) => api.get<AdminPresenterRecord[]>('/admin/presenters', { signal }), []),
    {
      initialData: [] as AdminPresenterRecord[],
      fallbackMessage: 'Não foi possível carregar os apresentadores.'
    }
  );

  const filteredPresenters = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return presentersState.data.filter((presenter) => {
      const matchesSearch =
        normalizedSearch.length === 0
        || presenter.name.toLowerCase().includes(normalizedSearch)
        || presenter.shortBio.toLowerCase().includes(normalizedSearch)
        || presenter.programTitles.some((title) => title.toLowerCase().includes(normalizedSearch));

      const matchesStatus =
        statusFilter === 'ALL'
        || (statusFilter === 'ACTIVE' && presenter.isActive)
        || (statusFilter === 'INACTIVE' && !presenter.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [presentersState.data, searchTerm, statusFilter]);

  const showFeedback = (message: string) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 4000);
  };

  const openCreate = () => {
    setFormMode('create');
    setSelectedPresenter(null);
    setActionError(null);
    setIsFormOpen(true);
  };

  const openEdit = (presenter: AdminPresenterRecord) => {
    setFormMode('edit');
    setSelectedPresenter(presenter);
    setActionError(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setSelectedPresenter(null);
  };

  const handleSubmitPresenter = async (values: PresenterFormValues) => {
    try {
      setActionError(null);

      if (formMode === 'create') {
        await api.post('/presenters', values);
        showFeedback(`Apresentador "${values.name}" criado com sucesso.`);
      } else if (selectedPresenter) {
        await api.put(`/presenters/${selectedPresenter.id}`, values);
        showFeedback(`Apresentador "${values.name}" atualizado com sucesso.`);
      }

      closeForm();
      presentersState.reload();
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'Não foi possível salvar o apresentador.'));
    }
  };

  const handleStatusToggle = async (presenter: AdminPresenterRecord) => {
    const nextStatus = presenter.isActive ? 'INACTIVE' : 'ACTIVE';
    const actionLabel = presenter.isActive ? 'inativar' : 'ativar';
    const confirmed = window.confirm(`Deseja ${actionLabel} o apresentador "${presenter.name}"?`);
    if (!confirmed) {
      return;
    }

    setRowActionId(presenter.id);
    setActionError(null);

    try {
      await api.post(`/presenters/${presenter.id}/status`, { status: nextStatus });
      presentersState.reload();
      showFeedback(
        `Apresentador "${presenter.name}" ${nextStatus === 'ACTIVE' ? 'ativado' : 'inativado'} com sucesso.`
      );
    } catch (error) {
      setActionError(getApiErrorMessage(error, `Não foi possível ${actionLabel} o apresentador.`));
    } finally {
      setRowActionId(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Apresentadores"
        description="Gerencie equipe, bios públicas e vínculo com programas."
        action="Novo apresentador"
        onActionClick={openCreate}
      />

      {feedback ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {feedback}
        </div>
      ) : null}

      {actionError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-xl border bg-white p-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, bio ou programa..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <Select
          className="md:max-w-44"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          aria-label="Filtrar por status"
        >
          <option value="ALL">Todos</option>
          <option value="ACTIVE">Ativos</option>
          <option value="INACTIVE">Inativos</option>
        </Select>
      </div>

      {presentersState.isLoading ? (
        <LoadingState title="Carregando apresentadores" description="Buscando equipe cadastrada para administração." />
      ) : null}

      {!presentersState.isLoading && presentersState.errorMessage ? (
        <EmptyState
          title="Não foi possível carregar os apresentadores"
          description={getApiErrorMessage(presentersState.error ?? presentersState.errorMessage)}
          tone="warning"
        />
      ) : null}

      {!presentersState.isLoading && !presentersState.errorMessage ? (
        filteredPresenters.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredPresenters.map((presenter) => (
              <Card key={presenter.id} className={!presenter.isActive ? 'opacity-75' : undefined}>
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {presenter.photoUrl ? (
                        <img
                          src={presenter.photoUrl}
                          alt={presenter.name}
                          className="h-16 w-16 rounded-full object-cover"
                        />
                      ) : (
                        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary">
                          {getInitials(presenter.name)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold">{presenter.name}</h3>
                        <Badge
                          className={
                            presenter.isActive
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }
                        >
                          {getStatusLabel(presenter.isActive)}
                        </Badge>
                      </div>
                    </div>

                    <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(presenter)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                  </div>

                  <p className="min-h-10 text-sm text-muted-foreground">
                    {presenter.shortBio || 'Sem bio cadastrada.'}
                  </p>

                  <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                    <p className="font-medium text-slate-700">Programas vinculados</p>
                    <p>
                      {presenter.programTitles.length
                        ? presenter.programTitles.join(', ')
                        : 'Nenhum programa vinculado.'}
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleStatusToggle(presenter)}
                      disabled={rowActionId === presenter.id}
                    >
                      {presenter.isActive ? 'Inativar' : 'Ativar'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nenhum apresentador encontrado"
            description="Ajuste os filtros ou cadastre um novo apresentador."
          />
        )
      ) : null}

      <PresenterFormModal
        isOpen={isFormOpen}
        mode={formMode}
        initialPresenter={selectedPresenter}
        onClose={closeForm}
        onSubmit={handleSubmitPresenter}
      />
    </div>
  );
}
