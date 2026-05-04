import { useEffect, useMemo, useRef, useState } from 'react';
import type { NowPlayingResponse } from '@/types/api';
import { getYouTubeVideoId } from '@/lib/youtube';
import { ControlledYouTubePlayer, type YouTubePlayerDiagnostics } from '@/components/public/ControlledYouTubePlayer';
import { BroadcastPlayerControls } from '@/components/public/BroadcastPlayerControls';

interface LiveBroadcastPlayerProps {
  nowPlaying: NowPlayingResponse['nowPlaying'] | null;
  broadcastStrictMode?: boolean;
  debugMode?: boolean;
}

interface HtmlBroadcastPlayerProps {
  src: string;
  title: string;
  type: 'audio' | 'video';
  playbackKey: string;
  scheduledStartAt?: string | null;
  initialStartSeconds?: number;
  broadcastStrictMode: boolean;
}

function isAudioMedia(mediaType: string) {
  return mediaType.toUpperCase() === 'AUDIO';
}

function shouldBlockKey(key: string) {
  return [' ', 'Spacebar', 'k', 'K', 'j', 'J', 'l', 'L', 'f', 'F', 'm', 'M', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key);
}

function containsYouTubeUrl(value?: string | null) {
  if (!value) {
    return false;
  }

  return /(?:youtube\.com|youtu\.be)/i.test(value);
}

function isDirectFilePlaybackUrl(value?: string | null) {
  if (!value) {
    return false;
  }

  const pathname = value.split('?')[0]?.toLowerCase() ?? '';
  return ['.mp4', '.webm', '.mp3', '.m4a'].some((extension) => pathname.endsWith(extension));
}

function resolveInitialStartSeconds(scheduledStartAt?: string | null, fallbackSeconds = 0) {
  const scheduledStartMs = scheduledStartAt ? Date.parse(scheduledStartAt) : Number.NaN;
  if (Number.isFinite(scheduledStartMs)) {
    return Math.max(0, Math.floor((Date.now() - scheduledStartMs) / 1000));
  }

  return Math.max(0, Math.floor(fallbackSeconds));
}

function normalizePlaybackInstant(value?: string | null) {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? String(Math.floor(timestamp / 1000)) : '';
}

function HtmlBroadcastPlayer({
  src,
  title,
  type,
  playbackKey,
  scheduledStartAt,
  initialStartSeconds = 0,
  broadcastStrictMode
}: HtmlBroadcastPlayerProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const lastAllowedTimeRef = useRef(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const mediaElement = mediaRef.current;
    if (!mediaElement) {
      return;
    }

    const startSeconds = resolveInitialStartSeconds(scheduledStartAt, initialStartSeconds);
    lastAllowedTimeRef.current = startSeconds;
    mediaElement.load();
    mediaElement.muted = isMuted;
    if (startSeconds > 0) {
      try {
        mediaElement.currentTime = startSeconds;
      } catch {
        const seekOnMetadata = () => {
          mediaElement.currentTime = startSeconds;
        };
        mediaElement.addEventListener('loadedmetadata', seekOnMetadata, { once: true });
      }
    }
    mediaElement
      .play()
      .then(() => {
        setPlaybackError(null);
        if (!broadcastStrictMode) {
          mediaElement.muted = false;
          setIsMuted(false);
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Falha ao iniciar reprodução automática.';
        setPlaybackError(message);
      });
  }, [broadcastStrictMode, playbackKey]);

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === wrapperRef.current);
    };

    document.addEventListener('fullscreenchange', syncFullscreenState);

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
    };
  }, []);

  const handleToggleMute = () => {
    setIsMuted((current) => {
      const nextMuted = !current;
      if (mediaRef.current) {
        mediaRef.current.muted = nextMuted;
        mediaRef.current.play().catch(() => undefined);
      }
      return nextMuted;
    });
  };

  const handleToggleFullscreen = () => {
    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return;
    }

    if (document.fullscreenElement === wrapper) {
      document.exitFullscreen().catch(() => undefined);
      return;
    }

    wrapper.requestFullscreen().catch(() => undefined);
  };

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

  const sharedProps = {
    src,
    autoPlay: true,
    muted: isMuted,
    playsInline: true,
    controls: !broadcastStrictMode,
    disablePictureInPicture: broadcastStrictMode,
    controlsList: broadcastStrictMode ? 'nodownload noplaybackrate nofullscreen' : undefined,
    preload: 'auto',
    onLoadedData: () => {
      if (!broadcastStrictMode && mediaRef.current) {
        mediaRef.current.muted = false;
      }
    },
    onPause: () => {
      if (!broadcastStrictMode) {
        return;
      }
      mediaRef.current?.play().catch(() => undefined);
    },
    onSeeking: () => {
      if (!broadcastStrictMode || !mediaRef.current) {
        return;
      }
      mediaRef.current.currentTime = lastAllowedTimeRef.current;
    },
    onTimeUpdate: () => {
      if (!mediaRef.current) {
        return;
      }
      lastAllowedTimeRef.current = mediaRef.current.currentTime;
    },
    onContextMenu: (event: { preventDefault: () => void }) => event.preventDefault(),
    onClick: (event: { preventDefault: () => void; stopPropagation: () => void }) => {
      if (!broadcastStrictMode) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      mediaRef.current?.play().catch(() => undefined);
    },
    onKeyDownCapture: (event: { key: string; preventDefault: () => void; stopPropagation: () => void }) => {
      if (broadcastStrictMode && shouldBlockKey(event.key)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
  } as const;

  return (
    <div className="space-y-1">
      <div ref={wrapperRef} className={type === 'video' ? 'relative aspect-video overflow-hidden rounded-xl bg-black' : 'relative rounded-xl bg-black/5 p-3'}>
        {type === 'audio' ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <audio ref={(node) => (mediaRef.current = node)} {...sharedProps} title={title} className="w-full pt-10" />
        ) : (
          <video ref={(node) => (mediaRef.current = node)} {...sharedProps} title={title} className="h-full w-full bg-black object-contain" />
        )}
        <BroadcastPlayerControls
          isMuted={isMuted}
          isFullscreen={isFullscreen}
          onToggleMute={handleToggleMute}
          onToggleFullscreen={type === 'video' ? handleToggleFullscreen : undefined}
        />
      </div>
      {playbackError ? <p className="text-xs text-red-600">{playbackError}</p> : null}
    </div>
  );
}


