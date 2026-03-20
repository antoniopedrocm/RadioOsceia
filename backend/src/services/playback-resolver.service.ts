import dayjs from 'dayjs';
import { FastifyInstance } from 'fastify';

const weekdayMap = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;

type Weekday = (typeof weekdayMap)[number];

export interface ResolvedPlaybackItem {
  itemId: string;
  orderIndex: number;
  title: string;
  mediaId: string;
  mediaType: string;
  sourceType: string;
  youtubeVideoId?: string | null;
  embedUrl?: string | null;
  publicUrl?: string | null;
  startAt: Date;
  endAt: Date;
}

function parseClock(base: dayjs.Dayjs, value: string): dayjs.Dayjs {
  const normalized = value.length === 5 ? `${value}:00` : value;
  const [h, m, s] = normalized.split(':').map(Number);
  return base.hour(h).minute(m).second(s ?? 0).millisecond(0);
}

function toPlayback(media: any) {
  return {
    sourceType: media.sourceType,
    mediaType: media.mediaType,
    youtubeVideoId: media.youtubeVideoId,
    embedUrl: media.embedUrl,
    publicUrl: media.publicUrl
  };
}

export function resolveSequenceTimeline(sequence: any, blockDate: Date): { timeline: ResolvedPlaybackItem[]; conflicts: string[] } {
  const base = dayjs(blockDate);
  const timeline: ResolvedPlaybackItem[] = [];
  const conflicts: string[] = [];

  const ordered = [...sequence.items].sort((a, b) => a.orderIndex - b.orderIndex);

  for (const item of ordered) {
    const duration = item.media.durationSeconds;
    if (item.startMode === 'AFTER_PREVIOUS' && (!duration || duration <= 0) && timeline.length === 0) {
      conflicts.push(`Item ${item.orderIndex} inválido: AFTER_PREVIOUS exige item anterior`);
      continue;
    }

    if (item.startMode === 'AFTER_PREVIOUS' && !duration) {
      conflicts.push(`Mídia "${item.media.title}" sem duração não pode usar AFTER_PREVIOUS`);
      continue;
    }

    let startAt: dayjs.Dayjs;
    if (item.startMode === 'FIXED_TIME') {
      if (!item.fixedStartTime) {
        conflicts.push(`Item ${item.orderIndex} FIXED_TIME sem fixedStartTime`);
        continue;
      }
      startAt = parseClock(base, item.fixedStartTime);
      const previous = timeline[timeline.length - 1];
      if (previous && startAt.isBefore(dayjs(previous.endAt))) {
        conflicts.push(`Conflito: item ${item.orderIndex} inicia antes do término do item anterior`);
      }
    } else {
      const previous = timeline[timeline.length - 1];
      if (!previous) {
        conflicts.push(`Item ${item.orderIndex} AFTER_PREVIOUS sem anterior`);
        continue;
      }
      startAt = dayjs(previous.endAt).add(item.relativeOffsetSeconds ?? 0, 'second');
    }

    const effectiveDuration = item.media.durationSeconds ?? 0;
    const endAt = startAt.add(effectiveDuration, 'second');

    timeline.push({
      itemId: item.id,
      orderIndex: item.orderIndex,
      title: item.media.title,
      mediaId: item.media.id,
      mediaType: item.media.mediaType,
      sourceType: item.media.sourceType,
      youtubeVideoId: item.media.youtubeVideoId,
      embedUrl: item.media.embedUrl,
      publicUrl: item.media.publicUrl,
      startAt: startAt.toDate(),
      endAt: endAt.toDate()
    });
  }

  return { timeline, conflicts };
}

