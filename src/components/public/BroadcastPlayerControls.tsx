import type { SyntheticEvent } from 'react';
import { Maximize2, Minimize2, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BroadcastPlayerControlsProps {
  isMuted: boolean;
  isFullscreen: boolean;
  onToggleMute: () => void;
  onToggleFullscreen?: () => void;
  className?: string;
}

export function BroadcastPlayerControls({
  isMuted,
  isFullscreen,
  onToggleMute,
  onToggleFullscreen,
  className
}: BroadcastPlayerControlsProps) {
  const stopPlaybackGesture = (event: SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className={cn('absolute right-3 top-3 z-30 flex items-center gap-2', className)}>
      <button
        type="button"
        aria-label={isMuted ? 'Ativar som' : 'Inativar som'}
        title={isMuted ? 'Ativar som' : 'Inativar som'}
        aria-pressed={!isMuted}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-black/70 text-white shadow-sm transition hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        onPointerDown={stopPlaybackGesture}
        onClick={(event) => {
          stopPlaybackGesture(event);
          onToggleMute();
        }}
      >
        {isMuted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
      </button>

      {onToggleFullscreen ? (
        <button
          type="button"
          aria-label={isFullscreen ? 'Sair da tela cheia' : 'Expandir tela'}
          title={isFullscreen ? 'Sair da tela cheia' : 'Expandir tela'}
          aria-pressed={isFullscreen}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-black/70 text-white shadow-sm transition hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          onPointerDown={stopPlaybackGesture}
          onClick={(event) => {
            stopPlaybackGesture(event);
            onToggleFullscreen();
          }}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" aria-hidden="true" /> : <Maximize2 className="h-4 w-4" aria-hidden="true" />}
        </button>
      ) : null}
    </div>
  );
}
