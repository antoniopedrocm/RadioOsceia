import type { NowPlayingResponse } from '@/types/api';
import { LiveBroadcastPlayer } from '@/components/public/LiveBroadcastPlayer';

interface MediaPlayerProps {
  nowPlaying: NowPlayingResponse['nowPlaying'] | null;
  broadcastStrictMode?: boolean;
}

export function MediaPlayer({ nowPlaying, broadcastStrictMode = true }: MediaPlayerProps) {
  return <LiveBroadcastPlayer nowPlaying={nowPlaying} broadcastStrictMode={broadcastStrictMode} />;
}
