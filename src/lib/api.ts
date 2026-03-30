import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { parseYoutubeUrl } from '@/lib/youtube';

const REQUEST_TIMEOUT_MS = 10000;

let token: string | null = localStorage.getItem('radioosceia_access_token');

export type ApiErrorCode = 'NETWORK_ERROR' | 'HTTP_ERROR' | 'TIMEOUT' | 'INVALID_RESPONSE' | 'UNKNOWN_ERROR';

export class ApiError extends Error {
  code: ApiErrorCode;
  status?: number;
  isNetworkError: boolean;
  details?: unknown;

  constructor({ code, message, status, details }: { code: ApiErrorCode; message: string; status?: number; details?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.isNetworkError = code === 'NETWORK_ERROR' || code === 'TIMEOUT';
  }
}

interface RawScheduleBlock {
  id: string;
  title: string;
  weekday: unknown;
  startTime: string;
  endTime?: string | null;
  sequenceId: string;
  programId?: string | null;
  isActive: boolean;
}

interface RawSequenceItem {
  id: string;
  mediaId: string;
  orderIndex: number;
  startMode?: string;
  fixedStartTime?: string;
  relativeOffsetSeconds?: number;
  startAfterPrevious?: boolean;
}

interface RawMedia {
  id: string;
  title: string;
  mediaType: string;
  sourceType?: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  embedUrl?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
}

const WEEKDAY_INDEX: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6
};

function mapWeekday(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase();
    if (normalized in WEEKDAY_INDEX) {
      return WEEKDAY_INDEX[normalized];
    }

    const numeric = Number(normalized);
    if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 6) {
      return numeric;
    }
  }

  return null;
}

function timestampToMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && value !== null && 'toMillis' in value && typeof (value as Timestamp).toMillis === 'function') {
    return (value as Timestamp).toMillis();
  }

  return 0;
}

function hhmmToMinutes(value?: string | null) {
  if (!value) return null;
  const [hourRaw, minuteRaw] = value.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return hour * 60 + minute;
}

function minutesToHHMM(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function normalizeSourceType(raw?: string | null) {
  const value = String(raw ?? '').toLowerCase();
  if (value === 'youtube' || value === 'yt') return 'YOUTUBE';
  if (value === 'upload' || value === 'local') return 'LOCAL';
  if (value === 'existing_file' || value === 'external_placeholder') return 'EXTERNAL_PLACEHOLDER';
  return value ? value.toUpperCase() : 'YOUTUBE';
}

function normalizeMediaDoc(snapshot: { id: string; data: () => Record<string, unknown> }): RawMedia {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    title: String(data.title ?? 'Mídia sem título'),
    mediaType: String(data.mediaType ?? 'VIDEO'),
    sourceType: normalizeSourceType(String(data.sourceType ?? 'youtube')),
    youtubeUrl: typeof data.youtubeUrl === 'string' ? data.youtubeUrl : undefined,
    youtubeVideoId: typeof data.youtubeVideoId === 'string' ? data.youtubeVideoId : undefined,
    embedUrl: typeof data.embedUrl === 'string' ? data.embedUrl : undefined,
    thumbnailUrl: typeof data.thumbnailUrl === 'string' ? data.thumbnailUrl : undefined,
    durationSeconds: Number(data.durationSeconds ?? 0)
  };
}

export function setAccessToken(nextToken: string | null) {
  token = nextToken;
  if (nextToken) {
    localStorage.setItem('radioosceia_access_token', nextToken);
  } else {
    localStorage.removeItem('radioosceia_access_token');
  }
}

function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof Error) {
    return new ApiError({
      code: 'NETWORK_ERROR',
      message: error.message || 'Falha ao acessar recursos do Firebase.',
      details: error
    });
  }

  return new ApiError({
    code: 'UNKNOWN_ERROR',
    message: 'Erro inesperado ao consultar dados.',
    details: error
  });
}

export function getApiErrorMessage(error: unknown, fallback = 'Não foi possível carregar os dados.') {
  const apiError = error instanceof ApiError ? error : normalizeApiError(error);
  return apiError.message || fallback;
}

