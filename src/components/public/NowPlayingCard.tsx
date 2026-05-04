import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, LoadingState } from '@/components/shared/LoadableMessage';
import { useNowPlayingResponse } from '@/hooks/useRadioData';
import { LiveBroadcastPlayer } from '@/components/public/LiveBroadcastPlayer';
import { cn } from '@/lib/utils';
import type { NowPlayingResponse } from '@/types/api';

function getNextReloadDelayMs(targets: Array<string | null | undefined>) {
  const now = Date.now();
  const nextTarget = targets
    .map((value) => (value ? Date.parse(value) : Number.NaN))
    .filter((value) => Number.isFinite(value) && value > now)
    .sort((a, b) => a - b)[0];

  if (!nextTarget) {
    return null;
  }

  return Math.max(250, nextTarget - now + 250);
}

function isVideoTransmission(data: NowPlayingResponse['nowPlaying']) {
  if (!data?.media) {
    return false;
  }

  return data.media.mediaType.toUpperCase() !== 'AUDIO' || data.media.sourceType.toUpperCase() === 'YOUTUBE';
}

export function NowPlayingCard() {
  const { data, isLoading, errorMessage, reload } = useNowPlayingResponse();
  const nowPlaying = data.nowPlaying;
  const videoTransmission = isVideoTransmission(nowPlaying);
  const showInitialLoading = isLoading && nowPlaying === null && data.upNext.length === 0;
  const showBlockingError = errorMessage && nowPlaying === null;

  useEffect(() => {
    const timer = window.setInterval(() => {
      reload();
    }, 30_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [reload]);

  useEffect(() => {
    const delayMs = getNextReloadDelayMs([nowPlaying?.endsAt, data.upNext[0]?.startsAt]);
    if (delayMs === null) {
      return;
    }

    const timer = window.setTimeout(() => {
      reload();
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [data.upNext, nowPlaying?.endsAt, reload]);

  return (
    <Card className={cn(videoTransmission && 'border-red-500 shadow-red-100 ring-2 ring-red-500/40')}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Badge className={cn('w-fit text-white', videoTransmission ? 'bg-red-600' : 'bg-emerald-600')}>TRANSMISSÃO AO VIVO</Badge>
          <span className={cn('h-2 w-2 rounded-full', videoTransmission ? 'bg-red-500' : 'bg-emerald-500')} aria-hidden="true" />
        </div>

        {showInitialLoading ? (
          <LoadingState title="Carregando transmissão atual" description="Buscando o conteúdo que está no ar agora." compact />
        ) : showBlockingError ? (
          <EmptyState
            title="Dados indisponíveis no momento"
            description={`${errorMessage} Verifique se o Firestore está acessível.`}
            tone="warning"
            compact
          />
        ) : nowPlaying === null ? (
          <EmptyState title="Nenhuma transmissão no momento" compact />
        ) : (
          <>
            <LiveBroadcastPlayer nowPlaying={nowPlaying} broadcastStrictMode debugMode={import.meta.env.DEV} />
            <h3 className="font-semibold">{nowPlaying?.media?.title ?? nowPlaying?.title ?? 'Nenhuma transmissão no momento'}</h3>
            <p className="text-sm text-muted-foreground">Conteúdo institucional em reprodução automática</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
