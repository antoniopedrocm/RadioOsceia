import dayjs from 'dayjs';
import { FastifyInstance } from 'fastify';

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours * 60) + minutes;
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
    return { source: 'override', title: override.title, media: override.media, startAt: override.startAt, endAt: override.endAt };
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
    return { source: 'schedule', title: currentItem.title, media: currentItem.media, program: currentItem.program, startTime: currentItem.startTime, endTime: currentItem.endTime };
  }

  const fallback = await app.prisma.media.findFirst({ where: { institutionId, isFallback: true, isActive: true }, orderBy: { createdAt: 'asc' } });
  if (fallback) {
    return { source: 'fallback', title: fallback.title, media: fallback };
  }

  return null;
}

export async function resolveUpNext(app: FastifyInstance, institutionId: string, now = new Date(), limit = 5) {
  const current = dayjs(now);
  const weekday = current.day();
  const nowMinutes = (current.hour() * 60) + current.minute();

  const items = await app.prisma.scheduleItem.findMany({
    where: { institutionId, weekday, isActive: true },
    include: { media: true, program: true },
    orderBy: [{ startTime: 'asc' }, { priority: 'desc' }]
  });

  return items
    .filter((item) => timeToMinutes(item.startTime) > nowMinutes)
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      title: item.title,
      startTime: item.startTime,
      endTime: item.endTime,
      media: item.media,
      program: item.program
    }));
}
