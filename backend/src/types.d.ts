import { PrismaClient, UserRole } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }

  interface FastifyRequest {
    authUser?: {
      id: string;
      role: UserRole;
      institutionId: string | null;
      email: string;
    };
  }
}
