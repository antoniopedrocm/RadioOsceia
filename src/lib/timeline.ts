export interface TimelineScheduleBlock {
  id: string;
  title: string;
  weekday: unknown;
  startTime: string;
  endTime?: string | null;
  sequenceId: string;
  programId?: string | null;
  isActive: boolean;
}

export interface TimelineSequenceItem {
  id: string;
  mediaId: string;
  orderIndex: number;
  startMode?: string;
  fixedStartTime?: string;
  relativeOffsetSeconds?: number;
  startAfterPrevious?: boolean;
}

export interface TimelineMedia {
  id: string;
  title: string;
  mediaType: string;
  sourceType?: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  embedUrl?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  publicUrl?: string | null;
}

export interface TimelineEntry {
  itemId: string;
  mediaId: string;
  title: string;
  sourceType: string;
  startAt: string;
}

export interface TimelineBlock {
  id: string;
  title: string;
  startTime: string;
  endTime: string | null;
  sequenceId: string;
  timeline: TimelineEntry[];
}

export interface NowPlayingPayload {
  institution: { id: string; slug: string; name: string };
  nowPlaying: {
    source: string;
    title: string;
    media: {
      id: string;
      title: string;
      sourceType: string;
      mediaType: string;
      youtubeVideoId: string | null;
      youtubeUrl?: string | null;
      embedUrl?: string | null;
      publicUrl: string | null;
    };
  } | null;
  upNext: Array<{ id: string; title: string; startTime: string }>;
}

export interface DashboardSummary {
  programs: number;
  media: number;
  scheduledToday: number;
  nowPlaying: NowPlayingPayload['nowPlaying'];
  upNext: NowPlayingPayload['upNext'];
}

export interface TimelineDataAdapter {
  loadTimelineBlocks: (weekday: number) => Promise<TimelineScheduleBlock[]>;
  loadSequenceItems: (sequenceId: string) => Promise<TimelineSequenceItem[]>;
  loadMedia: (mediaId: string) => Promise<TimelineMedia | null>;
}

export interface DashboardDataAdapter extends TimelineDataAdapter {
  countPrograms: () => Promise<number>;
  countMedia: () => Promise<number>;
}

const defaultInstitution = { id: 'irmao-aureo', slug: 'irmao-aureo', name: 'Irmão Áureo' };

export function hhmmToMinutes(value?: string | null) {
  if (!value) return null;
  const [hourRaw, minuteRaw] = value.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return hour * 60 + minute;
}

