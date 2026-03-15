import path from 'node:path';
import fs from 'node:fs/promises';
import { FastifyInstance } from 'fastify';
import { MediaType, SourceType } from '@prisma/client';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { parseYouTubeUrl } from '../../utils/youtube.js';
import { env } from '../../config/env.js';

const schema = z.object({
  institutionId: z.string(),
  programId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  title: z.string().min(2),
  mediaType: z.nativeEnum(MediaType),
  sourceType: z.nativeEnum(SourceType),
  youtubeUrl: z.string().optional(),
  filePath: z.string().optional(),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
  fileSize: z.number().int().optional(),
  publicUrl: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  durationSeconds: z.number().int().optional(),
  notes: z.string().optional(),
  isFallback: z.boolean().optional(),
  isActive: z.boolean().optional()
});

export async function mediaRoutes(app: FastifyInstance) {
  app.get('/media', { preHandler: [authenticate, requireRole('VIEWER')] }, async (request) => app.prisma.media.findMany({ where: request.authUser?.institutionId ? { institutionId: request.authUser.institutionId } : undefined, include: { program: true, category: true } }));

  app.post('/media', { preHandler: [authenticate, requireRole('EDITOR')] }, async (request) => {
    const body = schema.parse(request.body);
    let youtube = undefined;
    if (body.sourceType === 'YOUTUBE') {
      if (!body.youtubeUrl) throw app.httpErrors.badRequest('youtubeUrl é obrigatório para mídia YouTube');
      youtube = parseYouTubeUrl(body.youtubeUrl);
    }
    return app.prisma.media.create({
      data: {
        ...body,
        youtubeUrl: youtube?.youtubeUrl,
        youtubeVideoId: youtube?.youtubeVideoId,
        embedUrl: youtube?.embedUrl
      }
    });
  });

  app.post('/media/upload/local', { preHandler: [authenticate, requireRole('EDITOR')] }, async (request) => {
    const file = await request.file();
    if (!file) throw app.httpErrors.badRequest('Arquivo ausente');

    const institutionSlug = (file.fields.institutionSlug?.value as string | undefined) ?? 'shared';
    const mediaType = (file.fields.mediaType?.value as string | undefined) ?? 'local_media';
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const folder = path.join(env.STORAGE_ROOT, institutionSlug, mediaType, year, month);
    await fs.mkdir(folder, { recursive: true });

    const safeFilename = `${Date.now()}-${file.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const absolutePath = path.join(folder, safeFilename);
    await file.toFile(absolutePath);

    const stat = await fs.stat(absolutePath);
    const publicUrl = `/uploads/${institutionSlug}/${mediaType}/${year}/${month}/${safeFilename}`;

    return {
      filePath: absolutePath,
      fileName: safeFilename,
      mimeType: file.mimetype,
      fileSize: stat.size,
      publicUrl
    };
  });

  app.put('/media/:id', { preHandler: [authenticate, requireRole('EDITOR')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = schema.partial().parse(request.body);
    return app.prisma.media.update({ where: { id }, data: body });
  });

  app.delete('/media/:id', { preHandler: [authenticate, requireRole('EDITOR')] }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    await app.prisma.media.delete({ where: { id } });
    return { success: true };
  });
}
