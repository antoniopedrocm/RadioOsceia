import { FastifyInstance } from 'fastify';
import { PlaybackOverrideStatus } from '@prisma/client';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { resolveNowPlaying, resolveUpNext } from '../../services/playback-resolver.service.js';

const overrideSchema = z.object({
  institutionId: z.string(),
  mediaId: z.string(),
  title: z.string().min(2),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional(),
  status: z.nativeEnum(PlaybackOverrideStatus).optional(),
  notes: z.string().optional()
});

export async function playbackRoutes(app: FastifyInstance) {
  app.get('/public/institutions/:slug/now-playing', async (request) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    const institution = await app.prisma.institution.findUniqueOrThrow({ where: { slug } });
    const current = await resolveNowPlaying(app, institution.id);
    return { institution: { id: institution.id, slug: institution.slug, name: institution.name }, nowPlaying: current };
  });

  app.get('/public/institutions/:slug/up-next', async (request) => {
    const { slug, limit } = z.object({ slug: z.string(), limit: z.coerce.number().optional() }).parse({ ...request.params, ...request.query });
    const institution = await app.prisma.institution.findUniqueOrThrow({ where: { slug } });
    return resolveUpNext(app, institution.id, new Date(), limit ?? 5);
  });

  app.get('/playback-overrides', { preHandler: [authenticate, requireRole('OPERATOR')] }, async (request) => app.prisma.playbackOverride.findMany({ where: request.authUser?.institutionId ? { institutionId: request.authUser.institutionId } : undefined, include: { media: true, createdByUser: true } }));

  app.post('/playback-overrides', { preHandler: [authenticate, requireRole('OPERATOR')] }, async (request) => {
    const body = overrideSchema.parse(request.body);
    return app.prisma.playbackOverride.create({ data: { ...body, createdByUserId: request.authUser!.id } });
  });

  app.put('/playback-overrides/:id', { preHandler: [authenticate, requireRole('OPERATOR')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return app.prisma.playbackOverride.update({ where: { id }, data: overrideSchema.partial().parse(request.body) });
  });

  app.delete('/playback-overrides/:id', { preHandler: [authenticate, requireRole('OPERATOR')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    await app.prisma.playbackOverride.delete({ where: { id } });
    return { success: true };
  });
}
