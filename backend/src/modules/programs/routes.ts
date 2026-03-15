import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { toSlug } from '../../utils/slug.js';

const schema = z.object({
  institutionId: z.string(),
  presenterId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  title: z.string().min(2),
  slug: z.string().optional(),
  shortDescription: z.string().optional(),
  fullDescription: z.string().optional(),
  coverUrl: z.string().optional(),
  highlightColor: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isActive: z.boolean().optional()
});

export async function programRoutes(app: FastifyInstance) {
  app.get('/public/institutions/:slug/programs', async (request) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    const institution = await app.prisma.institution.findUniqueOrThrow({ where: { slug } });
    return app.prisma.program.findMany({ where: { institutionId: institution.id, isActive: true }, include: { presenter: true, category: true } });
  });

  app.get('/public/institutions/:slug/programs/:programSlug', async (request) => {
    const { slug, programSlug } = z.object({ slug: z.string(), programSlug: z.string() }).parse(request.params);
    const institution = await app.prisma.institution.findUniqueOrThrow({ where: { slug } });
    return app.prisma.program.findFirstOrThrow({ where: { institutionId: institution.id, slug: programSlug }, include: { presenter: true, category: true, media: true } });
  });

  app.get('/programs', { preHandler: [authenticate, requireRole('VIEWER')] }, async (request) => app.prisma.program.findMany({ where: request.authUser?.institutionId ? { institutionId: request.authUser.institutionId } : undefined, include: { presenter: true, category: true } }));
  app.post('/programs', { preHandler: [authenticate, requireRole('EDITOR')] }, async (request) => {
    const body = schema.parse(request.body);
    return app.prisma.program.create({ data: { ...body, slug: body.slug ?? toSlug(body.title), tags: body.tags ?? [] } });
  });
  app.put('/programs/:id', { preHandler: [authenticate, requireRole('EDITOR')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return app.prisma.program.update({ where: { id }, data: schema.partial().parse(request.body) });
  });
  app.delete('/programs/:id', { preHandler: [authenticate, requireRole('EDITOR')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    await app.prisma.program.delete({ where: { id } });
    return { success: true };
  });
}
