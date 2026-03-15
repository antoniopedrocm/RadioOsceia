import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export default fp(async (app) => {
  app.decorate('prisma', prisma);

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
});
