import { useState } from 'react';
import { motion } from 'framer-motion';
import { Volume2, Play, Pause, SkipForward, Radio } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useNowPlaying, useUpcomingQueue } from '@/hooks/useRadioData';

export function FloatingPlayer() {
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(true);
  const { data: nowPlaying } = useNowPlaying();
  const { data: upNext } = useUpcomingQueue();
  const hasActiveMedia = nowPlaying?.media != null;
  const currentTitle = nowPlaying?.media?.title ?? nowPlaying?.title ?? 'Nenhuma transmissão no momento';
  const currentSource = nowPlaying?.media?.sourceType ?? 'Fonte indisponível';
  const nextItem = upNext[0];

  return (
    <motion.div layout className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur">
      <div className="mx-auto max-w-7xl p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=200" alt="capa" className="h-12 w-12 rounded-md object-cover" />
            <div>
              <p className="text-sm font-semibold">{currentTitle}</p>
              <p className="text-xs text-muted-foreground">{currentSource}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setPlaying(!playing)} disabled={!hasActiveMedia}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="ghost" disabled={!hasActiveMedia}>
              <SkipForward className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost"><Volume2 className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => setExpanded(!expanded)}>{expanded ? 'Compactar' : 'Expandir'}</Button>
          </div>
        </div>
        <Progress value={42} />
        {expanded && (
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Radio className="h-3 w-3 text-destructive" />
              {hasActiveMedia ? 'Ao vivo agora' : 'Sem transmissão ativa'}
            </span>
            <span>{hasActiveMedia ? ['Origem:', currentSource].join(' ') : (nextItem ? ['Próxima:', nextItem.title].join(' ') : 'Sem próximos conteúdos')}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
