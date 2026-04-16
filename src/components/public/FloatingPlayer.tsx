import { useState } from 'react';
import { motion } from 'framer-motion';
import { Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNowPlaying, useUpcomingQueue } from '@/hooks/useRadioData';
import { MediaPlayer } from '@/components/public/MediaPlayer';

export function FloatingPlayer() {
  const [expanded, setExpanded] = useState(false);
  const { data: nowPlaying } = useNowPlaying();
  const { data: upNext } = useUpcomingQueue();

  const hasActiveMedia = nowPlaying?.media != null;
  const currentTitle = nowPlaying?.media?.title ?? nowPlaying?.title ?? 'Nenhuma transmissão no momento';
  const currentSource = nowPlaying?.media?.sourceType ?? nowPlaying?.source ?? 'Fonte indisponível';
  const nextItem = upNext[0];

  return (
    <motion.div layout className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur">
      <div className="mx-auto max-w-7xl space-y-3 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=200"
              alt="capa"
              className="h-12 w-12 rounded-md object-cover"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{currentTitle}</p>
              <p className="truncate text-xs text-muted-foreground">{currentSource}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setExpanded((value) => !value)}>
            {expanded ? 'Compactar' : 'Expandir'}
          </Button>
        </div>

        {expanded && (
          <>
            <MediaPlayer nowPlaying={nowPlaying} />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Radio className="h-3 w-3 text-destructive" />
                {hasActiveMedia ? 'Ao vivo agora' : 'Sem transmissão ativa'}
              </span>
              <span>
                {hasActiveMedia
                  ? ['Origem:', currentSource].join(' ')
                  : (nextItem ? ['Próxima:', nextItem.title].join(' ') : 'Sem próximos conteúdos')}
              </span>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
