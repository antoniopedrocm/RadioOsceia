import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { parseYoutubeUrl } from './youtube.js';
import {
  buildNowPlayingPayload as buildSharedNowPlayingPayload,
  getDashboardSummary as getSharedDashboardSummary,
  resolveTimeline as resolveSharedTimeline,
  type DashboardDataAdapter,
  type TimelineMedia,
  type TimelineScheduleBlock,
  type TimelineSequenceItem
} from '../../src/lib/timeline.js';

initializeApp();

const db = getFirestore();

function requireAuth(auth: { uid: string } | null | undefined) {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Usuário não autenticado.');
  }

  return auth.uid;
}

async function requireAdminOrOperator(uid: string) {
  const userDoc = await db.collection('users').doc(uid).get();
  const role = String(userDoc.data()?.role ?? 'operador');
  if (!['admin', 'operador'].includes(role)) {
    throw new HttpsError('permission-denied', 'Perfil sem permissão para esta operação.');
  }
}

export const createYoutubeMedia = onCall(async (request) => {
  const uid = requireAuth(request.auth);
  await requireAdminOrOperator(uid);

  const data = request.data as {
    title: string;
    mediaType: string;
    youtubeUrl: string;
    durationSeconds?: number;
    programId?: string;
    notes?: string;
    status?: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
  };

  if (!data.title?.trim() || !data.youtubeUrl?.trim()) {
    throw new HttpsError('invalid-argument', 'Título e URL do YouTube são obrigatórios.');
  }

  const parsed = parseYoutubeUrl(data.youtubeUrl);

  const mediaRef = db.collection('media').doc();
  await mediaRef.set({
    title: data.title.trim(),
    mediaType: data.mediaType ?? 'VIDEO',
    sourceType: 'YOUTUBE',
    ...parsed,
    durationSeconds: Number(data.durationSeconds ?? 0),
    programId: data.programId ?? null,
    notes: data.notes ?? null,
    isActive: data.status !== 'INACTIVE',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: uid
  });

  return { id: mediaRef.id };
});

