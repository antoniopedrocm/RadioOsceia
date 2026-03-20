import { PrismaClient, SourceType, UserRole } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await argon2.hash(process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123456');
  const operatorPassword = await argon2.hash(process.env.SEED_OPERATOR_PASSWORD ?? 'Operador@123456');

  const osceia = await prisma.institution.upsert({
    where: { slug: 'osceia' },
    update: {},
    create: { name: 'OSCEIA', slug: 'osceia', shortName: 'OSCEIA', primaryColor: '#0F766E' }
  });

  const irmaoAureo = await prisma.institution.upsert({
    where: { slug: 'irmao-aureo' },
    update: {},
    create: { name: 'Irmão Áureo', slug: 'irmao-aureo', shortName: 'Irmão Áureo', primaryColor: '#1E4FAE' }
  });

  await prisma.user.upsert({
    where: { email: 'admin@radioosceia.dev' },
    update: { passwordHash: adminPassword, role: UserRole.ADMIN, institutionId: osceia.id },
    create: { name: 'Administrador', email: 'admin@radioosceia.dev', passwordHash: adminPassword, role: UserRole.ADMIN, institutionId: osceia.id }
  });

  await prisma.user.upsert({
    where: { email: 'operador@radioosceia.dev' },
    update: { passwordHash: operatorPassword, role: UserRole.OPERATOR, institutionId: osceia.id },
    create: { name: 'Operador', email: 'operador@radioosceia.dev', passwordHash: operatorPassword, role: UserRole.OPERATOR, institutionId: osceia.id }
  });

  const program = await prisma.program.upsert({
    where: { institutionId_slug: { institutionId: osceia.id, slug: 'evangelho-no-lar' } },
    update: {},
    create: { institutionId: osceia.id, title: 'Evangelho no Lar', slug: 'evangelho-no-lar', description: 'Programa semanal', tags: [] }
  });

  const abertura = await prisma.media.create({
    data: {
      institutionId: osceia.id,
      programId: program.id,
      title: 'Abertura',
      mediaType: 'INTRODUCAO',
      sourceType: SourceType.LOCAL,
      filePath: '/storage/uploads/osceia/introducao/2026/03/abertura.mp3',
      fileName: 'abertura.mp3',
      mimeType: 'audio/mpeg',
      publicUrl: '/uploads/osceia/introducao/2026/03/abertura.mp3',
      durationSeconds: 120
    }
  });

  const yt = await prisma.media.create({
    data: {
      institutionId: osceia.id,
      programId: program.id,
      title: 'Palestra principal',
      mediaType: 'PROGRAMA',
      sourceType: SourceType.YOUTUBE,
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      youtubeVideoId: 'dQw4w9WgXcQ',
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      durationSeconds: 3600
    }
  });

  const sequence = await prisma.playbackSequence.create({
    data: {
      institutionId: osceia.id,
      programId: program.id,
      title: 'Bloco Evangelho no Lar',
      items: {
        create: [
          { mediaId: abertura.id, orderIndex: 1, startMode: 'FIXED_TIME', fixedStartTime: '08:00', startAfterPrevious: false },
          { mediaId: yt.id, orderIndex: 2, startMode: 'AFTER_PREVIOUS', relativeOffsetSeconds: 0, startAfterPrevious: true }
        ]
      }
    }
  });

  await prisma.scheduleBlock.create({
    data: {
      institutionId: osceia.id,
      programId: program.id,
      sequenceId: sequence.id,
      title: 'Evangelho no Lar - Segunda',
      weekday: 'MONDAY',
      startTime: '08:00',
      timezone: 'America/Sao_Paulo'
    }
  });

  await prisma.media.create({
    data: {
      institutionId: irmaoAureo.id,
      title: 'Vinheta local',
      mediaType: 'VINHETA',
      sourceType: SourceType.LOCAL,
      filePath: '/storage/uploads/irmao-aureo/vinheta/2026/03/vinheta.mp3',
      fileName: 'vinheta.mp3',
      publicUrl: '/uploads/irmao-aureo/vinheta/2026/03/vinheta.mp3',
      durationSeconds: 15
    }
  });
}

main().finally(async () => prisma.$disconnect());
