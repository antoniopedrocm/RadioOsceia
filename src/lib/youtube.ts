export interface ParsedYoutubeMedia {
  youtubeUrl: string;
  youtubeVideoId: string;
  embedUrl: string;
  thumbnailUrl: string;
}

const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

function extractFromPath(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);

  if (segments[0] === 'shorts' && segments[1]) {
    return segments[1];
  }

  if (segments.length === 1 && VIDEO_ID_PATTERN.test(segments[0])) {
    return segments[0];
  }

  if (segments[0] === 'embed' && segments[1]) {
    return segments[1];
  }

  return null;
}

export function parseYoutubeUrl(rawUrl: string): ParsedYoutubeMedia {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('URL do YouTube inválida.');
  }

  const host = parsed.hostname.replace('www.', '');
  let videoId: string | null = null;

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    videoId = parsed.searchParams.get('v') ?? extractFromPath(parsed.pathname);
  } else if (host === 'youtu.be') {
    videoId = extractFromPath(parsed.pathname);
  }

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
