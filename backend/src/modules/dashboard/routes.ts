import { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { resolveNowPlaying, resolveUpNext } from '../../services/playback-resolver.service.js';

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/dashboard/summary', { preHandler: [authenticate, requireRole('VIEWER')] }, async (request) => {
    const institutionId = request.authUser?.institutionId;
    const where = institutionId ? { institutionId } : undefined;
    const [programs, media, scheduledToday, categoryCount, mediaTypeCount, logs] = await Promise.all([
      app.prisma.program.count({ where }),
      app.prisma.media.count({ where }),
      app.prisma.scheduleItem.count({ where: { ...(where ?? {}), weekday: new Date().getDay() } }),
      app.prisma.category.groupBy({ by: ['name'], _count: true, where }),
      app.prisma.media.groupBy({ by: ['mediaType'], _count: true, where }),
      app.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 10 })
    ]);

    const nowPlaying = institutionId ? await resolveNowPlaying(app, institutionId) : null;
    const upNext = institutionId ? await resolveUpNext(app, institutionId, new Date(), 5) : [];

    return {
      programs,
      media,
      scheduledToday,
      nowPlaying,
      upNext,
      countByCategory: categoryCount,
      countByMediaType: mediaTypeCount,
      latestLogs: logs
    };
  });
}
