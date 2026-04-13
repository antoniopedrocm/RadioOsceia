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
            title="Dados indisponíveis no momento"
            description={`${errorMessage} Verifique se o Firestore está acessível.`}
            tone="warning"
            compact
          />
        ) : data === null ? (
          <EmptyState title="Nenhuma transmissão no momento" compact />
        ) : (
          <>
            <h3 className="font-semibold">{data.title}</h3>
            <p className="text-sm text-muted-foreground">{`${data.media.title} • ${data.media.sourceType}`}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
