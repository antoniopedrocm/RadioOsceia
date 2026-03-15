import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth.js';

const schema = z.object({
  institutionId: z.string(),
  programId: z.string().optional().nullable(),
  mediaId: z.string(),
  title: z.string().min(2),
  weekday: z.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  priority: z.number().int().default(0),
  repeatRule: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional()
});

export async function scheduleRoutes(app: FastifyInstance) {
  app.get('/public/institutions/:slug/schedule', async (request) => {
    const { slug, weekday } = z.object({ slug: z.string(), weekday: z.coerce.number().optional() }).parse({ ...request.params, ...request.query });
    const institution = await app.prisma.institution.findUniqueOrThrow({ where: { slug } });
    return app.prisma.scheduleItem.findMany({ where: { institutionId: institution.id, ...(weekday !== undefined ? { weekday } : {}), isActive: true }, include: { media: true, program: true }, orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] });
  });

  app.get('/public/institutions/:slug/schedule/today', async (request) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    const institution = await app.prisma.institution.findUniqueOrThrow({ where: { slug } });
    return app.prisma.scheduleItem.findMany({ where: { institutionId: institution.id, weekday: new Date().getDay(), isActive: true }, include: { media: true, program: true }, orderBy: [{ startTime: 'asc' }, { priority: 'desc' }] });
  });

  app.get('/schedule-items', { preHandler: [authenticate, requireRole('VIEWER')] }, async (request) => app.prisma.scheduleItem.findMany({ where: request.authUser?.institutionId ? { institutionId: request.authUser.institutionId } : undefined, include: { media: true, program: true } }));
  app.post('/schedule-items', { preHandler: [authenticate, requireRole('SCHEDULER')] }, async (request) => app.prisma.scheduleItem.create({ data: schema.parse(request.body) }));
  app.put('/schedule-items/:id', { preHandler: [authenticate, requireRole('SCHEDULER')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return app.prisma.scheduleItem.update({ where: { id }, data: schema.partial().parse(request.body) });
  });
  app.delete('/schedule-items/:id', { preHandler: [authenticate, requireRole('SCHEDULER')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    await app.prisma.scheduleItem.delete({ where: { id } });
    return { success: true };
  });
}
