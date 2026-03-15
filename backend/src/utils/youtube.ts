const youtubeIdRegex = /^[a-zA-Z0-9_-]{11}$/;

export interface ParsedYouTube {
  youtubeUrl: string;
  youtubeVideoId: string;
  embedUrl: string;
}

export function parseYouTubeUrl(url: string): ParsedYouTube {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('URL do YouTube inválida');
  }

  const hostname = parsed.hostname.replace('www.', '');
  let videoId: string | null = null;

  if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
    if (parsed.pathname === '/watch') {
      videoId = parsed.searchParams.get('v');
    } else if (parsed.pathname.startsWith('/shorts/')) {
      videoId = parsed.pathname.split('/')[2] ?? null;
    } else if (parsed.pathname.startsWith('/embed/')) {
      videoId = parsed.pathname.split('/')[2] ?? null;
    }
  }

  if (hostname === 'youtu.be') {
    videoId = parsed.pathname.slice(1).split('/')[0] ?? null;
  }

  if (!videoId || !youtubeIdRegex.test(videoId)) {
    throw new Error('Não foi possível extrair videoId válido do YouTube');
  }

  return {
    youtubeUrl: url,
    youtubeVideoId: videoId,
    embedUrl: `https://www.youtube.com/embed/${videoId}`
  };
}
