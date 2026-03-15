import { FastifyInstance } from 'fastify';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import argon2 from 'argon2';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { createAuditLog } from '../../services/audit-log.service.js';

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(UserRole),
  institutionId: z.string().nullable().optional(),
  isActive: z.boolean().optional()
});

export async function userRoutes(app: FastifyInstance) {
  app.get('/users', { preHandler: [authenticate, requireRole('ADMIN')] }, async () => {
    return app.prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, institutionId: true, isActive: true, lastLoginAt: true, createdAt: true } });
  });

  app.post('/users', { preHandler: [authenticate, requireRole('ADMIN')] }, async (request) => {
    const body = createUserSchema.parse(request.body);
    const passwordHash = await argon2.hash(body.password);
    const user = await app.prisma.user.create({ data: { ...body, passwordHash, institutionId: body.institutionId ?? null } });
    await createAuditLog(app, { userId: request.authUser?.id, institutionId: body.institutionId ?? undefined, action: 'CREATE', entity: 'USER', entityId: user.id, description: `Usuário criado: ${user.email}` });
    return { id: user.id };
  });

  app.put('/users/:id', { preHandler: [authenticate, requireRole('ADMIN')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = createUserSchema.partial().omit({ password: true }).extend({ password: z.string().min(8).optional() }).parse(request.body);
    const data: Record<string, unknown> = { ...body };
    if (body.password) data.passwordHash = await argon2.hash(body.password);
    delete data.password;
    const user = await app.prisma.user.update({ where: { id }, data });
    await createAuditLog(app, { userId: request.authUser?.id, institutionId: user.institutionId ?? undefined, action: 'UPDATE', entity: 'USER', entityId: id });
    return { id: user.id };
  });

  app.delete('/users/:id', { preHandler: [authenticate, requireRole('ADMIN')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    await app.prisma.user.delete({ where: { id } });
    await createAuditLog(app, { userId: request.authUser?.id, action: 'DELETE', entity: 'USER', entityId: id });
    return { success: true };
  });
}
