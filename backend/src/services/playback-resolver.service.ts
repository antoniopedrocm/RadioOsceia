import dayjs from 'dayjs';
import { FastifyInstance } from 'fastify';

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours * 60) + minutes;
}

function normalizePlaybackMedia(media: { sourceType: string; youtubeVideoId?: string | null; embedUrl?: string | null; publicUrl?: string | null }) {
  if (media.sourceType === 'YOUTUBE') {
    return {
      ...media,
      playback: {
        sourceType: 'youtube',
        youtubeVideoId: media.youtubeVideoId,
        embedUrl: media.embedUrl
      }
    };
  }

  return {
    ...media,
    playback: {
      sourceType: 'arquivo_local',
      publicUrl: media.publicUrl
    }
  };
}

async function findNextScheduledItem(app: FastifyInstance, institutionId: string, now = new Date()) {
  const current = dayjs(now);

  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const weekday = current.add(dayOffset, 'day').day();
    const minuteThreshold = dayOffset === 0 ? ((current.hour() * 60) + current.minute()) : -1;

    const items = await app.prisma.scheduleItem.findMany({
      where: { institutionId, weekday, isActive: true },
      include: { media: true, program: true },
      orderBy: [{ startTime: 'asc' }, { priority: 'desc' }]
    });

    const nextItem = items.find((item) => timeToMinutes(item.startTime) > minuteThreshold);
    if (nextItem) return nextItem;
  }

  return null;
}

export async function resolveNowPlaying(app: FastifyInstance, institutionId: string, now = new Date()) {
  const current = dayjs(now);

  const override = await app.prisma.playbackOverride.findFirst({
    where: {
      institutionId,
      status: { in: ['SCHEDULED', 'ACTIVE'] },
      startAt: { lte: now },
      OR: [{ endAt: null }, { endAt: { gte: now } }]
    },
    include: { media: true },
    orderBy: { startAt: 'desc' }
  });

  if (override) {
    return { source: 'override', title: override.title, media: normalizePlaybackMedia(override.media), startAt: override.startAt, endAt: override.endAt };
  }

  const weekday = current.day();
  const nowMinutes = (current.hour() * 60) + current.minute();

  const items = await app.prisma.scheduleItem.findMany({
    where: { institutionId, weekday, isActive: true },
    include: { media: true, program: { include: { presenter: true } } },
    orderBy: [{ priority: 'desc' }, { startTime: 'asc' }]
  });

  const currentItem = items.find((item) => {
    const start = timeToMinutes(item.startTime);
    const end = timeToMinutes(item.endTime);
    return nowMinutes >= start && nowMinutes < end;
  });

  if (currentItem) {
    return {
      source: 'schedule',
      title: currentItem.title,
      media: normalizePlaybackMedia(currentItem.media),
      program: currentItem.program,
      startTime: currentItem.startTime,
      endTime: currentItem.endTime
    };
  }

  const fallback = await app.prisma.media.findFirst({ where: { institutionId, isFallback: true, isActive: true }, orderBy: { createdAt: 'asc' } });
  if (fallback) {
    return { source: 'fallback', title: fallback.title, media: normalizePlaybackMedia(fallback) };
  }

  const nextContent = await findNextScheduledItem(app, institutionId, now);
  if (nextContent) {
    return {
      source: 'next_scheduled',
      title: nextContent.title,
      media: normalizePlaybackMedia(nextContent.media),
      program: nextContent.program,
      startTime: nextContent.startTime,
      endTime: nextContent.endTime
    };
  }

  return null;
}

export async function resolveUpNext(app: FastifyInstance, institutionId: string, now = new Date(), limit = 5) {
  const current = dayjs(now);
  const output = [] as Array<Record<string, unknown>>;

  for (let dayOffset = 0; dayOffset < 7 && output.length < limit; dayOffset += 1) {
    const weekday = current.add(dayOffset, 'day').day();
    const minuteThreshold = dayOffset === 0 ? ((current.hour() * 60) + current.minute()) : -1;

    const items = await app.prisma.scheduleItem.findMany({
      where: { institutionId, weekday, isActive: true },
      include: { media: true, program: true },
      orderBy: [{ startTime: 'asc' }, { priority: 'desc' }]
    });

    output.push(...items
      .filter((item) => timeToMinutes(item.startTime) > minuteThreshold)
      .map((item) => ({
        id: item.id,
        title: item.title,
        weekday: item.weekday,
        startTime: item.startTime,
        endTime: item.endTime,
        media: normalizePlaybackMedia(item.media),
        program: item.program
      })));
  }

  return output.slice(0, limit);
}
