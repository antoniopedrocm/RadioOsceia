import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, LoadingState } from '@/components/shared/LoadableMessage';
import { useNowPlaying } from '@/hooks/useRadioData';

export function NowPlayingCard() {
  const { data, isLoading, errorMessage } = useNowPlaying();

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <Badge className="w-fit bg-success text-white">Ao vivo agora</Badge>

        {isLoading ? (
          <LoadingState title="Carregando transmissão atual" description="Buscando o conteúdo que está no ar agora." compact />
        ) : errorMessage ? (
          <EmptyState
            title="Servidor indisponível no momento"
            description={`${errorMessage} Verifique se o Firebase Emulator Suite está ativo.`}
            tone="warning"
            compact
          />
        ) : (
          <>
            <h3 className="font-semibold">{data?.title ?? 'Sem conteúdo no ar'}</h3>
            <p className="text-sm text-muted-foreground">
              {data ? `${data.media.title} • ${data.media.sourceType}` : 'Aguardando programação'}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
