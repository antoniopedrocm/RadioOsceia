import { PresenterCard } from '@/components/public/PresenterCard';
import { EmptyState, LoadingState } from '@/components/shared/LoadableMessage';
import { usePresenters } from '@/hooks/useRadioData';

export function ApresentadoresPage() {
  const presentersState = usePresenters();

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Apresentadores e palestrantes</h1>

      {presentersState.isLoading ? <LoadingState title="Carregando apresentadores" description="Buscando dados no Firestore." /> : null}

      {!presentersState.isLoading && presentersState.errorMessage ? (
        <EmptyState title="Não foi possível carregar apresentadores" description={presentersState.errorMessage} tone="warning" />
      ) : null}

      {!presentersState.isLoading && !presentersState.errorMessage ? (
        <div className="grid gap-4 md:grid-cols-3">
          {presentersState.data.map((p) => <PresenterCard key={p.id} presenter={p} />)}
        </div>
      ) : null}
    </div>
  );
}
