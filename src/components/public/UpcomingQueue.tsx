import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, LoadingState } from '@/components/shared/LoadableMessage';
import { useUpcomingQueue } from '@/hooks/useRadioData';

export function UpcomingQueue() {
  const { data: items, isLoading, errorMessage } = useUpcomingQueue();

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h3 className="font-semibold">Em seguida</h3>

        {isLoading ? (
          <LoadingState title="Carregando próximos itens" description="Consultando a fila de reprodução." compact />
        ) : errorMessage ? (
          <EmptyState
            title="Não foi possível carregar os dados"
            description={`${errorMessage} Verifique se o Firestore está disponível.`}
            tone="warning"
            compact
          />
        ) : items.length ? (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between rounded-md bg-muted p-2 text-sm">
                <span>{item.title}</span>
                <span>{item.startTime}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Sem próximos itens" description="A fila pública ainda não possui conteúdos agendados." compact />
        )}
      </CardContent>
    </Card>
  );
}
