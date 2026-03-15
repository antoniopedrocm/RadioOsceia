import { MediaType, SourceType } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { parseYouTubeUrl } from '../../utils/youtube.js';

const timeRegex = /^\d{2}:\d{2}$/;

const scheduleBaseSchema = z.object({
  institutionId: z.string(),
  programId: z.string().optional().nullable(),
  title: z.string().min(2),
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(timeRegex),
  endTime: z.string().regex(timeRegex),
  priority: z.number().int().default(0),
  repeatRule: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional()
});

const scheduleCreateSchema = scheduleBaseSchema.extend({
  mediaId: z.string().optional(),
  mediaSourceType: z.enum(['youtube', 'arquivo_local']).optional(),
  youtubeUrl: z.string().optional(),
  localFilePath: z.string().optional()
});

const scheduleUpdateSchema = scheduleCreateSchema.partial();

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours * 60) + minutes;
}

function validateTimeRangeOrThrow(app: FastifyInstance, startTime: string, endTime: string) {
  if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
    throw app.httpErrors.badRequest('Horário inválido: startTime deve ser menor que endTime');
  }
}

async function ensureNoOverlapOrThrow(
  app: FastifyInstance,
  payload: { institutionId: string; weekday: number; startTime: string; endTime: string },
  excludeId?: string
) {
  const scheduleItems = await app.prisma.scheduleItem.findMany({
    where: {
      institutionId: payload.institutionId,
      weekday: payload.weekday,
      isActive: true,
      ...(excludeId ? { id: { not: excludeId } } : {})
    },
    select: { id: true, title: true, startTime: true, endTime: true }
  });

  const start = timeToMinutes(payload.startTime);
  const end = timeToMinutes(payload.endTime);

  const overlap = scheduleItems.find((item) => {
    const itemStart = timeToMinutes(item.startTime);
    const itemEnd = timeToMinutes(item.endTime);
    return start < itemEnd && end > itemStart;
  });

  if (overlap) {
    throw app.httpErrors.conflict(`Conflito de horário com "${overlap.title}" (${overlap.startTime} - ${overlap.endTime})`);
  }
}

async function resolveMediaIdForSchedule(
  app: FastifyInstance,
  payload: { institutionId: string; title: string; mediaId?: string; mediaSourceType?: 'youtube' | 'arquivo_local'; youtubeUrl?: string; localFilePath?: string }
): Promise<string> {
  if (payload.mediaId) {
    const media = await app.prisma.media.findFirst({ where: { id: payload.mediaId, institutionId: payload.institutionId, isActive: true }, select: { id: true } });
    if (!media) {
      throw app.httpErrors.badRequest('mediaId inválido para a instituição informada');
    }
    return media.id;
  }

  if (!payload.mediaSourceType) {
    throw app.httpErrors.badRequest('Informe mediaId ou mediaSourceType');
  }

  if (payload.mediaSourceType === 'youtube') {
    if (!payload.youtubeUrl) {
      throw app.httpErrors.badRequest('youtubeUrl é obrigatório para mediaSourceType=youtube');
    }

    const youtube = parseYouTubeUrl(payload.youtubeUrl);
    const existingMedia = await app.prisma.media.findFirst({
      where: { institutionId: payload.institutionId, sourceType: SourceType.YOUTUBE, youtubeVideoId: youtube.youtubeVideoId, isActive: true },
      select: { id: true }
    });

    if (existingMedia) return existingMedia.id;

    const createdMedia = await app.prisma.media.create({
      data: {
        institutionId: payload.institutionId,
        title: payload.title,
        mediaType: MediaType.YOUTUBE_VIDEO,
        sourceType: SourceType.YOUTUBE,
        youtubeUrl: youtube.youtubeUrl,
        youtubeVideoId: youtube.youtubeVideoId,
        embedUrl: youtube.embedUrl,
        isActive: true
      },
      select: { id: true }
    });

    return createdMedia.id;
  }

  if (!payload.localFilePath) {
    throw app.httpErrors.badRequest('localFilePath é obrigatório para mediaSourceType=arquivo_local');
  }

  const localMedia = await app.prisma.media.findFirst({
    where: {
      institutionId: payload.institutionId,
      sourceType: SourceType.LOCAL,
      isActive: true,
      OR: [
        { publicUrl: payload.localFilePath },
        { filePath: payload.localFilePath },
        { fileName: payload.localFilePath }
      ]
    },
    select: { id: true }
  });

  if (!localMedia) {
    throw app.httpErrors.badRequest('Arquivo local não encontrado entre as mídias cadastradas');
  }

  return localMedia.id;
}

