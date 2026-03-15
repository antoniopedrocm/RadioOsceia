import { PrismaClient, MediaType, SourceType, UserRole } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await argon2.hash(process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123456');

  const irmaoAureo = await prisma.institution.upsert({
    where: { slug: 'irmao-aureo' },
    update: {},
    create: {
      name: 'Irmão Áureo',
      slug: 'irmao-aureo',
      shortName: 'Irmão Áureo',
      primaryColor: '#1E4FAE',
      secondaryColor: '#D8B45C',
      description: 'Instituição beneficente Irmão Áureo'
    }
  });

  const osceia = await prisma.institution.upsert({
    where: { slug: 'osceia' },
    update: {},
    create: {
      name: 'OSCEIA',
      slug: 'osceia',
      shortName: 'OSCEIA',
      primaryColor: '#0F766E',
      secondaryColor: '#D4A017',
      description: 'Obras sociais e culturais espíritas'
    }
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@radioosceia.dev' },
    update: { passwordHash: adminPassword },
    create: {
      name: 'Administrador',
      email: 'admin@radioosceia.dev',
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
      institutionId: osceia.id
    }
  });

  const catReflexao = await prisma.category.upsert({
    where: { institutionId_slug: { institutionId: osceia.id, slug: 'reflexao' } },
    update: {},
    create: { institutionId: osceia.id, name: 'Reflexão', slug: 'reflexao', color: '#64748B' }
  });

  const presenterAna = await prisma.presenter.upsert({
    where: { institutionId_slug: { institutionId: osceia.id, slug: 'ana-clara' } },
    update: {},
    create: { institutionId: osceia.id, name: 'Ana Clara', slug: 'ana-clara', shortBio: 'Comunicadora voluntária' }
  });

  const programa = await prisma.program.upsert({
    where: { institutionId_slug: { institutionId: osceia.id, slug: 'mensagem-de-luz' } },
    update: {},
    create: {
      institutionId: osceia.id,
      presenterId: presenterAna.id,
      categoryId: catReflexao.id,
      title: 'Mensagem de Luz',
      slug: 'mensagem-de-luz',
      shortDescription: 'Reflexões semanais',
      tags: ['reflexao', 'institucional']
    }
  });

  const ytMedia = await prisma.media.create({
    data: {
      institutionId: osceia.id,
      programId: programa.id,
      categoryId: catReflexao.id,
      title: 'Mensagem de Luz #128',
      mediaType: MediaType.YOUTUBE_VIDEO,
      sourceType: SourceType.YOUTUBE,
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      youtubeVideoId: 'dQw4w9WgXcQ',
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
    }
  });

  await prisma.media.create({
    data: {
      institutionId: osceia.id,
      title: 'Vinheta institucional',
      mediaType: MediaType.VINHETA,
      sourceType: SourceType.LOCAL,
      filePath: '/storage/uploads/osceia/vinheta/mock-vinheta.mp3',
      fileName: 'mock-vinheta.mp3',
      mimeType: 'audio/mpeg',
      fileSize: 256000,
      publicUrl: '/uploads/osceia/vinheta/mock-vinheta.mp3'
    }
  });

  await prisma.media.create({
    data: {
      institutionId: irmaoAureo.id,
      title: 'Áudio local de oração',
      mediaType: MediaType.LOCAL_AUDIO,
      sourceType: SourceType.LOCAL,
      filePath: '/storage/uploads/irmao-aureo/local_audio/mock-oracao.mp3',
      fileName: 'mock-oracao.mp3',
      mimeType: 'audio/mpeg',
      fileSize: 204800,
      publicUrl: '/uploads/irmao-aureo/local_audio/mock-oracao.mp3',
      isFallback: true
    }
  });

  await prisma.scheduleItem.upsert({
    where: { id: 'seed_schedule_osceia_1' },
    update: {},
    create: {
      id: 'seed_schedule_osceia_1',
      institutionId: osceia.id,
      programId: programa.id,
      mediaId: ytMedia.id,
      title: 'Faixa Mensagem de Luz',
      weekday: 1,
      startTime: '14:00',
      endTime: '14:30',
      priority: 10
    }
  });

  await prisma.auditLog.create({
    data: {
      institutionId: osceia.id,
      userId: admin.id,
      action: 'SEED',
      entity: 'SYSTEM',
      description: 'Seed inicial executado com sucesso'
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