export function LiveBroadcastPlayer({ nowPlaying, broadcastStrictMode = true, debugMode = false }: LiveBroadcastPlayerProps) {
  const media = nowPlaying?.media;
  const [forcePublicTestVideo, setForcePublicTestVideo] = useState(false);
  const [diagnostics, setDiagnostics] = useState<YouTubePlayerDiagnostics>({
    playerReady: false,
    playerState: null,
    errorCode: null,
    usingFallbackIframe: false,
    errorMessage: null
  });

  const playbackKey = useMemo(() => {
    if (!media) {
      return 'empty';
    }

    return [
      media.id,
      nowPlaying?.itemId,
      normalizePlaybackInstant(nowPlaying?.startedAt),
      media.youtubeVideoId,
      media.publicUrl,
      media.embedUrl,
      String(forcePublicTestVideo)
    ].filter(Boolean).join(':');
  }, [forcePublicTestVideo, media, nowPlaying?.itemId, nowPlaying?.startedAt]);

  if (!media) {
    return <p className="text-xs text-muted-foreground">Nenhuma mídia disponível para transmissão.</p>;
  }

  const resolvedYoutubeId =
    getYouTubeVideoId(media.youtubeVideoId ?? '') ?? getYouTubeVideoId(media.youtubeUrl ?? '') ?? getYouTubeVideoId(media.embedUrl ?? '') ?? getYouTubeVideoId(media.publicUrl ?? '');

  const isYoutubeMedia =
    media.sourceType === 'YOUTUBE' ||
    containsYouTubeUrl(media.youtubeUrl) ||
    containsYouTubeUrl(media.embedUrl) ||
    containsYouTubeUrl(media.publicUrl) ||
    containsYouTubeUrl(media.youtubeVideoId);

  const youtubeId = forcePublicTestVideo ? 'dQw4w9WgXcQ' : resolvedYoutubeId;
  const embedUrl = youtubeId ? `https://www.youtube.com/embed/${youtubeId}` : null;

  return (
    <div className="space-y-2">
      {isYoutubeMedia && youtubeId ? (
        <ControlledYouTubePlayer
          key={playbackKey}
          title={media.title}
          videoIdOrUrl={youtubeId}
          scheduledStartAt={nowPlaying?.startedAt ?? null}
          initialStartSeconds={nowPlaying?.playbackOffsetSeconds ?? 0}
          broadcastStrictMode={broadcastStrictMode}
          onDiagnosticsChange={setDiagnostics}
        />
      ) : media.publicUrl && isDirectFilePlaybackUrl(media.publicUrl) ? (
        <HtmlBroadcastPlayer
          key={playbackKey}
          src={media.publicUrl}
          title={media.title}
          type={isAudioMedia(media.mediaType) ? 'audio' : 'video'}
          playbackKey={playbackKey}
          scheduledStartAt={nowPlaying?.startedAt ?? null}
          initialStartSeconds={nowPlaying?.playbackOffsetSeconds ?? 0}
          broadcastStrictMode={broadcastStrictMode}
        />
      ) : (
        <p className="text-xs text-muted-foreground">Formato de mídia atual não possui fonte reproduzível.</p>
      )}

      {debugMode ? (
        <div className="rounded-md border border-amber-400/40 bg-amber-50/70 p-2 text-xs text-amber-900">
          <p>
            <strong>VIDEO ID:</strong> {youtubeId ?? 'null'}
          </p>
          <p>
            <strong>SOURCE TYPE:</strong> {media.sourceType}
          </p>
          <p>
            <strong>YOUTUBE URL:</strong> {media.youtubeUrl ?? 'null'}
          </p>
          <p>
            <strong>EMBED URL:</strong> {embedUrl ?? media.embedUrl ?? 'null'}
          </p>
          <p>
            <strong>READY:</strong> {String(diagnostics.playerReady)}
          </p>
          <p>
            <strong>STATE:</strong> {diagnostics.playerState ?? 'null'}
          </p>
          <p>
            <strong>ERROR:</strong> {diagnostics.errorCode ?? 'null'}
          </p>
          <p>
            <strong>FALLBACK IFRAME:</strong> {String(diagnostics.usingFallbackIframe)}
          </p>
          {diagnostics.errorMessage ? <p className="font-medium text-red-700">{diagnostics.errorMessage}</p> : null}
          <button
            type="button"
            className="mt-2 rounded border border-amber-600 px-2 py-1 text-xs font-medium"
            onClick={() => setForcePublicTestVideo((value) => !value)}
          >
            {forcePublicTestVideo ? 'Voltar para mídia cadastrada' : 'Testar vídeo público conhecido'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
