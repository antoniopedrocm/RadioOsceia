import { FastifyInstance } from 'fastify';

interface AuditInput {
  userId?: string;
  institutionId?: string;
  action: string;
  entity: string;
  entityId?: string;
  description?: string;
  metadata?: unknown;
}

export async function createAuditLog(app: FastifyInstance, input: AuditInput) {
  await app.prisma.auditLog.create({
    data: {
      userId: input.userId,
      institutionId: input.institutionId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      description: input.description,
      metadata: input.metadata as object | undefined
    }
  });
}
