import { useEffect, useMemo, useRef, useState } from 'react';
import { getYouTubeVideoId } from '@/lib/youtube';

declare global {
  interface Window {
    YT?: {
      Player: new (elementId: string | HTMLElement, options: YTPlayerOptions) => YTPlayer;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayer {
  destroy: () => void;
  playVideo: () => void;
  unMute: () => void;
  mute: () => void;
}

interface YTPlayerEvent {
  target: YTPlayer;
  data: number;
}

interface YTPlayerOptions {
  videoId: string;
  playerVars: Record<string, number>;
  events: {
    onReady: (event: YTPlayerEvent) => void;
    onStateChange: (event: YTPlayerEvent) => void;
  };
}

interface ControlledYouTubePlayerProps {
  title: string;
  videoIdOrUrl: string;
  broadcastStrictMode?: boolean;
}

let youtubeApiPromise: Promise<void> | null = null;

function ensureYoutubeApi() {
  if (window.YT?.Player) {
    return Promise.resolve();
  }

  if (youtubeApiPromise) {
    return youtubeApiPromise;
  }

  youtubeApiPromise = new Promise<void>((resolve) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');

    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.body.appendChild(script);
    }

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };

    window.setTimeout(() => {
      if (window.YT?.Player) {
        resolve();
      }
    }, 1_500);
  });

  return youtubeApiPromise;
}

function shouldBlockKey(key: string) {
  return [' ', 'Spacebar', 'k', 'K', 'j', 'J', 'l', 'L', 'ArrowLeft', 'ArrowRight'].includes(key);
}

export function ControlledYouTubePlayer({ title, videoIdOrUrl, broadcastStrictMode = true }: ControlledYouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const containerId = useMemo(() => `yt-broadcast-${Math.random().toString(36).slice(2)}`, []);
  const videoId = useMemo(() => getYouTubeVideoId(videoIdOrUrl), [videoIdOrUrl]);

  if (import.meta.env.DEV) {
    console.debug('[ControlledYouTubePlayer]', { videoId, videoIdOrUrl, broadcastStrictMode });
  }

  useEffect(() => {
    if (!videoId || !containerRef.current) {
      return;
    }

    let active = true;
    setIsPlayerReady(false);

    ensureYoutubeApi().then(() => {
      if (!active || !window.YT?.Player || !containerRef.current) {
        return;
      }

      playerRef.current?.destroy();
      playerRef.current = new window.YT.Player(containerId, {
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          fs: 0,
          playsinline: 1,
          mute: 1
        },
        events: {
          onReady: (event) => {
            setIsPlayerReady(true);
            event.target.mute();
            event.target.playVideo();

            if (!broadcastStrictMode) {
              event.target.unMute();
            }
          },
          onStateChange: (event) => {
            if (!broadcastStrictMode) {
              return;
            }

            const state = event.data;
            const ytState = window.YT?.PlayerState;

            if (!ytState) {
              return;
            }

            if (state === ytState.PAUSED || state === ytState.CUED || state === ytState.ENDED) {
              event.target.playVideo();
            }
          }
        }
      });
    });

    return () => {
      active = false;
      playerRef.current?.destroy();
      playerRef.current = null;
      setIsPlayerReady(false);
    };
  }, [broadcastStrictMode, containerId, videoId]);

  useEffect(() => {
    if (!broadcastStrictMode) {
      return;
    }

    const blockKeyboard = (event: KeyboardEvent) => {
      if (shouldBlockKey(event.key)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('keydown', blockKeyboard, { capture: true });

    return () => {
      window.removeEventListener('keydown', blockKeyboard, { capture: true });
    };
  }, [broadcastStrictMode]);

  if (!videoId) {
    return <p className="text-xs text-muted-foreground">ID de vídeo do YouTube inválido para transmissão.</p>;
  }

  return (
    <div
      className="relative overflow-hidden rounded-xl border bg-black"
      onContextMenu={(event) => event.preventDefault()}
      onKeyDownCapture={(event) => {
        if (broadcastStrictMode && shouldBlockKey(event.key)) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <div ref={containerRef} className="aspect-video w-full" id={containerId} aria-label={title} />
      {broadcastStrictMode && isPlayerReady ? <div className="absolute inset-0 z-10 cursor-default bg-transparent" aria-hidden="true" /> : null}
    </div>
  );
}