function minutesToHHMM(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function normalizeSourceType(raw?: string | null) {
  const value = String(raw ?? '').toLowerCase();
  if (value === 'youtube' || value === 'yt') return 'YOUTUBE';
  if (value === 'upload' || value === 'local') return 'LOCAL';
  if (value === 'existing_file' || value === 'external_placeholder') return 'EXTERNAL_PLACEHOLDER';
  return value ? value.toUpperCase() : 'YOUTUBE';
}

export async function resolveTimeline(weekday: number, adapter: TimelineDataAdapter): Promise<TimelineBlock[]> {
  const blocks = await adapter.loadTimelineBlocks(weekday);
  const mediaCache = new Map<string, TimelineMedia>();

  return Promise.all(blocks.map(async (block) => {
    const items = await adapter.loadSequenceItems(block.sequenceId);
    const sortedItems = [...items].sort((a, b) => a.orderIndex - b.orderIndex);
    const blockStartMinutes = hhmmToMinutes(block.startTime) ?? 0;
    let runningStart = blockStartMinutes;

    const timeline: TimelineEntry[] = [];

    for (const item of sortedItems) {
      if (!mediaCache.has(item.mediaId)) {
        const media = await adapter.loadMedia(item.mediaId);
        if (media) {
          mediaCache.set(item.mediaId, media);
        }
      }

      const media = mediaCache.get(item.mediaId);
      if (!media) continue;

      const fixedMinutes = hhmmToMinutes(item.fixedStartTime ?? null);
      if (fixedMinutes !== null) {
        runningStart = fixedMinutes;
      } else if (item.relativeOffsetSeconds && item.relativeOffsetSeconds > 0) {
        runningStart = blockStartMinutes + Math.floor(item.relativeOffsetSeconds / 60);
      }

      timeline.push({
        itemId: item.id,
        mediaId: item.mediaId,
        title: media.title,
        sourceType: normalizeSourceType(media.sourceType),
        startAt: minutesToHHMM(runningStart)
      });

      const durationMinutes = Math.max(1, Math.ceil((media.durationSeconds ?? 0) / 60));
      runningStart += durationMinutes;
    }

    return {
      id: block.id,
      title: block.title,
      startTime: block.startTime,
      endTime: block.endTime ?? null,
      sequenceId: block.sequenceId,
      timeline
    };
  }));
}

export async function buildNowPlayingPayload(
  adapter: TimelineDataAdapter,
  options?: { date?: Date; institution?: NowPlayingPayload['institution'] }
): Promise<NowPlayingPayload> {
  const now = options?.date ?? new Date();
  const weekday = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const blocks = await resolveTimeline(weekday, adapter);
  const activeBlocks = blocks.filter((block) => {
    const start = hhmmToMinutes(block.startTime) ?? 0;
    const end = hhmmToMinutes(block.endTime) ?? start + (block.timeline.length * 30);
    return nowMinutes >= start && nowMinutes <= end;
  });

  const currentBlock = activeBlocks[0] ?? blocks[0] ?? null;
  if (!currentBlock || currentBlock.timeline.length === 0) {
    return {
      institution: options?.institution ?? defaultInstitution,
      nowPlaying: null,
      upNext: []
    };
  }

  const timelineWithMinutes = currentBlock.timeline
    .map((item) => ({ ...item, startMinutes: hhmmToMinutes(item.startAt) ?? 0 }))
    .sort((a, b) => a.startMinutes - b.startMinutes);

  let currentIndex = timelineWithMinutes.findIndex((item, index) => {
    const nextStart = timelineWithMinutes[index + 1]?.startMinutes ?? 24 * 60;
    return nowMinutes >= item.startMinutes && nowMinutes < nextStart;
  });

  if (currentIndex < 0) currentIndex = 0;

  const current = timelineWithMinutes[currentIndex];
  const media = await adapter.loadMedia(current.mediaId);

  const resolvedSourceType = normalizeSourceType(media?.sourceType ?? current.sourceType);

  return {
    institution: options?.institution ?? defaultInstitution,
    nowPlaying: {
      source: currentBlock.title,
      title: current.title,
      media: {
        id: current.mediaId,
        title: current.title,
        sourceType: resolvedSourceType,
        mediaType: String(media?.mediaType ?? 'VIDEO'),
        youtubeVideoId: media?.youtubeVideoId ?? null,
        youtubeUrl: media?.youtubeUrl ?? null,
        embedUrl: media?.embedUrl ?? null,
        publicUrl: resolvedSourceType === 'YOUTUBE' ? null : (media?.publicUrl ?? null)
      }
    },
    upNext: timelineWithMinutes.slice(currentIndex + 1, currentIndex + 6).map((item) => ({
      id: item.itemId,
      title: item.title,
      startTime: item.startAt
    }))
  };
}

export async function getDashboardSummary(
  adapter: DashboardDataAdapter,
  options?: { date?: Date; institution?: NowPlayingPayload['institution'] }
): Promise<DashboardSummary> {
  const today = (options?.date ?? new Date()).getDay();
  const [programs, media, blocks, playback] = await Promise.all([
    adapter.countPrograms(),
    adapter.countMedia(),
    adapter.loadTimelineBlocks(today),
    buildNowPlayingPayload(adapter, options)
  ]);

  return {
    programs,
    media,
    scheduledToday: blocks.length,
    nowPlaying: playback.nowPlaying,
    upNext: playback.upNext
  };
}