async function withTimeout<T>(promise: Promise<T>) {
  const timer = new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new ApiError({ code: 'TIMEOUT', message: 'A operação expirou no Firebase.' })), REQUEST_TIMEOUT_MS);
  });

  return Promise.race([promise, timer]);
}

async function getPublicPrograms() {
  const [programsSnapshot, presentersSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'programs'), where('isActive', '==', true), orderBy('title', 'asc'))),
    getDocs(query(collection(db, 'presenters'), where('isActive', '==', true), orderBy('name', 'asc')))
  ]);

  const presenters = new Map<string, Record<string, unknown>>(
    presentersSnapshot.docs.map((docItem: { id: string; data: () => Record<string, unknown> }) => [docItem.id, docItem.data()])
  );

  return programsSnapshot.docs.map((item: { id: string; data: () => Record<string, unknown> }) => {
    const data = item.data();
    const presenter = data.presenterId ? presenters.get(String(data.presenterId)) : null;

    return {
      id: item.id,
      title: String(data.title ?? 'Programa sem título'),
      shortDescription: String(data.description ?? data.shortDescription ?? ''),
      coverUrl: String(data.coverUrl ?? ''),
      category: null,
      presenter: presenter ? { name: String(presenter.name ?? 'Não definido') } : null
    };
  });
}

async function getPresenters() {
  const snapshot = await getDocs(query(collection(db, 'presenters'), where('isActive', '==', true), orderBy('name', 'asc')));
  return snapshot.docs.map((item: { id: string; data: () => Record<string, unknown> }) => {
    const data = item.data();
    return {
      id: item.id,
      name: String(data.name ?? 'Sem nome'),
      shortBio: String(data.shortBio ?? ''),
      photoUrl: String(data.photoUrl ?? '')
    };
  });
}

async function getAdminPrograms() {
  const snapshot = await getDocs(query(collection(db, 'programs'), orderBy('title', 'asc')));
  return snapshot.docs.map((item: { id: string; data: () => Record<string, unknown> }) => {
    const data = item.data();
    const presenterName = typeof data.presenterName === 'string'
      ? data.presenterName
      : typeof data.hostName === 'string'
        ? data.hostName
        : null;
    const categoryName = typeof data.categoryName === 'string'
      ? data.categoryName
      : typeof data.category === 'string'
        ? data.category
        : null;

    return {
      id: item.id,
      title: String(data.title ?? 'Programa sem título'),
      presenterName,
      categoryName,
      isActive: Boolean(data.isActive ?? true),
      status: typeof data.status === 'string' ? String(data.status).toUpperCase() : null
    };
  });
}

async function getAdminMedia() {
  const [mediaSnapshot, programsSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'media'), orderBy('createdAt', 'desc'))),
    getDocs(query(collection(db, 'programs'), orderBy('title', 'asc')))
  ]);

  const programById = new Map<string, string>(
    programsSnapshot.docs.map((program: { id: string; data: () => Record<string, unknown> }) => [program.id, String(program.data().title ?? 'Sem programa')])
  );

  return mediaSnapshot.docs.map((item: { id: string; data: () => Record<string, unknown> }) => {
    const data = item.data();
    const programId = typeof data.programId === 'string' ? data.programId : null;
    const sourceType = normalizeSourceType(String(data.sourceType ?? 'youtube'));

    return {
      id: item.id,
      title: String(data.title ?? 'Mídia sem título'),
      mediaType: String(data.mediaType ?? 'VIDEO'),
      sourceType,
      durationSeconds: Number(data.durationSeconds ?? 0),
      program: programId ? { title: programById.get(programId) ?? 'Sem programa' } : null,
      isActive: Boolean(data.isActive ?? true),
      notes: typeof data.notes === 'string' ? data.notes : null,
      youtubeUrl: typeof data.youtubeUrl === 'string' ? data.youtubeUrl : null,
      fileName: typeof data.fileName === 'string' ? data.fileName : null
    };
  });
}

