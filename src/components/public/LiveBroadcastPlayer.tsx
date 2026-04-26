import { useEffect, useMemo, useRef, useState } from 'react';
import type { NowPlayingResponse } from '@/types/api';
import { getYouTubeVideoId } from '@/lib/youtube';
import { ControlledYouTubePlayer, type YouTubePlayerDiagnostics } from '@/components/public/ControlledYouTubePlayer';

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
  broadcastStrictMode: boolean;
}

function isAudioMedia(mediaType: string) {
  return mediaType.toUpperCase() === 'AUDIO';
}

function shouldBlockKey(key: string) {
  return [' ', 'Spacebar', 'k', 'K', 'j', 'J', 'l', 'L', 'ArrowLeft', 'ArrowRight'].includes(key);
}

function HtmlBroadcastPlayer({ src, title, type, playbackKey, broadcastStrictMode }: HtmlBroadcastPlayerProps) {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const lastAllowedTimeRef = useRef(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  useEffect(() => {
    const mediaElement = mediaRef.current;
    if (!mediaElement) {
      return;
    }

    mediaElement.load();
    mediaElement
      .play()
      .then(() => {
        setPlaybackError(null);
        if (!broadcastStrictMode) {
          mediaElement.muted = false;
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Falha ao iniciar reprodução automática.';
        setPlaybackError(message);
      });
  }, [broadcastStrictMode, playbackKey]);

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
    muted: true,
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
      {type === 'audio' ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio ref={(node) => (mediaRef.current = node)} {...sharedProps} title={title} className="w-full" />
      ) : (
        <video ref={(node) => (mediaRef.current = node)} {...sharedProps} title={title} className="aspect-video w-full rounded-md bg-black" />
      )}
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

    return [media.id, media.youtubeVideoId, media.publicUrl, media.embedUrl, String(forcePublicTestVideo)].filter(Boolean).join(':');
  }, [forcePublicTestVideo, media]);

  if (!media) {
    return <p className="text-xs text-muted-foreground">Nenhuma mídia disponível para transmissão.</p>;
  }

  const resolvedYoutubeId =
    getYouTubeVideoId(media.youtubeVideoId ?? '') ?? getYouTubeVideoId(media.youtubeUrl ?? '') ?? getYouTubeVideoId(media.embedUrl ?? '');

  const youtubeId = forcePublicTestVideo ? 'dQw4w9WgXcQ' : resolvedYoutubeId;
  const embedUrl = youtubeId ? `https://www.youtube.com/embed/${youtubeId}` : null;

  return (
    <div className="space-y-2">
      {media.sourceType === 'YOUTUBE' && youtubeId ? (
        <ControlledYouTubePlayer
          key={playbackKey}
          title={media.title}
          videoIdOrUrl={youtubeId}
          broadcastStrictMode={broadcastStrictMode}
          onDiagnosticsChange={setDiagnostics}
        />
      ) : media.publicUrl ? (
        <HtmlBroadcastPlayer
          key={playbackKey}
          src={media.publicUrl}
          title={media.title}
          type={isAudioMedia(media.mediaType) ? 'audio' : 'video'}
          playbackKey={playbackKey}
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
