import path from 'node:path';
import fs from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { lookup as mimeLookup } from 'mime-types';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { parseYouTubeUrl } from '../../utils/youtube.js';
import { env } from '../../config/env.js';
import { createAuditLog } from '../../services/audit-log.service.js';

const mediaTypeSchema = z.enum(['PROGRAMA', 'VINHETA', 'INTRODUCAO', 'ENCERRAMENTO', 'CHAMADA', 'AUDIO', 'VIDEO']);
const mediaStatusSchema = z.enum(['ACTIVE', 'DRAFT', 'INACTIVE']);

const youtubeSchema = z.object({
  institutionId: z.string(),
  programId: z.string().optional().nullable(),
  title: z.string().min(2),
  mediaType: mediaTypeSchema,
  youtubeUrl: z.string().url(),
  durationSeconds: z.number().int().positive(),
  thumbnailUrl: z.string().optional(),
  status: mediaStatusSchema.optional(),
  notes: z.string().optional()
});

const localRegisterSchema = z.object({
  institutionId: z.string(),
  programId: z.string().optional().nullable(),
  title: z.string().min(2),
  mediaType: mediaTypeSchema,
  filePath: z.string().min(3),
  publicUrl: z.string().optional(),
  durationSeconds: z.number().int().positive(),
  status: mediaStatusSchema.optional(),
  notes: z.string().optional()
});

const updateSchema = z.object({
  title: z.string().min(2).optional(),
  mediaType: mediaTypeSchema.optional(),
  durationSeconds: z.number().int().positive().optional(),
  thumbnailUrl: z.string().optional(),
  isActive: z.boolean().optional(),
  programId: z.string().nullable().optional()
});

async function createMediaAudit(app: FastifyInstance, request: any, action: string, entityId: string, description: string, metadata?: unknown) {
  await createAuditLog(app, {
    institutionId: request.authUser?.institutionId ?? undefined,
    userId: request.authUser?.id,
    action,
    entity: 'MEDIA',
    entityId,
    description,
    metadata
  });
}

export async function mediaRoutes(app: FastifyInstance) {
  app.get('/media', { preHandler: [authenticate, requireRole('VIEWER')] }, async (request) => {
    const institutionId = (request.query as any)?.institutionId ?? request.authUser?.institutionId;
    return app.prisma.media.findMany({ where: institutionId ? { institutionId } : undefined, orderBy: { createdAt: 'desc' } });
  });

  app.get('/media/:id', { preHandler: [authenticate, requireRole('VIEWER')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return app.prisma.media.findUniqueOrThrow({ where: { id } });
  });

  app.post('/media/youtube', { preHandler: [authenticate, requireRole('EDITOR')] }, async (request) => {
    const body = youtubeSchema.parse(request.body);
    app.log.info({ route: '/media/youtube', institutionId: body.institutionId, mediaType: body.mediaType, programId: body.programId }, 'media:create youtube request');
    const youtube = parseYouTubeUrl(body.youtubeUrl);

    const media = await app.prisma.media.create({
      data: {
        institutionId: body.institutionId,
        programId: body.programId,
        title: body.title,
        mediaType: body.mediaType,
        sourceType: 'YOUTUBE',
        youtubeUrl: youtube.youtubeUrl,
        youtubeVideoId: youtube.youtubeVideoId,
        embedUrl: youtube.embedUrl,
        durationSeconds: body.durationSeconds,
        thumbnailUrl: body.thumbnailUrl,
        notes: body.notes,
        isActive: body.status ? body.status === 'ACTIVE' : true
      }
    });

    await createMediaAudit(app, request, 'CREATE_YOUTUBE_MEDIA', media.id, `Mídia YouTube criada: ${media.title}`);
    return media;
  });

  app.post('/media/local-upload', { preHandler: [authenticate, requireRole('EDITOR')] }, async (request) => {
    const file = await request.file();
    if (!file) throw app.httpErrors.badRequest('Arquivo ausente');

    const fields = file.fields as any;
    const institutionId = String(fields.institutionId?.value ?? '');
    const title = String(fields.title?.value ?? '');
    const mediaType = mediaTypeSchema.parse(String(fields.mediaType?.value ?? 'VIDEO'));
    const durationSeconds = Number(fields.durationSeconds?.value);
    const programId = fields.programId?.value ? String(fields.programId.value) : null;
    const status = fields.status?.value ? mediaStatusSchema.parse(String(fields.status.value)) : 'ACTIVE';
    const notes = fields.notes?.value ? String(fields.notes.value) : null;
    app.log.info({ route: '/media/local-upload', institutionId, mediaType, programId }, 'media:create local-upload request');

    if (!institutionId || !title || !Number.isFinite(durationSeconds)) {
      throw app.httpErrors.badRequest('institutionId, title e durationSeconds são obrigatórios');
    }

    const institution = await app.prisma.institution.findUniqueOrThrow({ where: { id: institutionId } });
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const folder = path.join(env.STORAGE_ROOT, institution.slug, mediaType.toLowerCase(), year, month);
    await fs.mkdir(folder, { recursive: true });

    const safeFilename = `${Date.now()}-${file.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const absolutePath = path.join(folder, safeFilename);
    await pipeline(file.file, (await import('node:fs')).createWriteStream(absolutePath));

    const stat = await fs.stat(absolutePath);
    const publicUrl = `/uploads/${institution.slug}/${mediaType.toLowerCase()}/${year}/${month}/${safeFilename}`;

    const media = await app.prisma.media.create({
      data: {
        institutionId,
        programId,
        title,
        mediaType,
        sourceType: 'LOCAL',
        filePath: absolutePath,
        fileName: safeFilename,
        mimeType: file.mimetype,
        fileSize: stat.size,
        publicUrl,
        durationSeconds: Math.trunc(durationSeconds),
        notes,
        isActive: status === 'ACTIVE'
      }
    });

    await createMediaAudit(app, request, 'CREATE_LOCAL_MEDIA_UPLOAD', media.id, `Upload local criado: ${media.title}`);
    return media;
  });

  app.post('/media/local-register', { preHandler: [authenticate, requireRole('EDITOR')] }, async (request) => {
    const body = localRegisterSchema.parse(request.body);
    app.log.info({ route: '/media/local-register', institutionId: body.institutionId, mediaType: body.mediaType, programId: body.programId }, 'media:create local-register request');
    const fileName = path.basename(body.filePath);

    const media = await app.prisma.media.create({
      data: {
        institutionId: body.institutionId,
        programId: body.programId,
        title: body.title,
        mediaType: body.mediaType,
        sourceType: 'LOCAL',
        filePath: body.filePath,
        fileName,
        mimeType: mimeLookup(fileName) || null,
        publicUrl: body.publicUrl ?? body.filePath,
        durationSeconds: body.durationSeconds,
        notes: body.notes,
        isActive: body.status ? body.status === 'ACTIVE' : true
      }
    });

    await createMediaAudit(app, request, 'CREATE_LOCAL_MEDIA_REGISTER', media.id, `Mídia local cadastrada manualmente: ${media.title}`);
    return media;
  });

  app.put('/media/:id', { preHandler: [authenticate, requireRole('EDITOR')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = updateSchema.parse(request.body);
    return app.prisma.media.update({ where: { id }, data: body });
  });

  app.delete('/media/:id', { preHandler: [authenticate, requireRole('EDITOR')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    await app.prisma.media.delete({ where: { id } });
    await createMediaAudit(app, request, 'DELETE_MEDIA', id, 'Mídia removida');
    return { success: true };
  });
}
