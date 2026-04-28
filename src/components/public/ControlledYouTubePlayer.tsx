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

interface YTPlayerErrorEvent {
  target: YTPlayer;
  data: number;
}

interface YTPlayerOptions {
  videoId: string;
  playerVars: Record<string, number>;
  events: {
    onReady: (event: YTPlayerEvent) => void;
    onStateChange: (event: YTPlayerEvent) => void;
    onError: (event: YTPlayerErrorEvent) => void;
  };
}

export interface YouTubePlayerDiagnostics {
  playerReady: boolean;
  playerState: number | null;
  errorCode: number | null;
  usingFallbackIframe: boolean;
  errorMessage: string | null;
}

interface ControlledYouTubePlayerProps {
  title: string;
  videoIdOrUrl: string;
  broadcastStrictMode?: boolean;
  debugMode?: boolean;
  onDiagnosticsChange?: (diagnostics: YouTubePlayerDiagnostics) => void;
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
  return [' ', 'Spacebar', 'k', 'K', 'j', 'J', 'l', 'L', 'f', 'F', 'm', 'M', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key);
}

function getYouTubeErrorMessage(errorCode: number | null) {
  switch (errorCode) {
    case 2:
      return 'Parâmetro inválido para o player do YouTube (erro 2).';
    case 5:
      return 'Falha no player HTML5 do YouTube (erro 5).';
    case 100:
      return 'Vídeo removido ou privado (erro 100).';
    case 101:
    case 150:
      return 'Este vídeo não permite reprodução incorporada. Escolha outra mídia.';
    default:
      return null;
  }
}

export function ControlledYouTubePlayer({
  title,
  videoIdOrUrl,
  broadcastStrictMode = true,
  onDiagnosticsChange
}: ControlledYouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [playerState, setPlayerState] = useState<number | null>(null);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [usingFallbackIframe, setUsingFallbackIframe] = useState(false);
  const playerReadyRef = useRef(false);
  const containerId = useMemo(() => `yt-broadcast-${Math.random().toString(36).slice(2)}`, []);
  const videoId = useMemo(() => getYouTubeVideoId(videoIdOrUrl), [videoIdOrUrl]);

  const errorMessage = useMemo(() => getYouTubeErrorMessage(errorCode), [errorCode]);

  useEffect(() => {
    onDiagnosticsChange?.({
      playerReady: isPlayerReady,
      playerState,
      errorCode,
      usingFallbackIframe,
      errorMessage
    });
  }, [errorCode, errorMessage, isPlayerReady, onDiagnosticsChange, playerState, usingFallbackIframe]);

  useEffect(() => {
    if (!videoId || !containerRef.current) {
      return;
    }

    let active = true;
    setIsPlayerReady(false);
    playerReadyRef.current = false;
    setPlayerState(null);
    setErrorCode(null);
    setUsingFallbackIframe(false);

    const fallbackTimer = window.setTimeout(() => {
      if (active && !playerReadyRef.current) {
        setUsingFallbackIframe(true);
      }
    }, 5_000);

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
          fs: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          mute: 1
        },
        events: {
          onReady: (event) => {
            setIsPlayerReady(true);
            playerReadyRef.current = true;
            setUsingFallbackIframe(false);
            event.target.mute();
            event.target.playVideo();

            if (!broadcastStrictMode) {
              event.target.unMute();
            }
          },
          onStateChange: (event) => {
            setPlayerState(event.data);

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
          },
          onError: (event) => {
            setErrorCode(event.data);
            if (event.data === 2 || event.data === 5) {
              setUsingFallbackIframe(true);
            }
          }
        }
      });
    });

    return () => {
      active = false;
      window.clearTimeout(fallbackTimer);
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
      className="relative aspect-video w-full overflow-hidden rounded-xl"
      onContextMenu={(event) => event.preventDefault()}
      onKeyDownCapture={(event) => {
        if (broadcastStrictMode && shouldBlockKey(event.key)) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      {usingFallbackIframe ? (
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&disablekb=1&fs=0&rel=0&playsinline=1`}
          className="absolute inset-0 h-full w-full"
          allow="autoplay; encrypted-media; fullscreen"
          allowFullScreen
          title={title}
        />
      ) : (
        <div ref={containerRef} className="absolute inset-0 h-full w-full" id={containerId} aria-label={title} />
      )}

      {broadcastStrictMode ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-10 bg-transparent"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            playerRef.current?.playVideo();
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        />
      ) : null}
    </div>
  );
}
