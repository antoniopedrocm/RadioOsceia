import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { toSlug } from '../../utils/slug.js';

const schema = z.object({ institutionId: z.string(), name: z.string().min(2), slug: z.string().optional(), color: z.string().optional(), description: z.string().optional(), isActive: z.boolean().optional() });

export async function categoryRoutes(app: FastifyInstance) {
  app.get('/public/institutions/:slug/categories', async (request) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    const institution = await app.prisma.institution.findUniqueOrThrow({ where: { slug } });
    return app.prisma.category.findMany({ where: { institutionId: institution.id, isActive: true } });
  });

  app.get('/categories', { preHandler: [authenticate, requireRole('VIEWER')] }, async (request) => {
    const institutionId = request.authUser?.institutionId;
    return app.prisma.category.findMany({ where: institutionId ? { institutionId } : undefined });
  });
  app.post('/categories', { preHandler: [authenticate, requireRole('EDITOR')] }, async (request) => {
    const body = schema.parse(request.body);
    return app.prisma.category.create({ data: { ...body, slug: body.slug ?? toSlug(body.name) } });
  });
  app.put('/categories/:id', { preHandler: [authenticate, requireRole('EDITOR')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = schema.partial().parse(request.body);
    return app.prisma.category.update({ where: { id }, data: body });
  });
  app.delete('/categories/:id', { preHandler: [authenticate, requireRole('EDITOR')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    await app.prisma.category.delete({ where: { id } });
    return { success: true };
  });
}
