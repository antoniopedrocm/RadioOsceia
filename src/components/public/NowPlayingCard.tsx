import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, LoadingState } from '@/components/shared/LoadableMessage';
import { useNowPlaying } from '@/hooks/useRadioData';
import { LiveBroadcastPlayer } from '@/components/public/LiveBroadcastPlayer';

export function NowPlayingCard() {
  const { data, isLoading, errorMessage, reload } = useNowPlaying();

  useEffect(() => {
    const timer = window.setInterval(() => {
      reload();
    }, 30_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [reload]);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Badge className="w-fit bg-emerald-600 text-white">TRANSMISSÃO AO VIVO</Badge>
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
        </div>

        {isLoading ? (
          <LoadingState title="Carregando transmissão atual" description="Buscando o conteúdo que está no ar agora." compact />
        ) : errorMessage ? (
          <EmptyState
            title="Dados indisponíveis no momento"
            description={`${errorMessage} Verifique se o Firestore está acessível.`}
            tone="warning"
            compact
          />
        ) : data === null ? (
          <EmptyState title="Nenhuma transmissão no momento" compact />
        ) : (
          <>
            <LiveBroadcastPlayer nowPlaying={data} broadcastStrictMode />
            <h3 className="font-semibold">{data?.media?.title ?? data?.title ?? 'Nenhuma transmissão no momento'}</h3>
            <p className="text-sm text-muted-foreground">Conteúdo institucional em reprodução automática</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