async function resolveFromScheduleBlocks(app: FastifyInstance, institutionId: string, now: Date) {
  const weekday = weekdayMap[dayjs(now).day()] as Weekday;

  const blocks = await app.prisma.scheduleBlock.findMany({
    where: { institutionId, weekday, isActive: true },
    include: {
      program: true,
      sequence: {
        include: {
          items: {
            include: { media: true },
            orderBy: { orderIndex: 'asc' }
          }
        }
      }
    },
    orderBy: { startTime: 'asc' }
  });

  const expanded = blocks.flatMap((block) => {
    const blockBase = parseClock(dayjs(now), block.startTime).toDate();
    const resolved = resolveSequenceTimeline(block.sequence, blockBase);
    return resolved.timeline.map((item) => ({ ...item, block, conflicts: resolved.conflicts }));
  });

  const current = expanded.find((item) => dayjs(now).isAfter(dayjs(item.startAt)) && dayjs(now).isBefore(dayjs(item.endAt)));
  const next = expanded.filter((item) => dayjs(item.startAt).isAfter(dayjs(now))).sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));

  return { current, next, expanded };
}

export async function resolveNowPlaying(app: FastifyInstance, institutionId: string, now = new Date()) {
  const override = await app.prisma.playbackOverride.findFirst({
    where: {
      institutionId,
      status: { in: ['SCHEDULED', 'ACTIVE'] },
      startAt: { lte: now },
      OR: [{ endAt: null }, { endAt: { gte: now } }]
    },
    include: { media: true, sequence: { include: { items: { include: { media: true }, orderBy: { orderIndex: 'asc' } } } } },
    orderBy: [{ priority: 'desc' }, { startAt: 'desc' }]
  });

  if (override?.media) {
    return {
      source: 'override',
      title: override.title,
      media: { id: override.media.id, title: override.media.title, ...toPlayback(override.media) },
      startAt: override.startAt,
      endAt: override.endAt
    };
  }

  const { current, next } = await resolveFromScheduleBlocks(app, institutionId, now);

  if (current) {
    return {
      source: 'schedule',
      title: current.block.title,
      program: current.block.program,
      sequence: { id: current.block.sequence.id, title: current.block.sequence.title },
      media: {
        id: current.mediaId,
        title: current.title,
        ...toPlayback(current)
      },
      startAt: current.startAt,
      endAt: current.endAt,
      nextItems: next.slice(0, 5)
    };
  }

  return next[0]
    ? {
      source: 'next_scheduled',
      title: next[0].block.title,
      media: {
        id: next[0].mediaId,
        title: next[0].title,
        ...toPlayback(next[0])
      },
      startAt: next[0].startAt,
      endAt: next[0].endAt,
      nextItems: next.slice(0, 5)
    }
    : null;
}

export async function resolveUpNext(app: FastifyInstance, institutionId: string, now = new Date(), limit = 5) {
  const { next } = await resolveFromScheduleBlocks(app, institutionId, now);
  return next.slice(0, limit).map((item) => ({
    id: item.itemId,
    title: item.title,
    startTime: dayjs(item.startAt).format('HH:mm'),
    startAt: item.startAt,
    endAt: item.endAt,
    blockTitle: item.block.title,
    media: { id: item.mediaId, title: item.title, ...toPlayback(item) }
  }));
}

export async function resolveTimelineForWeekday(app: FastifyInstance, institutionId: string, weekday: Weekday, now = new Date()) {
  const blocks = await app.prisma.scheduleBlock.findMany({
    where: { institutionId, weekday, isActive: true },
    include: {
      program: true,
      sequence: {
        include: {
          items: { include: { media: true }, orderBy: { orderIndex: 'asc' } }
        }
      }
    },
    orderBy: { startTime: 'asc' }
  });

  return blocks.map((block) => {
    const blockBase = parseClock(dayjs(now), block.startTime).toDate();
    const resolved = resolveSequenceTimeline(block.sequence, blockBase);
    return {
      id: block.id,
      title: block.title,
      startTime: block.startTime,
      weekday: block.weekday,
      sequence: { id: block.sequence.id, title: block.sequence.title },
      timeline: resolved.timeline,
      conflicts: resolved.conflicts,
      program: block.program
    };
  });
}
