export interface ParsedYoutubeMedia {
  youtubeUrl: string;
  youtubeVideoId: string;
  embedUrl: string;
  thumbnailUrl: string;
}

const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

export function getYouTubeVideoId(value: string): string | null {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (VIDEO_ID_PATTERN.test(normalized)) {
    return normalized;
  }

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.replace('www.', '');

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
      const byQuery = parsed.searchParams.get('v') ?? parsed.searchParams.get('vi');
      if (byQuery && VIDEO_ID_PATTERN.test(byQuery)) {
        return byQuery;
      }

      const byPath = extractFromPath(parsed.pathname);
      if (byPath && VIDEO_ID_PATTERN.test(byPath)) {
        return byPath;
      }
    }

    if (host === 'youtu.be') {
      const byPath = extractFromPath(parsed.pathname);
      if (byPath && VIDEO_ID_PATTERN.test(byPath)) {
        return byPath;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function extractFromPath(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);

  if (!segments.length) {
    return null;
  }

  if ((segments[0] === 'shorts' || segments[0] === 'embed' || segments[0] === 'v' || segments[0] === 'live') && segments[1]) {
    return segments[1];
  }

  if (VIDEO_ID_PATTERN.test(segments[0])) {
    return segments[0];
  }

  return null;
}

export function parseYoutubeUrl(rawUrl: string): ParsedYoutubeMedia {
  const videoId = getYouTubeVideoId(rawUrl);

  if (!videoId || !VIDEO_ID_PATTERN.test(videoId)) {
    throw new Error('Não foi possível extrair o ID do vídeo do YouTube.');
  }

  return {
    youtubeUrl: rawUrl,
    youtubeVideoId: videoId,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  };
}
