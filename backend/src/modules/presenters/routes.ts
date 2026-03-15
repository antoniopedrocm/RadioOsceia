import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { toSlug } from '../../utils/slug.js';

const schema = z.object({ institutionId: z.string(), name: z.string().min(2), slug: z.string().optional(), shortBio: z.string().optional(), fullBio: z.string().optional(), photoUrl: z.string().optional(), roleTitle: z.string().optional(), isActive: z.boolean().optional() });

export async function presenterRoutes(app: FastifyInstance) {
  app.get('/public/institutions/:slug/presenters', async (request) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    const institution = await app.prisma.institution.findUniqueOrThrow({ where: { slug } });
    return app.prisma.presenter.findMany({ where: { institutionId: institution.id, isActive: true } });
  });

  app.get('/presenters', { preHandler: [authenticate, requireRole('VIEWER')] }, async (request) => app.prisma.presenter.findMany({ where: request.authUser?.institutionId ? { institutionId: request.authUser.institutionId } : undefined }));
  app.post('/presenters', { preHandler: [authenticate, requireRole('EDITOR')] }, async (request) => {
    const body = schema.parse(request.body);
    return app.prisma.presenter.create({ data: { ...body, slug: body.slug ?? toSlug(body.name) } });
  });
  app.put('/presenters/:id', { preHandler: [authenticate, requireRole('EDITOR')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return app.prisma.presenter.update({ where: { id }, data: schema.partial().parse(request.body) });
  });
  app.delete('/presenters/:id', { preHandler: [authenticate, requireRole('EDITOR')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    await app.prisma.presenter.delete({ where: { id } });
    return { success: true };
  });
}
