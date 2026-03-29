import { ProgramCard } from '@/components/public/ProgramCard';
import { EmptyState, LoadingState } from '@/components/shared/LoadableMessage';
import { usePrograms } from '@/hooks/useRadioData';

export function ProgramasPage() {
  const programsState = usePrograms();

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Todos os programas</h1>

      {programsState.isLoading ? <LoadingState title="Carregando programas" description="Buscando dados no Firestore." /> : null}

      {!programsState.isLoading && programsState.errorMessage ? (
        <EmptyState title="Não foi possível carregar os programas" description={programsState.errorMessage} tone="warning" />
      ) : null}

      {!programsState.isLoading && !programsState.errorMessage ? (
        <div className="grid gap-4 md:grid-cols-3">
          {programsState.data.map((p) => <ProgramCard key={p.id} program={p} />)}
        </div>
      ) : null}
    </div>
  );
}
