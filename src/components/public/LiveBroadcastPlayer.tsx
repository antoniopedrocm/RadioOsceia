import { useEffect, useMemo, useRef } from 'react';
import type { NowPlayingResponse } from '@/types/api';
import { getYouTubeVideoId } from '@/lib/youtube';
import { ControlledYouTubePlayer } from '@/components/public/ControlledYouTubePlayer';

interface LiveBroadcastPlayerProps {
  nowPlaying: NowPlayingResponse['nowPlaying'] | null;
  broadcastStrictMode?: boolean;
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

  useEffect(() => {
    const mediaElement = mediaRef.current;
    if (!mediaElement) {
      return;
    }

    mediaElement.load();
    mediaElement.play().catch(() => undefined);
  }, [playbackKey]);

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
    muted: false,
    controls: !broadcastStrictMode,
    disablePictureInPicture: broadcastStrictMode,
    controlsList: broadcastStrictMode ? 'nodownload noplaybackrate nofullscreen' : undefined,
    preload: type === 'audio' ? 'none' : 'metadata',
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

  return type === 'audio' ? (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <audio ref={(node) => (mediaRef.current = node)} {...sharedProps} title={title} className="w-full" />
  ) : (
    <video ref={(node) => (mediaRef.current = node)} {...sharedProps} title={title} className="aspect-video w-full rounded-md bg-black" />
  );
}

export function LiveBroadcastPlayer({ nowPlaying, broadcastStrictMode = true }: LiveBroadcastPlayerProps) {
  const media = nowPlaying?.media;

  const playbackKey = useMemo(() => {
    if (!media) {
      return 'empty';
    }

    return [media.id, media.youtubeVideoId, media.publicUrl, media.embedUrl].filter(Boolean).join(':');
  }, [media]);

  if (!media) {
    return <p className="text-xs text-muted-foreground">Nenhuma mídia disponível para transmissão.</p>;
  }

  const youtubeId = getYouTubeVideoId(media.youtubeVideoId ?? '') ?? getYouTubeVideoId(media.youtubeUrl ?? '') ?? getYouTubeVideoId(media.embedUrl ?? '');

  if (media.sourceType === 'YOUTUBE' && youtubeId) {
    return <ControlledYouTubePlayer key={playbackKey} title={media.title} videoIdOrUrl={youtubeId} broadcastStrictMode={broadcastStrictMode} />;
  }

  if (media.publicUrl) {
    return (
      <HtmlBroadcastPlayer
        key={playbackKey}
        src={media.publicUrl}
        title={media.title}
        type={isAudioMedia(media.mediaType) ? 'audio' : 'video'}
        playbackKey={playbackKey}
        broadcastStrictMode={broadcastStrictMode}
      />
    );
  }

  return <p className="text-xs text-muted-foreground">Formato de mídia atual não possui fonte reproduzível.</p>;
}