export async function scheduleRoutes(app: FastifyInstance) {
  app.get('/public/institutions/:slug/schedule', async (request) => {
    const { slug, weekday } = z.object({ slug: z.string(), weekday: z.coerce.number().optional() }).parse({ ...request.params, ...request.query });
    const institution = await app.prisma.institution.findUniqueOrThrow({ where: { slug } });
    return app.prisma.scheduleItem.findMany({ where: { institutionId: institution.id, ...(weekday !== undefined ? { weekday } : {}), isActive: true }, include: { media: true, program: true }, orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] });
  });

  app.get('/public/institutions/:slug/schedule/today', async (request) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    const institution = await app.prisma.institution.findUniqueOrThrow({ where: { slug } });
    return app.prisma.scheduleItem.findMany({ where: { institutionId: institution.id, weekday: new Date().getDay(), isActive: true }, include: { media: true, program: true }, orderBy: [{ startTime: 'asc' }, { priority: 'desc' }] });
  });

  app.get('/schedule-items', { preHandler: [authenticate, requireRole('VIEWER')] }, async (request) => app.prisma.scheduleItem.findMany({ where: request.authUser?.institutionId ? { institutionId: request.authUser.institutionId } : undefined, include: { media: true, program: true }, orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] }));

  app.post('/schedule-items', { preHandler: [authenticate, requireRole('SCHEDULER')] }, async (request) => {
    const body = scheduleCreateSchema.parse(request.body);
    validateTimeRangeOrThrow(app, body.startTime, body.endTime);
    await ensureNoOverlapOrThrow(app, body);

    const mediaId = await resolveMediaIdForSchedule(app, body);

    return app.prisma.scheduleItem.create({
      data: {
        institutionId: body.institutionId,
        programId: body.programId,
        mediaId,
        title: body.title,
        weekday: body.weekday,
        startTime: body.startTime,
        endTime: body.endTime,
        priority: body.priority,
        repeatRule: body.repeatRule,
        notes: body.notes,
        isActive: body.isActive
      }
    });
  });

  app.put('/schedule-items/:id', { preHandler: [authenticate, requireRole('SCHEDULER')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = scheduleUpdateSchema.parse(request.body);

    const existing = await app.prisma.scheduleItem.findUniqueOrThrow({ where: { id } });

    const merged = {
      institutionId: body.institutionId ?? existing.institutionId,
      title: body.title ?? existing.title,
      weekday: body.weekday ?? existing.weekday,
      startTime: body.startTime ?? existing.startTime,
      endTime: body.endTime ?? existing.endTime,
      mediaId: body.mediaId,
      mediaSourceType: body.mediaSourceType,
      youtubeUrl: body.youtubeUrl,
      localFilePath: body.localFilePath
    };

    validateTimeRangeOrThrow(app, merged.startTime, merged.endTime);
    await ensureNoOverlapOrThrow(app, merged, id);

    const shouldResolveMedia = Boolean(body.mediaId || body.mediaSourceType || body.youtubeUrl || body.localFilePath);
    const mediaId = shouldResolveMedia ? await resolveMediaIdForSchedule(app, merged) : undefined;

    return app.prisma.scheduleItem.update({
      where: { id },
      data: {
        institutionId: body.institutionId,
        programId: body.programId,
        mediaId,
        title: body.title,
        weekday: body.weekday,
        startTime: body.startTime,
        endTime: body.endTime,
        priority: body.priority,
        repeatRule: body.repeatRule,
        notes: body.notes,
        isActive: body.isActive
      }
    });
  });

  app.delete('/schedule-items/:id', { preHandler: [authenticate, requireRole('SCHEDULER')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    await app.prisma.scheduleItem.delete({ where: { id } });
    return { success: true };
  });
}
