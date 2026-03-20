import { FastifyInstance } from 'fastify';
import { PlaybackOverrideStatus } from '@prisma/client';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { resolveNowPlaying, resolveTimelineForWeekday, resolveUpNext } from '../../services/playback-resolver.service.js';

const weekdaySchema = z.enum(['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']);

const overrideBaseSchema = z.object({
  institutionId: z.string(),
  mediaId: z.string().optional(),
  sequenceId: z.string().optional(),
  title: z.string().min(2),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional(),
  priority: z.number().int().default(0),
  status: z.nativeEnum(PlaybackOverrideStatus).optional()
});

const overrideSchema = overrideBaseSchema.refine((value) => Boolean(value.mediaId || value.sequenceId), { message: 'mediaId ou sequenceId deve ser informado' });

export async function playbackRoutes(app: FastifyInstance) {
  app.get('/public/institutions/:slug/now-playing', async (request) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    const institution = await app.prisma.institution.findUniqueOrThrow({ where: { slug } });
    const now = new Date();
    const [current, upNext] = await Promise.all([
      resolveNowPlaying(app, institution.id, now),
      resolveUpNext(app, institution.id, now, 5)
    ]);

    return {
      institution: { id: institution.id, slug: institution.slug, name: institution.name },
      nowPlaying: current,
      nextContent: upNext[0] ?? null,
      upNext
    };
  });

  app.get('/public/institutions/:slug/up-next', async (request) => {
    const { slug, limit } = z.object({ slug: z.string(), limit: z.coerce.number().optional() }).parse({ ...(request.params as any), ...(request.query as any) });
    const institution = await app.prisma.institution.findUniqueOrThrow({ where: { slug } });
    return resolveUpNext(app, institution.id, new Date(), limit ?? 5);
  });

  app.get('/public/institutions/:slug/timeline', async (request) => {
    const { slug, weekday } = z.object({ slug: z.string(), weekday: weekdaySchema.optional() }).parse({ ...(request.params as any), ...(request.query as any) });
    const institution = await app.prisma.institution.findUniqueOrThrow({ where: { slug } });
    const effectiveWeekday = weekday ?? weekdaySchema.options[new Date().getDay()];
    const blocks = await resolveTimelineForWeekday(app, institution.id, effectiveWeekday);
    return { institution, weekday: effectiveWeekday, blocks };
  });

  app.get('/playback-overrides', { preHandler: [authenticate, requireRole('OPERATOR')] }, async (request) => app.prisma.playbackOverride.findMany({ where: request.authUser?.institutionId ? { institutionId: request.authUser.institutionId } : undefined, include: { media: true, sequence: true, createdByUser: true } }));

  app.post('/playback-overrides', { preHandler: [authenticate, requireRole('OPERATOR')] }, async (request) => {
    const body = overrideSchema.parse(request.body);
    return app.prisma.playbackOverride.create({ data: { ...body, createdByUserId: request.authUser!.id } });
  });

  app.put('/playback-overrides/:id', { preHandler: [authenticate, requireRole('OPERATOR')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return app.prisma.playbackOverride.update({ where: { id }, data: overrideBaseSchema.partial().parse(request.body) });
  });

  app.delete('/playback-overrides/:id', { preHandler: [authenticate, requireRole('OPERATOR')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    await app.prisma.playbackOverride.delete({ where: { id } });
    return { success: true };
  });
}