export const createPlaybackSequence = onCall(async (request) => {
  const uid = requireAuth(request.auth);
  await requireAdminOrOperator(uid);

  const data = request.data as {
    title: string;
    notes?: string;
    items?: Array<{ mediaId: string; orderIndex: number; startMode: string; fixedStartTime?: string; relativeOffsetSeconds?: number; startAfterPrevious?: boolean }>;
  };

  const sequenceRef = db.collection('playbackSequences').doc();
  await sequenceRef.set({
    title: data.title,
    notes: data.notes ?? null,
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: uid
  });

  for (const item of data.items ?? []) {
    await sequenceRef.collection('items').add({
      ...item,
      startAfterPrevious: item.startAfterPrevious ?? true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  }

  return { id: sequenceRef.id };
});

export const saveScheduleBlock = onCall(async (request) => {
  const uid = requireAuth(request.auth);
  await requireAdminOrOperator(uid);

  const data = request.data as {
    id?: string;
    title: string;
    weekday: number;
    startTime: string;
    endTime?: string;
    sequenceId: string;
    programId?: string;
    isActive?: boolean;
  };

  const blockRef = data.id ? db.collection('scheduleBlocks').doc(data.id) : db.collection('scheduleBlocks').doc();

  await blockRef.set({
    title: data.title,
    weekday: data.weekday,
    startTime: data.startTime,
    endTime: data.endTime ?? null,
    sequenceId: data.sequenceId,
    programId: data.programId ?? null,
    isActive: data.isActive ?? true,
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: data.id ? undefined : FieldValue.serverTimestamp(),
    updatedBy: uid
  }, { merge: true });

  return { id: blockRef.id };
});

async function loadTimelineBlocks(weekday: number): Promise<TimelineScheduleBlock[]> {
  const blocksSnapshot = await db.collection('scheduleBlocks')
    .where('weekday', '==', weekday)
    .where('isActive', '==', true)
    .orderBy('startTime', 'asc')
    .get();

  return blocksSnapshot.docs.map((blockDoc) => {
    const blockData = blockDoc.data();
    return {
      id: blockDoc.id,
      title: String(blockData.title ?? 'Bloco sem título'),
      weekday: blockData.weekday,
      startTime: String(blockData.startTime ?? '00:00'),
      endTime: typeof blockData.endTime === 'string' ? blockData.endTime : null,
      sequenceId: String(blockData.sequenceId ?? ''),
      programId: typeof blockData.programId === 'string' ? blockData.programId : null,
      isActive: Boolean(blockData.isActive ?? true)
    } satisfies TimelineScheduleBlock;
  }).filter((block) => block.sequenceId);
}

async function loadSequenceItems(sequenceId: string): Promise<TimelineSequenceItem[]> {
  const itemsSnapshot = await db.collection('playbackSequences').doc(sequenceId).collection('items').orderBy('orderIndex', 'asc').get();

  return itemsSnapshot.docs.map((itemDoc, index) => {
    const item = itemDoc.data();
    return {
      id: itemDoc.id,
      mediaId: String(item.mediaId ?? ''),
      orderIndex: Number(item.orderIndex ?? index + 1),
      startMode: typeof item.startMode === 'string' ? item.startMode : 'IMMEDIATE',
      fixedStartTime: typeof item.fixedStartTime === 'string' ? item.fixedStartTime : undefined,
      relativeOffsetSeconds: Number(item.relativeOffsetSeconds ?? 0),
      startAfterPrevious: Boolean(item.startAfterPrevious ?? true)
    } satisfies TimelineSequenceItem;
  }).filter((item) => item.mediaId);
}

async function loadMedia(mediaId: string): Promise<TimelineMedia | null> {
  const mediaDoc = await db.collection('media').doc(mediaId).get();
  if (!mediaDoc.exists) return null;
  const mediaData = mediaDoc.data() ?? {};

  return {
    id: mediaDoc.id,
    title: String(mediaData.title ?? 'Mídia sem título'),
    mediaType: String(mediaData.mediaType ?? 'VIDEO'),
    sourceType: typeof mediaData.sourceType === 'string' ? mediaData.sourceType : 'YOUTUBE',
    youtubeUrl: typeof mediaData.youtubeUrl === 'string' ? mediaData.youtubeUrl : undefined,
    youtubeVideoId: typeof mediaData.youtubeVideoId === 'string' ? mediaData.youtubeVideoId : undefined,
    embedUrl: typeof mediaData.embedUrl === 'string' ? mediaData.embedUrl : undefined,
    thumbnailUrl: typeof mediaData.thumbnailUrl === 'string' ? mediaData.thumbnailUrl : undefined,
    durationSeconds: Number(mediaData.durationSeconds ?? 0)
  };
}

const timelineAdapter: DashboardDataAdapter = {
  loadTimelineBlocks,
  loadSequenceItems,
  loadMedia,
  async countPrograms() {
    const snapshot = await db.collection('programs').count().get();
    return snapshot.data().count;
  },
  async countMedia() {
    const snapshot = await db.collection('media').count().get();
    return snapshot.data().count;
  }
};

async function resolveTimeline(weekday: number) {
  return resolveSharedTimeline(weekday, timelineAdapter);
}

async function buildNowPlayingPayload() {
  return buildSharedNowPlayingPayload(timelineAdapter);
}

export const getTimeline = onCall(async (request) => {
  const weekday = Number((request.data as { weekday?: number }).weekday ?? new Date().getDay());
  const blocks = await resolveTimeline(weekday);
  return { blocks };
});

export const getNowPlaying = onCall(async () => buildNowPlayingPayload());

export const getUpNext = onCall(async () => {
  const data = await buildNowPlayingPayload();
  return { upNext: data.upNext ?? [] };
});

export const getDashboardSummary = onCall(async () => getSharedDashboardSummary(timelineAdapter));

export const bootstrapSeedData = onCall(async () => {
  const auth = getAuth();

  await db.collection('settings').doc('app').set({
    institutionName: 'Irmão Áureo',
    logo: '',
    primaryColor: '#0f172a',
    secondaryColor: '#d97706',
    playerPosition: 'bottom',
    showQueue: true,
    showCover: true,
    autoplayVisual: false,
    institutionalLinks: [{ label: 'Site oficial', url: 'https://example.org' }],
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  const programRef = db.collection('programs').doc('programa-manha');
  await programRef.set({
    title: 'Manhã com Esperança',
    slug: 'manha-com-esperanca',
    description: 'Programa matinal da Rádio Irmão Áureo.',
    coverUrl: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?q=80&w=900',
    presenterId: 'apresentador-joao',
    tags: ['manhã', 'institucional'],
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  await db.collection('presenters').doc('apresentador-joao').set({
    name: 'João Áureo',
    slug: 'joao-aureo',
    shortBio: 'Comunicador institucional.',
    fullBio: 'Apresentador oficial da Rádio Irmão Áureo.',
    photoUrl: 'https://i.pravatar.cc/300?img=12',
    roleTitle: 'Apresentador',
    isActive: true
  }, { merge: true });

  const mediaRef = db.collection('media').doc('media-abertura');
  await mediaRef.set({
    title: 'Abertura Institucional',
    mediaType: 'VINHETA',
    sourceType: 'YOUTUBE',
    youtubeUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    youtubeVideoId: 'jfKfPfyJRdk',
    embedUrl: 'https://www.youtube.com/embed/jfKfPfyJRdk',
    thumbnailUrl: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
    durationSeconds: 180,
    notes: 'Seed inicial',
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  const sequenceRef = db.collection('playbackSequences').doc('sequencia-manha');
  await sequenceRef.set({ title: 'Sequência da manhã', isActive: true, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await sequenceRef.collection('items').doc('item-1').set({ mediaId: mediaRef.id, orderIndex: 1, startMode: 'IMMEDIATE', startAfterPrevious: true }, { merge: true });

  await db.collection('scheduleBlocks').doc('bloco-domingo-08h').set({
    title: 'Bloco Matinal',
    weekday: 0,
    startTime: '08:00',
    endTime: '10:00',
    sequenceId: sequenceRef.id,
    programId: programRef.id,
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  const users = [
    { uid: 'admin-radio', email: 'admin@irmaoaureo.dev', password: 'Admin@123456', role: 'admin', name: 'Administrador Rádio Irmão Áureo' },
    { uid: 'operador-radio', email: 'operador@irmaoaureo.dev', password: 'Operador@123456', role: 'operador', name: 'Operador Rádio Irmão Áureo' }
  ];

  for (const user of users) {
    try {
      await auth.getUser(user.uid);
    } catch {
      await auth.createUser({ uid: user.uid, email: user.email, password: user.password, displayName: user.name });
    }

    await db.collection('users').doc(user.uid).set({
      name: user.name,
      email: user.email,
      role: user.role,
      institution: 'Irmão Áureo',
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }

  return { ok: true };
});