async function loadTimelineBlocks(weekday: number) {
  const snapshot = await getDocs(query(collection(db, 'scheduleBlocks'), where('isActive', '==', true), orderBy('startTime', 'asc')));

  return snapshot.docs
    .map((item: { id: string; data: () => Record<string, unknown> }) => {
      const data = item.data();
      return {
        id: item.id,
        title: String(data.title ?? 'Bloco sem título'),
        weekday: data.weekday,
        startTime: String(data.startTime ?? '00:00'),
        endTime: typeof data.endTime === 'string' ? data.endTime : null,
        sequenceId: String(data.sequenceId ?? ''),
        programId: typeof data.programId === 'string' ? data.programId : null,
        isActive: Boolean(data.isActive ?? true)
      } as RawScheduleBlock;
    })
    .filter((block: RawScheduleBlock) => mapWeekday(block.weekday) === weekday && block.sequenceId);
}

async function loadSequenceItems(sequenceId: string): Promise<RawSequenceItem[]> {
  const sequenceRef = doc(db, 'playbackSequences', sequenceId);
  const sequenceSnapshot = await getDoc(sequenceRef);

  const fromArray = sequenceSnapshot.data()?.items;
  if (Array.isArray(fromArray) && fromArray.length > 0) {
    return fromArray
      .map((item: unknown, index: number) => ({
        id: String((item as { id?: string }).id ?? `${sequenceId}-${index + 1}`),
        mediaId: String((item as { mediaId?: string }).mediaId ?? ''),
        orderIndex: Number((item as { orderIndex?: number }).orderIndex ?? index + 1),
        startMode: String((item as { startMode?: string }).startMode ?? 'IMMEDIATE'),
        fixedStartTime: typeof (item as { fixedStartTime?: unknown }).fixedStartTime === 'string'
          ? String((item as { fixedStartTime?: string }).fixedStartTime)
          : undefined,
        relativeOffsetSeconds: Number((item as { relativeOffsetSeconds?: number }).relativeOffsetSeconds ?? 0),
        startAfterPrevious: Boolean((item as { startAfterPrevious?: boolean }).startAfterPrevious ?? true)
      }))
      .filter((item: RawSequenceItem) => item.mediaId);
  }

  const itemsSnapshot = await getDocs(query(collection(db, 'playbackSequences', sequenceId, 'items'), orderBy('orderIndex', 'asc')));

  return itemsSnapshot.docs.map((itemDoc: { id: string; data: () => Record<string, unknown> }, index: number) => {
    const data = itemDoc.data();

    return {
      id: itemDoc.id,
      mediaId: String(data.mediaId ?? ''),
      orderIndex: Number(data.orderIndex ?? index + 1),
      startMode: String(data.startMode ?? 'IMMEDIATE'),
      fixedStartTime: typeof data.fixedStartTime === 'string' ? data.fixedStartTime : undefined,
      relativeOffsetSeconds: Number(data.relativeOffsetSeconds ?? 0),
      startAfterPrevious: Boolean(data.startAfterPrevious ?? true)
    };
  }).filter((item: RawSequenceItem) => item.mediaId);
}

async function resolveTimeline(weekday: number) {
  const blocks = await loadTimelineBlocks(weekday);
  const mediaCache = new Map<string, RawMedia>();

  const hydratedBlocks = await Promise.all(blocks.map(async (block: RawScheduleBlock) => {
    const items = await loadSequenceItems(block.sequenceId);
    const sortedItems = [...items].sort((a, b) => a.orderIndex - b.orderIndex);
    const blockStartMinutes = hhmmToMinutes(block.startTime) ?? 0;
    let runningStart = blockStartMinutes;

    const timeline = [] as Array<{ itemId: string; mediaId: string; title: string; sourceType: string; startAt: string }>;

    for (const item of sortedItems) {
      if (!mediaCache.has(item.mediaId)) {
        const mediaSnapshot = await getDoc(doc(db, 'media', item.mediaId));
        if (mediaSnapshot.exists()) {
          mediaCache.set(item.mediaId, normalizeMediaDoc(mediaSnapshot as { id: string; data: () => Record<string, unknown> }));
        }
      }

      const media = mediaCache.get(item.mediaId);
      if (!media) {
        continue;
      }

      const fixedMinutes = hhmmToMinutes(item.fixedStartTime ?? null);
      if (fixedMinutes !== null) {
        runningStart = fixedMinutes;
      } else if (item.relativeOffsetSeconds && item.relativeOffsetSeconds > 0) {
        runningStart = blockStartMinutes + Math.floor(item.relativeOffsetSeconds / 60);
      }

      timeline.push({
        itemId: item.id,
        mediaId: item.mediaId,
        title: media.title,
        sourceType: media.sourceType ?? 'YOUTUBE',
        startAt: minutesToHHMM(runningStart)
      });

      const durationMinutes = Math.max(1, Math.ceil((media.durationSeconds ?? 0) / 60));
      runningStart += durationMinutes;
    }

    return {
      id: block.id,
      title: block.title,
      startTime: block.startTime,
      endTime: block.endTime ?? null,
      sequenceId: block.sequenceId,
      timeline
    };
  }));

  return hydratedBlocks;
}

