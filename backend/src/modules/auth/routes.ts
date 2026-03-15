import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import argon2 from 'argon2';
import { authenticate } from '../../middleware/auth.js';
import { createAuditLog } from '../../services/audit-log.service.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const user = await app.prisma.user.findUnique({ where: { email: body.email } });

    if (!user || !user.isActive) {
      return reply.unauthorized('Credenciais inválidas');
    }

    const valid = await argon2.verify(user.passwordHash, body.password);
    if (!valid) {
      return reply.unauthorized('Credenciais inválidas');
    }

    const token = await reply.jwtSign({ role: user.role, institutionId: user.institutionId, email: user.email }, { sub: user.id });

    await app.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await createAuditLog(app, { userId: user.id, institutionId: user.institutionId ?? undefined, action: 'LOGIN', entity: 'AUTH', description: `Login realizado: ${user.email}` });

    return { accessToken: token, user: { id: user.id, name: user.name, email: user.email, role: user.role, institutionId: user.institutionId } };
  });

  app.post('/auth/logout', { preHandler: [authenticate] }, async (request) => {
    if (request.authUser) {
      await createAuditLog(app, { userId: request.authUser.id, institutionId: request.authUser.institutionId ?? undefined, action: 'LOGOUT', entity: 'AUTH', description: 'Logout realizado' });
    }
    return { success: true };
  });

  app.get('/auth/me', { preHandler: [authenticate] }, async (request) => {
    const user = await app.prisma.user.findUniqueOrThrow({ where: { id: request.authUser!.id } });
    return { id: user.id, name: user.name, email: user.email, role: user.role, institutionId: user.institutionId };
  });
}
