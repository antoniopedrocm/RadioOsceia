import type { NowPlayingResponse } from '@/types/api';

interface MediaPlayerProps {
  nowPlaying: NowPlayingResponse['nowPlaying'] | null;
}

function isAudioMedia(mediaType: string) {
  return mediaType.toUpperCase() === 'AUDIO';
}

export function MediaPlayer({ nowPlaying }: MediaPlayerProps) {
  const media = nowPlaying?.media;

  if (!media) {
    return <p className="text-xs text-muted-foreground">Nenhuma mídia disponível para reprodução.</p>;
  }

  if (media.sourceType === 'YOUTUBE' && media.youtubeVideoId) {
    const youtubeUrl = `https://www.youtube.com/embed/${media.youtubeVideoId}`;

    return (
      <div className="overflow-hidden rounded-md border bg-black/90">
        <iframe
          title={media.title}
          src={youtubeUrl}
          className="aspect-video w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  if (media.publicUrl) {
    if (isAudioMedia(media.mediaType)) {
      return <audio controls src={media.publicUrl} className="w-full" preload="none" />;
    }

    return <video controls src={media.publicUrl} className="aspect-video w-full rounded-md bg-black" preload="metadata" />;
  }

  return <p className="text-xs text-muted-foreground">Formato de mídia atual não possui fonte reproduzível.</p>;
}