async function buildNowPlayingPayload() {
  const now = new Date();
  const weekday = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const blocks = await resolveTimeline(weekday);
  const activeBlocks = blocks.filter((block: { startTime: string; endTime: string | null; timeline: Array<unknown> }) => {
    const start = hhmmToMinutes(block.startTime) ?? 0;
    const end = hhmmToMinutes(block.endTime) ?? start + (block.timeline.length * 30);
    return nowMinutes >= start && nowMinutes <= end;
  });

  const currentBlock = activeBlocks[0] ?? blocks[0] ?? null;

  if (!currentBlock || currentBlock.timeline.length === 0) {
    return {
      institution: { id: 'irmao-aureo', slug: 'irmao-aureo', name: 'Irmão Áureo' },
      nowPlaying: null,
      upNext: []
    };
  }

  const timelineWithMinutes = currentBlock.timeline
    .map((item: { itemId: string; mediaId: string; title: string; sourceType: string; startAt: string }) => ({ ...item, startMinutes: hhmmToMinutes(item.startAt) ?? 0 }))
    .sort((a: { startMinutes: number }, b: { startMinutes: number }) => a.startMinutes - b.startMinutes);

  let currentIndex = timelineWithMinutes.findIndex((item: { startMinutes: number }, index: number) => {
    const nextStart = timelineWithMinutes[index + 1]?.startMinutes ?? 24 * 60;
    return nowMinutes >= item.startMinutes && nowMinutes < nextStart;
  });

  if (currentIndex < 0) {
    currentIndex = 0;
  }

  const current = timelineWithMinutes[currentIndex];
  const mediaSnapshot = await getDoc(doc(db, 'media', current.mediaId));
  const mediaData = mediaSnapshot.exists() ? mediaSnapshot.data() : {};

  const upNext = timelineWithMinutes.slice(currentIndex + 1, currentIndex + 6).map((item: { itemId: string; title: string; startAt: string }) => ({
    id: item.itemId,
    title: item.title,
    startTime: item.startAt
  }));

  return {
    institution: { id: 'irmao-aureo', slug: 'irmao-aureo', name: 'Irmão Áureo' },
    nowPlaying: {
      source: currentBlock.title,
      title: current.title,
      media: {
        id: current.mediaId,
        title: current.title,
        sourceType: normalizeSourceType(String(mediaData.sourceType ?? current.sourceType)),
        mediaType: String(mediaData.mediaType ?? 'VIDEO'),
        youtubeVideoId: typeof mediaData.youtubeVideoId === 'string' ? mediaData.youtubeVideoId : null,
        publicUrl: typeof mediaData.youtubeUrl === 'string' ? mediaData.youtubeUrl : null
      }
    },
    upNext
  };
}

