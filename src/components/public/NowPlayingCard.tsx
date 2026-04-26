import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, LoadingState } from '@/components/shared/LoadableMessage';
import { useNowPlaying } from '@/hooks/useRadioData';
import { getYouTubeVideoId } from '@/lib/youtube';

function resolveNowPlayingVideoId(data: ReturnType<typeof useNowPlaying>['data']) {
  if (!data) {
    return null;
  }

  return (
    getYouTubeVideoId(data.media?.youtubeVideoId ?? '') ??
    getYouTubeVideoId(data.media?.embedUrl ?? '') ??
    getYouTubeVideoId(data.media?.youtubeUrl ?? '')
  );
}

function isNowPlayingYouTube(data: ReturnType<typeof useNowPlaying>['data']) {
  if (!data) {
    return false;
  }

  const sourceType = data.media?.sourceType?.toUpperCase();
  const source = data.source?.toLowerCase();
  const hasYoutubeFields = Boolean(data.media?.youtubeUrl || data.media?.embedUrl || data.media?.youtubeVideoId);

  return hasYoutubeFields || sourceType === 'YOUTUBE' || source === 'youtube';
}

export function NowPlayingCard() {
  const { data, isLoading, errorMessage } = useNowPlaying();
  const isYouTube = isNowPlayingYouTube(data);
  const videoId = resolveNowPlayingVideoId(data);

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
            {isYouTube && videoId ? (
              <div className="aspect-video overflow-hidden rounded-xl bg-black">
                <iframe
                  title={data.title}
                  src={`https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&rel=0`}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full rounded-xl"
                />
              </div>
            ) : null}
            <h3 className="font-semibold">{data?.media?.title ?? data?.title ?? 'Nenhuma transmissão no momento'}</h3>
            <p className="text-sm text-muted-foreground">{data?.media?.sourceType ?? 'Fonte indisponível'}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
