import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { createAuditLog } from '../../services/audit-log.service.js';
import { resolveSequenceTimeline } from '../../services/playback-resolver.service.js';

const itemStartModeSchema = z.enum(['FIXED_TIME', 'AFTER_PREVIOUS']);

const sequenceSchema = z.object({
  institutionId: z.string(),
  programId: z.string().nullable().optional(),
  title: z.string().min(2),
  description: z.string().optional(),
  isActive: z.boolean().optional()
});

const sequenceItemSchema = z.object({
  mediaId: z.string(),
  orderIndex: z.number().int().min(1),
  startMode: itemStartModeSchema,
  fixedStartTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  relativeOffsetSeconds: z.number().int().min(0).optional(),
  notes: z.string().optional()
});

async function audit(app: FastifyInstance, request: any, action: string, entity: string, entityId: string, description: string, metadata?: unknown) {
  await createAuditLog(app, {
    institutionId: request.authUser?.institutionId ?? undefined,
    userId: request.authUser?.id,
    action,
    entity,
    entityId,
    description,
    metadata
  });
}

export async function playbackSequenceRoutes(app: FastifyInstance) {
  app.get('/playback-sequences', { preHandler: [authenticate, requireRole('VIEWER')] }, async (request) => {
    const institutionId = (request.query as any)?.institutionId ?? request.authUser?.institutionId;
    return app.prisma.playbackSequence.findMany({
      where: institutionId ? { institutionId } : undefined,
      include: { items: { include: { media: true }, orderBy: { orderIndex: 'asc' } }, program: true },
      orderBy: { createdAt: 'desc' }
    });
  });

  app.get('/playback-sequences/:id', { preHandler: [authenticate, requireRole('VIEWER')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return app.prisma.playbackSequence.findUniqueOrThrow({
      where: { id },
      include: { items: { include: { media: true }, orderBy: { orderIndex: 'asc' } }, program: true }
    });
  });

  app.post('/playback-sequences', { preHandler: [authenticate, requireRole('EDITOR')] }, async (request) => {
    const body = sequenceSchema.parse(request.body);
    const created = await app.prisma.playbackSequence.create({ data: body });
    await audit(app, request, 'CREATE', 'PLAYBACK_SEQUENCE', created.id, `Sequência criada: ${created.title}`);
    return created;
  });

  app.put('/playback-sequences/:id', { preHandler: [authenticate, requireRole('EDITOR')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = sequenceSchema.partial().parse(request.body);
    const updated = await app.prisma.playbackSequence.update({ where: { id }, data: body });
    await audit(app, request, 'UPDATE', 'PLAYBACK_SEQUENCE', id, `Sequência atualizada: ${updated.title}`);
    return updated;
  });

  app.delete('/playback-sequences/:id', { preHandler: [authenticate, requireRole('EDITOR')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    await app.prisma.playbackSequence.delete({ where: { id } });
    await audit(app, request, 'DELETE', 'PLAYBACK_SEQUENCE', id, 'Sequência removida');
    return { success: true };
  });

  app.post('/playback-sequences/:id/items', { preHandler: [authenticate, requireRole('EDITOR')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = sequenceItemSchema.parse(request.body);

    const media = await app.prisma.media.findUniqueOrThrow({ where: { id: body.mediaId } });
    if (body.startMode === 'AFTER_PREVIOUS' && !media.durationSeconds) {
      throw app.httpErrors.badRequest('Mídia sem duração não pode usar AFTER_PREVIOUS');
    }

    const created = await app.prisma.playbackSequenceItem.create({
      data: {
        sequenceId: id,
        mediaId: body.mediaId,
        orderIndex: body.orderIndex,
        startMode: body.startMode,
        fixedStartTime: body.fixedStartTime,
        relativeOffsetSeconds: body.relativeOffsetSeconds ?? 0,
        startAfterPrevious: body.startMode === 'AFTER_PREVIOUS',
        notes: body.notes
      }
    });

    await audit(app, request, 'CREATE', 'PLAYBACK_SEQUENCE_ITEM', created.id, 'Item de sequência criado');
    return created;
  });

  app.put('/playback-sequences/:id/items/:itemId', { preHandler: [authenticate, requireRole('EDITOR')] }, async (request) => {
    const { id, itemId } = z.object({ id: z.string(), itemId: z.string() }).parse(request.params);
    const body = sequenceItemSchema.partial().parse(request.body);

    const updated = await app.prisma.playbackSequenceItem.update({
      where: { id: itemId },
      data: {
        ...body,
        sequenceId: id,
        startAfterPrevious: body.startMode ? body.startMode === 'AFTER_PREVIOUS' : undefined
      }
    });

    await audit(app, request, 'UPDATE', 'PLAYBACK_SEQUENCE_ITEM', itemId, 'Item de sequência atualizado');
    return updated;
  });

  app.delete('/playback-sequences/:id/items/:itemId', { preHandler: [authenticate, requireRole('EDITOR')] }, async (request) => {
    const { itemId } = z.object({ id: z.string(), itemId: z.string() }).parse(request.params);
    await app.prisma.playbackSequenceItem.delete({ where: { id: itemId } });
    await audit(app, request, 'DELETE', 'PLAYBACK_SEQUENCE_ITEM', itemId, 'Item de sequência removido');
    return { success: true };
  });

  app.put('/playback-sequences/:id/reorder', { preHandler: [authenticate, requireRole('EDITOR')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ itemIds: z.array(z.string()).min(1) }).parse(request.body);

    await app.prisma.$transaction(body.itemIds.map((itemId, index) => app.prisma.playbackSequenceItem.update({ where: { id: itemId }, data: { orderIndex: index + 1, sequenceId: id } })));

    await audit(app, request, 'REORDER', 'PLAYBACK_SEQUENCE_ITEM', id, 'Ordem dos itens alterada', body);
    return app.prisma.playbackSequenceItem.findMany({ where: { sequenceId: id }, orderBy: { orderIndex: 'asc' } });
  });

  app.get('/playback-sequences/:id/validate', { preHandler: [authenticate, requireRole('VIEWER')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const sequence = await app.prisma.playbackSequence.findUniqueOrThrow({
      where: { id },
      include: { items: { include: { media: true }, orderBy: { orderIndex: 'asc' } } }
    });

    const { timeline, conflicts } = resolveSequenceTimeline(sequence, new Date());
    return { valid: conflicts.length === 0, conflicts, timeline };
  });
}
