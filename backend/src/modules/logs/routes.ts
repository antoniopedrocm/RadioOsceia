import { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../middleware/auth.js';

export async function logRoutes(app: FastifyInstance) {
  app.get('/logs', { preHandler: [authenticate, requireRole('VIEWER')] }, async (request) => {
    const institutionId = request.authUser?.institutionId;
    return app.prisma.auditLog.findMany({ where: institutionId ? { institutionId } : undefined, orderBy: { createdAt: 'desc' }, take: 100, include: { user: { select: { id: true, name: true, email: true } } } });
  });
}
