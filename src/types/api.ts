export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'EDITOR' | 'SCHEDULER' | 'OPERATOR' | 'VIEWER';
  institutionId: string | null;
}

export interface NowPlayingResponse {
  institution: { id: string; slug: string; name: string };
  nowPlaying: {
    source: string;
    title: string;
    itemId?: string | null;
    startedAt?: string | null;
    endsAt?: string | null;
    playbackOffsetSeconds?: number;
    durationSeconds?: number;
    media: {
      id: string;
      title: string;
      sourceType: string;
      mediaType: string;
      youtubeVideoId?: string | null;
      youtubeUrl?: string | null;
      embedUrl?: string | null;
      publicUrl?: string | null;
    };
  } | null;
  upNext: NowPlayingUpNextItem[];
}

export interface NowPlayingUpNextItem {
  id: string;
  title: string;
  startTime: string;
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface DashboardSummary {
  programs: number;
  media: number;
  scheduledToday: number;
  nowPlaying: { title: string } | null;
  upNext: Array<{ id: string; title: string; startTime: string }>;
}
