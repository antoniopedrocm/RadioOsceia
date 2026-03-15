import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { createAuditLog } from '../../services/audit-log.service.js';

const institutionSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  shortName: z.string().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  logoUrl: z.string().optional(),
  bannerUrl: z.string().optional(),
  description: z.string().optional(),
  playerPosition: z.string().optional(),
  playerDefaultMode: z.string().optional(),
  showQueue: z.boolean().optional(),
  showCover: z.boolean().optional(),
  autoplayEnabled: z.boolean().optional(),
  isActive: z.boolean().optional()
});

export async function institutionRoutes(app: FastifyInstance) {
  app.get('/public/institutions/:slug', async (request) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    return app.prisma.institution.findUniqueOrThrow({ where: { slug } });
  });

  app.get('/public/institutions/:slug/config', async (request) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    return app.prisma.institution.findUniqueOrThrow({ where: { slug }, select: { name: true, slug: true, primaryColor: true, secondaryColor: true, logoUrl: true, bannerUrl: true, description: true, playerPosition: true, playerDefaultMode: true, showQueue: true, showCover: true, autoplayEnabled: true } });
  });

  app.get('/institutions', { preHandler: [authenticate, requireRole('ADMIN')] }, async () => app.prisma.institution.findMany({ orderBy: { name: 'asc' } }));

  app.post('/institutions', { preHandler: [authenticate, requireRole('ADMIN')] }, async (request) => {
    const body = institutionSchema.parse(request.body);
    const created = await app.prisma.institution.create({ data: body });
    await createAuditLog(app, { userId: request.authUser?.id, institutionId: created.id, action: 'CREATE', entity: 'INSTITUTION', entityId: created.id, description: `Instituição criada: ${created.name}` });
    return created;
  });

  app.put('/institutions/:id', { preHandler: [authenticate, requireRole('ADMIN')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = institutionSchema.partial().parse(request.body);
    const updated = await app.prisma.institution.update({ where: { id }, data: body });
    await createAuditLog(app, { userId: request.authUser?.id, institutionId: id, action: 'UPDATE', entity: 'INSTITUTION', entityId: id });
    return updated;
  });

  app.delete('/institutions/:id', { preHandler: [authenticate, requireRole('ADMIN')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    await app.prisma.institution.delete({ where: { id } });
    await createAuditLog(app, { userId: request.authUser?.id, institutionId: id, action: 'DELETE', entity: 'INSTITUTION', entityId: id });
    return { success: true };
  });
}
