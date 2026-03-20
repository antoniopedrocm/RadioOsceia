import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { createAuditLog } from '../../services/audit-log.service.js';

const weekdaySchema = z.enum(['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']);

const blockSchema = z.object({
  institutionId: z.string(),
  programId: z.string().nullable().optional(),
  sequenceId: z.string(),
  title: z.string().min(2),
  weekday: weekdaySchema,
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  timezone: z.string().optional(),
  isActive: z.boolean().optional()
});

async function writeAudit(app: FastifyInstance, request: any, action: string, entity: string, entityId: string, description: string) {
  await createAuditLog(app, {
    institutionId: request.authUser?.institutionId ?? undefined,
    userId: request.authUser?.id,
    action,
    entity,
    entityId,
    description
  });
}

export async function scheduleRoutes(app: FastifyInstance) {
  app.get('/schedule-blocks', { preHandler: [authenticate, requireRole('VIEWER')] }, async (request) => {
    const query = z.object({ weekday: weekdaySchema.optional(), institutionId: z.string().optional() }).parse(request.query ?? {});
    const institutionId = query.institutionId ?? request.authUser?.institutionId;
    return app.prisma.scheduleBlock.findMany({
      where: {
        ...(institutionId ? { institutionId } : {}),
        ...(query.weekday ? { weekday: query.weekday } : {})
      },
      include: { program: true, sequence: true },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }]
    });
  });

  app.post('/schedule-blocks', { preHandler: [authenticate, requireRole('SCHEDULER')] }, async (request) => {
    const body = blockSchema.parse(request.body);
    const created = await app.prisma.scheduleBlock.create({ data: body });
    await writeAudit(app, request, 'CREATE', 'SCHEDULE_BLOCK', created.id, `Agendamento criado: ${created.title}`);
    return created;
  });

  app.put('/schedule-blocks/:id', { preHandler: [authenticate, requireRole('SCHEDULER')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = blockSchema.partial().parse(request.body);
    const updated = await app.prisma.scheduleBlock.update({ where: { id }, data: body });
    await writeAudit(app, request, 'UPDATE', 'SCHEDULE_BLOCK', id, `Agendamento atualizado: ${updated.title}`);
    return updated;
  });

  app.delete('/schedule-blocks/:id', { preHandler: [authenticate, requireRole('SCHEDULER')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    await app.prisma.scheduleBlock.delete({ where: { id } });
    await writeAudit(app, request, 'DELETE', 'SCHEDULE_BLOCK', id, 'Agendamento removido');
    return { success: true };
  });
}