async function getDashboardSummary() {
  const today = new Date().getDay();
  const [programs, media, blocks, playback] = await Promise.all([
    getCountFromServer(collection(db, 'programs')),
    getCountFromServer(collection(db, 'media')),
    loadTimelineBlocks(today),
    buildNowPlayingPayload()
  ]);

  return {
    programs: programs.data().count,
    media: media.data().count,
    scheduledToday: blocks.length,
    nowPlaying: playback.nowPlaying,
    upNext: playback.upNext
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const method = (init?.method ?? 'GET').toUpperCase();

    if (method === 'GET' && path === '/public/institutions/irmao-aureo/programs') {
      return await withTimeout(getPublicPrograms()) as T;
    }

    if (method === 'GET' && path === '/public/institutions/irmao-aureo/presenters') {
      return await withTimeout(getPresenters()) as T;
    }

    if (method === 'GET' && path.startsWith('/public/institutions/irmao-aureo/timeline')) {
      const weekdayValue = new URLSearchParams(path.split('?')[1]).get('weekday') ?? String(new Date().getDay());
      const weekday = mapWeekday(weekdayValue) ?? new Date().getDay();
      const blocks = await withTimeout(resolveTimeline(weekday));
      return ({ blocks } as T);
    }

    if (method === 'GET' && path === '/public/institutions/irmao-aureo/now-playing') {
      return await withTimeout(buildNowPlayingPayload()) as T;
    }

    if (method === 'GET' && path === '/public/institutions/irmao-aureo/up-next') {
      const playback = await withTimeout(buildNowPlayingPayload());
      return (playback.upNext as T);
    }

    if (method === 'GET' && path === '/dashboard/summary') {
      return await withTimeout(getDashboardSummary()) as T;
    }

    if (method === 'GET' && path === '/programs') {
      return await withTimeout(getAdminPrograms()) as T;
    }

    if (method === 'GET' && path === '/media') {
      return await withTimeout(getAdminMedia()) as T;
    }

    if (method === 'POST' && path === '/media/youtube') {
      const payload = init?.body ? JSON.parse(init.body as string) as Record<string, unknown> : {};
      const parsed = parseYoutubeUrl(String(payload.youtubeUrl ?? ''));
      const mediaRef = await addDoc(collection(db, 'media'), {
        title: String(payload.title ?? '').trim(),
        mediaType: String(payload.mediaType ?? 'VIDEO'),
        sourceType: 'youtube',
        ...parsed,
        durationSeconds: Number(payload.durationSeconds ?? 0),
        programId: payload.programId ? String(payload.programId) : null,
        notes: payload.notes ? String(payload.notes) : null,
        isActive: String(payload.status ?? 'ACTIVE') !== 'INACTIVE',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return ({ id: mediaRef.id } as T);
    }

    if (method === 'POST' && path === '/playback-sequences') {
      const payload = init?.body ? JSON.parse(init.body as string) as Record<string, unknown> : {};
      const sequenceRef = await addDoc(collection(db, 'playbackSequences'), {
        title: String(payload.title ?? '').trim(),
        description: payload.description ? String(payload.description) : null,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      if (Array.isArray(payload.items)) {
        for (const item of payload.items as Array<Record<string, unknown>>) {
          await addDoc(collection(db, 'playbackSequences', sequenceRef.id, 'items'), {
            mediaId: String(item.mediaId ?? ''),
            orderIndex: Number(item.orderIndex ?? 0),
            startMode: String(item.startMode ?? 'IMMEDIATE'),
            fixedStartTime: item.fixedStartTime ? String(item.fixedStartTime) : null,
            relativeOffsetSeconds: Number(item.relativeOffsetSeconds ?? 0),
            startAfterPrevious: Boolean(item.startAfterPrevious ?? true),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      }

      return ({ id: sequenceRef.id } as T);
    }

    if (method === 'POST' && path === '/schedule-blocks') {
      const payload = init?.body ? JSON.parse(init.body as string) as Record<string, unknown> : {};
      const blockId = payload.id ? String(payload.id) : doc(collection(db, 'scheduleBlocks')).id;

      await setDoc(doc(db, 'scheduleBlocks', blockId), {
        title: String(payload.title ?? 'Bloco sem título'),
        weekday: mapWeekday(payload.weekday) ?? 0,
        startTime: String(payload.startTime ?? '00:00'),
        endTime: payload.endTime ? String(payload.endTime) : null,
        sequenceId: String(payload.sequenceId ?? ''),
        programId: payload.programId ? String(payload.programId) : null,
        isActive: payload.isActive !== false,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      }, { merge: true });

      return ({ id: blockId } as T);
    }

    if (method === 'POST' && path === '/bootstrap/seed') {
      const [presenterRef, programRef] = [
        doc(db, 'presenters', 'apresentador-joao'),
        doc(db, 'programs', 'programa-manha')
      ];

      await setDoc(doc(db, 'settings', 'app'), {
        institutionName: 'Irmão Áureo',
        institutionSlug: 'irmao-aureo',
        playerPosition: 'bottom',
        showQueue: true,
        showCover: true,
        mediaProvider: 'youtube',
        updatedAt: serverTimestamp()
      }, { merge: true });

      await setDoc(presenterRef, {
        name: 'João Áureo',
        slug: 'joao-aureo',
        shortBio: 'Comunicador institucional.',
        fullBio: 'Apresentador oficial da Rádio Irmão Áureo.',
        photoUrl: 'https://i.pravatar.cc/300?img=12',
        roleTitle: 'Apresentador',
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      await setDoc(programRef, {
        title: 'Manhã com Esperança',
        slug: 'manha-com-esperanca',
        description: 'Programa matinal da Rádio Irmão Áureo.',
        coverUrl: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?q=80&w=900',
        presenterId: presenterRef.id,
        tags: ['manhã', 'institucional'],
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      const parsedYoutube = parseYoutubeUrl('https://www.youtube.com/watch?v=jfKfPfyJRdk');
      await setDoc(doc(db, 'media', 'media-abertura'), {
        title: 'Abertura Institucional',
        mediaType: 'VINHETA',
        sourceType: 'youtube',
        ...parsedYoutube,
        durationSeconds: 180,
        programId: programRef.id,
        notes: 'Seed inicial Firebase-only',
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      await setDoc(doc(db, 'playbackSequences', 'sequencia-manha'), {
        title: 'Sequência da manhã',
        description: 'Sequência principal matinal',
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      await setDoc(doc(db, 'playbackSequences', 'sequencia-manha', 'items', 'item-1'), {
        mediaId: 'media-abertura',
        orderIndex: 1,
        startMode: 'IMMEDIATE',
        startAfterPrevious: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      await setDoc(doc(db, 'scheduleBlocks', 'bloco-domingo-08h'), {
        title: 'Bloco Matinal',
        weekday: 0,
        startTime: '08:00',
        endTime: '10:00',
        sequenceId: 'sequencia-manha',
        programId: programRef.id,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      return ({ ok: true } as T);
    }

    if (method === 'POST' && path === '/media/local-register') {
      const payload = init?.body ? JSON.parse(init.body as string) as Record<string, unknown> : {};
      const parsed = parseYoutubeUrl(String(payload.publicUrl || payload.filePath || ''));
      const ref = doc(collection(db, 'media'));
      await setDoc(ref, {
        title: payload.title,
        mediaType: payload.mediaType,
        sourceType: 'external_placeholder',
        youtubeUrl: parsed.youtubeUrl,
        youtubeVideoId: parsed.youtubeVideoId,
        embedUrl: parsed.embedUrl,
        thumbnailUrl: parsed.thumbnailUrl,
        durationSeconds: Number(payload.durationSeconds ?? 0),
        programId: payload.programId ?? null,
        notes: payload.notes ?? null,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return ({ id: ref.id } as T);
    }

    throw new ApiError({ code: 'HTTP_ERROR', status: 404, message: `Rota Firebase não mapeada: ${method} ${path}` });
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export const api = {
  request,
  get: <T>(path: string, init?: RequestInit) => request<T>(path, { ...init, method: 'GET' }),
  post: <T>(path: string, body?: unknown, init?: RequestInit) => request<T>(path, { ...init, method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown, init?: RequestInit) => request<T>(path, { ...init, method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string, init?: RequestInit) => request<T>(path, { ...init, method: 'DELETE' })
};

export { REQUEST_TIMEOUT_MS, token };
