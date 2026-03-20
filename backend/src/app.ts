import path from 'node:path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import prismaPlugin from './plugins/prisma.js';
import { env } from './config/env.js';
import { authRoutes } from './modules/auth/routes.js';
import { institutionRoutes } from './modules/institutions/routes.js';
import { userRoutes } from './modules/users/routes.js';
import { presenterRoutes } from './modules/presenters/routes.js';
import { categoryRoutes } from './modules/categories/routes.js';
import { programRoutes } from './modules/programs/routes.js';
import { mediaRoutes } from './modules/media/routes.js';
import { scheduleRoutes } from './modules/schedule/routes.js';
import { playbackRoutes } from './modules/playback/routes.js';
import { playbackSequenceRoutes } from './modules/playback-sequences/routes.js';
import { dashboardRoutes } from './modules/dashboard/routes.js';
import { logRoutes } from './modules/logs/routes.js';

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(sensible);
  await app.register(cors, { origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') });
  await app.register(rateLimit, { global: false, max: 10, timeWindow: '1 minute' });
  await app.register(jwt, { secret: env.JWT_SECRET, sign: { expiresIn: env.JWT_EXPIRES_IN } });
  await app.register(multipart, { limits: { fileSize: 300 * 1024 * 1024 } });
  await app.register(prismaPlugin);

  await app.register(fastifyStatic, {
    root: path.resolve(env.STORAGE_ROOT),
    prefix: '/uploads/'
  });

  app.setErrorHandler((error: any, _request, reply) => {
    app.log.error(error);
    reply.status(error.statusCode ?? 500).send({ message: error.message, code: error.code ?? 'INTERNAL_ERROR' });
  });

  await app.register(async (v1) => {
    v1.get('/health', async () => ({ ok: true }));
    await authRoutes(v1);
    await institutionRoutes(v1);
    await userRoutes(v1);
    await presenterRoutes(v1);
    await categoryRoutes(v1);
    await programRoutes(v1);
    await mediaRoutes(v1);
    await scheduleRoutes(v1);
    await playbackSequenceRoutes(v1);
    await playbackRoutes(v1);
    await dashboardRoutes(v1);
    await logRoutes(v1);
  }, { prefix: '/api/v1' });

  return app;
}
