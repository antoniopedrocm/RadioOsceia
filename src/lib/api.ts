import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
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
  const snapshot = await getDocs(query(collection(db, 'programs'), where('isActive', '==', true), orderBy('title', 'asc')));
  return snapshot.docs.map((item: { id: string; data: () => Record<string, unknown> }) => ({ id: item.id, ...item.data() }));
}

async function getPresenters() {
  const snapshot = await getDocs(query(collection(db, 'presenters'), where('isActive', '==', true), orderBy('name', 'asc')));
  return snapshot.docs.map((item: { id: string; data: () => Record<string, unknown> }) => ({ id: item.id, ...item.data() }));
}

async function getAdminPrograms() {
  const snapshot = await getDocs(query(collection(db, 'programs'), orderBy('title', 'asc')));
  return snapshot.docs.map((item: { id: string; data: () => Record<string, unknown> }) => ({ id: item.id, ...item.data() }));
}

async function getAdminMedia() {
  const snapshot = await getDocs(query(collection(db, 'media'), orderBy('createdAt', 'desc')));
  return snapshot.docs.map((item: { id: string; data: () => Record<string, unknown> }) => ({ id: item.id, ...item.data() }));
}

async function getDashboardSummary() {
  const [programs, media, blocks] = await Promise.all([
    getCountFromServer(collection(db, 'programs')),
    getCountFromServer(collection(db, 'media')),
    getCountFromServer(query(collection(db, 'scheduleBlocks'), where('weekday', '==', new Date().getDay()), where('isActive', '==', true)))
  ]);

  const nowPlayingFn = httpsCallable(functions, 'getNowPlaying');
  const upNextFn = httpsCallable(functions, 'getUpNext');

  const [nowPlayingResponse, upNextResponse] = await Promise.all([
    nowPlayingFn({ institutionSlug: 'irmao-aureo' }),
    upNextFn({ institutionSlug: 'irmao-aureo', limit: 5 })
  ]);

  const nowPlayingData = nowPlayingResponse.data as { nowPlaying: { title: string } | null };
  const upNextData = upNextResponse.data as { upNext: Array<{ id: string; title: string; startTime: string }> };

  return {
    programs: programs.data().count,
    media: media.data().count,
    scheduledToday: blocks.data().count,
    nowPlaying: nowPlayingData.nowPlaying,
    upNext: upNextData.upNext
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
      const weekday = Number(new URLSearchParams(path.split('?')[1]).get('weekday') ?? new Date().getDay());
      const fn = httpsCallable(functions, 'getTimeline');
      const result = await withTimeout(fn({ institutionSlug: 'irmao-aureo', weekday }));
      return ((result as { data: T }).data);
    }

    if (method === 'GET' && path === '/public/institutions/irmao-aureo/now-playing') {
      const fn = httpsCallable(functions, 'getNowPlaying');
      const result = await withTimeout(fn({ institutionSlug: 'irmao-aureo' }));
      return ((result as { data: T }).data);
    }

    if (method === 'GET' && path === '/public/institutions/irmao-aureo/up-next') {
      const fn = httpsCallable(functions, 'getUpNext');
      const result = await withTimeout(fn({ institutionSlug: 'irmao-aureo' }));
      return (((result as { data: { upNext: unknown } }).data).upNext as T);
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
      const fn = httpsCallable(functions, 'createYoutubeMedia');
      const result = await withTimeout(fn(payload));
      return ((result as { data: T }).data);
    }

    if (method === 'POST' && path === '/playback-sequences') {
      const payload = init?.body ? JSON.parse(init.body as string) as Record<string, unknown> : {};
      const fn = httpsCallable(functions, 'createPlaybackSequence');
      const result = await withTimeout(fn(payload));
      return ((result as { data: T }).data);
    }

    if (method === 'POST' && path === '/schedule-blocks') {
      const payload = init?.body ? JSON.parse(init.body as string) as Record<string, unknown> : {};
      const fn = httpsCallable(functions, 'saveScheduleBlock');
      const result = await withTimeout(fn(payload));
      return ((result as { data: T }).data);
    }

    if (method === 'POST' && path === '/bootstrap/seed') {
      const fn = httpsCallable(functions, 'bootstrapSeedData');
      const result = await withTimeout(fn({}));
      return ((result as { data: T }).data);
    }

    if (method === 'POST' && path === '/media/local-register') {
      const payload = init?.body ? JSON.parse(init.body as string) as Record<string, unknown> : {};
      const parsed = parseYoutubeUrl(String(payload.publicUrl || payload.filePath || ''));
      const ref = doc(collection(db, 'media'));
      await setDoc(ref, {
        title: payload.title,
        mediaType: payload.mediaType,
        sourceType: 'EXTERNAL_PLACEHOLDER',
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
