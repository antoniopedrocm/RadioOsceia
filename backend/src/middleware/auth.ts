import { FastifyReply, FastifyRequest } from 'fastify';
import { UserRole } from '@prisma/client';

const roleRank: Record<UserRole, number> = {
  VIEWER: 1,
  OPERATOR: 2,
  SCHEDULER: 3,
  EDITOR: 4,
  ADMIN: 5
};

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const payload = await request.jwtVerify<{ sub: string; role: UserRole; institutionId: string | null; email: string }>();
    request.authUser = { id: payload.sub, role: payload.role, institutionId: payload.institutionId, email: payload.email };
  } catch {
    reply.unauthorized('Token inválido ou expirado');
  }
}

export function requireRole(minRole: UserRole) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    if (!request.authUser || roleRank[request.authUser.role] < roleRank[minRole]) {
      return reply.forbidden('Permissão insuficiente');
    }
  };
}
