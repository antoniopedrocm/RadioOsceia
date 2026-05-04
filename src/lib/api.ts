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
  updateDoc,
  where,
  type Timestamp
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db } from '@/lib/firebase';
import { functions } from '@/lib/firebase';
import type { ProgramStatus } from '@/types/program';
import type { AdminMediaRecord, MediaStatus } from '@/types/media';
import type { AdminPresenterRecord, PresenterStatus } from '@/types/presenter';
import type { NowPlayingResponse } from '@/types/api';
import type {
  CreateScheduleBlockPayload,
  PlaybackTimelineResponse,
  ScheduleDayViewResponse,
  ScheduleWeekViewResponse,
  UpdateScheduleBlockPayload
} from '@/types/schedule';
import { parseYoutubeUrl } from '@/lib/youtube';
import { getLocalRootSession } from '@/lib/localRootSession';
import type { CanonicalUser } from '@/types/canonical-user';
import {
  buildNowPlayingPayload as buildSharedNowPlayingPayload,
  getDashboardSummary as getSharedDashboardSummary,
  normalizeSourceType,
  resolveTimeline as resolveSharedTimeline,
  type DashboardDataAdapter,
  type TimelineMedia,
  type TimelineScheduleBlock,
  type TimelineSequenceItem
} from '@/lib/timeline';

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

const WEEKDAY_INDEX: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6
};

const STATUS_NOTE_REGEX = /^\[status:(ACTIVE|DRAFT|INACTIVE)\]\s*/i;

function normalizeMediaStatus(value: unknown, notes?: unknown): MediaStatus {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'ACTIVE' || normalized === 'INACTIVE' || normalized === 'DRAFT') {
    return normalized as MediaStatus;
  }

  if (typeof notes === 'string') {
    const matched = notes.match(/^\[status:(ACTIVE|DRAFT|INACTIVE)\]/i);
    if (matched) {
      return matched[1].toUpperCase() as MediaStatus;
    }
  }

  return 'ACTIVE';
}

function mapMediaActivity(status: MediaStatus) {
  return status === 'ACTIVE';
}

function sanitizeMediaNotes(notes: unknown): string | null {
  if (typeof notes !== 'string') {
    return null;
  }

  const sanitized = notes.replace(STATUS_NOTE_REGEX, '').trim();
  return sanitized || null;
}

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

function normalizeMediaDoc(snapshot: { id: string; data: () => Record<string, unknown> }): TimelineMedia {
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

function withLocalRootAuth<T extends object>(payload?: T): Record<string, unknown> {
  const session = getLocalRootSession();
  return {
    ...((payload ?? {}) as Record<string, unknown>),
    localRootToken: session?.token ?? null
  };
}

export interface LocalUserSession {
  token: string;
  expiresAt: string;
  user: CanonicalUser;
}

export interface LoginLocalUserPayload {
  emailOrUsername: string;
  password: string;
}

export interface VerifyLocalSessionPayload {
  token: string;
}

export interface VerifyLocalSessionResponse {
  valid: boolean;
  expiresAt?: string;
  user?: CanonicalUser;
}

export interface BootstrapRootAdminResponse {
  ok: true;
  created: boolean;
  user: CanonicalUser;
}

interface GetNowPlayingCallablePayload {
  now?: string | null;
}

export interface ListAppUsersResponse {
  users: CanonicalUser[];
}

export interface CreateAppUserPayload {
  name: string;
  email: string;
  role: CanonicalUser['role'];
  status?: CanonicalUser['status'];
  authSource?: CanonicalUser['authSource'];
  institution?: string;
  password?: string;
}

export interface UpdateAppUserPayload {
  uid: string;
  name?: string;
  role?: CanonicalUser['role'];
  status?: CanonicalUser['status'];
  institution?: string;
}

export interface SetAppUserPasswordPayload {
  uid: string;
  password: string;
}

export interface DeleteAppUserPayload {
  uid: string;
}

export interface LinkGoogleUserOnFirstLoginPayload {
  firebaseUid: string;
  email: string;
  name: string;
  provider: 'google';
}

export interface LinkGoogleUserOnFirstLoginResponse {
  ok: true;
  linked: boolean;
  created: boolean;
  strategy: string;
  user: CanonicalUser;
}

async function withTimeout<T>(promise: Promise<T>) {
  const timer = new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new ApiError({ code: 'TIMEOUT', message: 'A operação expirou no Firebase.' })), REQUEST_TIMEOUT_MS);
  });

  return Promise.race([promise, timer]);
}

async function getPublicPrograms() {
  const [programsSnapshot, presentersSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'programs'), where('isActive', '==', true))),
    getDocs(query(collection(db, 'presenters'), where('isActive', '==', true)))
  ]);

  const presenters = new Map<string, Record<string, unknown>>(
    presentersSnapshot.docs.map((docItem: { id: string; data: () => Record<string, unknown> }) => [docItem.id, docItem.data()])
  );

  const sortedProgramDocs = programsSnapshot.docs.sort((a, b) =>
    String(a.data().title ?? '').localeCompare(String(b.data().title ?? ''))
  );

  return sortedProgramDocs.map((item: { id: string; data: () => Record<string, unknown> }) => {
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
  const snapshot = await getDocs(query(collection(db, 'presenters'), where('isActive', '==', true)));
  const sortedDocs = snapshot.docs.sort((a, b) =>
    String(a.data().name ?? '').localeCompare(String(b.data().name ?? ''))
  );

  return sortedDocs.map((item: { id: string; data: () => Record<string, unknown> }) => {
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

    const status = normalizeProgramStatus(data.status ?? (data.isActive === false ? 'INACTIVE' : 'ACTIVE'));

    return {
      id: item.id,
      title: String(data.title ?? 'Programa sem título'),
      slug: String(data.slug ?? ''),
      description: String(data.description ?? ''),
      shortDescription: String(data.shortDescription ?? ''),
      coverUrl: String(data.coverUrl ?? ''),
      presenterId: typeof data.presenterId === 'string' ? data.presenterId : null,
      presenterName,
      categoryName,
      tags: Array.isArray(data.tags) ? data.tags.map((tag: unknown) => String(tag)) : [],
      isActive: status === 'ACTIVE',
      status
    };
  });
}


async function getAdminPresenters() {
  const snapshot = await getDocs(query(collection(db, 'presenters'), where('isActive', '==', true)));
  const sortedDocs = snapshot.docs.sort((a, b) =>
    String(a.data().name ?? '').localeCompare(String(b.data().name ?? ''))
  );

  return sortedDocs.map((item: { id: string; data: () => Record<string, unknown> }) => {
    const data = item.data();
    return {
      id: item.id,
      name: String(data.name ?? 'Sem nome')
    };
  });
}

async function getAdminPresenterRecords(): Promise<AdminPresenterRecord[]> {
  const [presentersSnapshot, programsSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'presenters'), orderBy('name', 'asc'))),
    getDocs(query(collection(db, 'programs'), orderBy('title', 'asc')))
  ]);

  const programsByPresenterId = new Map<string, string[]>();
  programsSnapshot.docs.forEach((programDoc: { data: () => Record<string, unknown> }) => {
    const data = programDoc.data();
    const presenterId = typeof data.presenterId === 'string' ? data.presenterId : null;
    const title = String(data.title ?? '').trim();
    if (!presenterId || !title) {
      return;
    }

    const current = programsByPresenterId.get(presenterId) ?? [];
    current.push(title);
    programsByPresenterId.set(presenterId, current);
  });

  return presentersSnapshot.docs.map((item: { id: string; data: () => Record<string, unknown> }) => {
    const data = item.data();
    const status = normalizePresenterStatus(data.status, data.isActive);

    return {
      id: item.id,
      name: String(data.name ?? 'Sem nome'),
      shortBio: String(data.shortBio ?? data.bio ?? ''),
      photoUrl: String(data.photoUrl ?? data.image ?? ''),
      status,
      isActive: mapPresenterActivity(status),
      programTitles: programsByPresenterId.get(item.id) ?? []
    };
  });
}

function slugifyProgramTitle(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function normalizeProgramStatus(value: unknown): ProgramStatus {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'ACTIVE' || normalized === 'ATIVO') return 'ACTIVE';
  if (normalized === 'INACTIVE' || normalized === 'INATIVO') return 'INACTIVE';
  return 'DRAFT';
}

function normalizePresenterStatus(value: unknown, isActive?: unknown): PresenterStatus {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'INACTIVE' || normalized === 'INATIVO') return 'INACTIVE';
  if (normalized === 'ACTIVE' || normalized === 'ATIVO') return 'ACTIVE';
  return isActive === false ? 'INACTIVE' : 'ACTIVE';
}

function mapPresenterActivity(status: PresenterStatus) {
  return status === 'ACTIVE';
}

function parseProgramTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value !== 'string') {
    return [];
  }

  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function mapProgramActivity(status: ProgramStatus) {
  if (status === 'ACTIVE') {
    return true;
  }

  return false;
}

async function assertProgramSlugAvailable(slug: string, currentProgramId?: string) {
  const trimmedSlug = slug.trim();
  if (!trimmedSlug) {
    throw new ApiError({ code: 'INVALID_RESPONSE', message: 'Slug inválido para programa.' });
  }

  const duplicates = await getDocs(query(collection(db, 'programs'), where('slug', '==', trimmedSlug)));
  const hasDuplicate = duplicates.docs.some((item: { id: string }) => item.id !== currentProgramId);

  if (hasDuplicate) {
    throw new ApiError({ code: 'HTTP_ERROR', status: 409, message: 'Já existe um programa com este slug.' });
  }
}


async function getAdminMedia() {
  const [mediaSnapshot, programsSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'media'), orderBy('createdAt', 'desc'))),
    getDocs(query(collection(db, 'programs'), orderBy('title', 'asc')))
  ]);

  const programById = new Map<string, string>(
    programsSnapshot.docs.map((program: { id: string; data: () => Record<string, unknown> }) => [program.id, String(program.data().title ?? 'Sem programa')])
  );

  return mediaSnapshot.docs.map((item: { id: string; data: () => Record<string, unknown> }): AdminMediaRecord => {
    const data = item.data();
    const programId = typeof data.programId === 'string' ? data.programId : null;
    const sourceType = normalizeSourceType(String(data.sourceType ?? 'youtube')) as AdminMediaRecord['sourceType'];
    const status = normalizeMediaStatus(data.status, data.notes);

    return {
      id: item.id,
      title: String(data.title ?? 'Mídia sem título'),
      mediaType: String(data.mediaType ?? 'VIDEO'),
      sourceType,
      durationSeconds: Number(data.durationSeconds ?? 0),
      programId,
      program: programId ? { title: programById.get(programId) ?? 'Sem programa' } : null,
      isActive: mapMediaActivity(status),
      status,
      notes: sanitizeMediaNotes(data.notes),
      youtubeUrl: typeof data.youtubeUrl === 'string' ? data.youtubeUrl : null,
      youtubeVideoId: typeof data.youtubeVideoId === 'string' ? data.youtubeVideoId : null,
      embedUrl: typeof data.embedUrl === 'string' ? data.embedUrl : null,
      thumbnailUrl: typeof data.thumbnailUrl === 'string' ? data.thumbnailUrl : null,
      filePath: typeof data.filePath === 'string' ? data.filePath : null,
      publicUrl: typeof data.publicUrl === 'string' ? data.publicUrl : null,
      fileName: typeof data.fileName === 'string' ? data.fileName : null
    };
  });
}

async function getAdminMediaById(mediaId: string): Promise<AdminMediaRecord> {
  const mediaSnapshot = await getDoc(doc(db, 'media', mediaId));
  if (!mediaSnapshot.exists()) {
    throw new ApiError({ code: 'HTTP_ERROR', status: 404, message: 'Mídia não encontrada.' });
  }

  const data = mediaSnapshot.data();
  const programId = typeof data.programId === 'string' ? data.programId : null;
  let programTitle: string | null = null;
  if (programId) {
    const programSnapshot = await getDoc(doc(db, 'programs', programId));
    if (programSnapshot.exists()) {
      programTitle = String(programSnapshot.data().title ?? 'Sem programa');
    }
  }

  const sourceType = normalizeSourceType(String(data.sourceType ?? 'youtube')) as AdminMediaRecord['sourceType'];
  const status = normalizeMediaStatus(data.status, data.notes);

  return {
    id: mediaSnapshot.id,
    title: String(data.title ?? 'Mídia sem título'),
    mediaType: String(data.mediaType ?? 'VIDEO'),
    sourceType,
    durationSeconds: Number(data.durationSeconds ?? 0),
    programId,
    program: programTitle ? { title: programTitle } : null,
    isActive: mapMediaActivity(status),
    status,
    notes: sanitizeMediaNotes(data.notes),
    youtubeUrl: typeof data.youtubeUrl === 'string' ? data.youtubeUrl : null,
    youtubeVideoId: typeof data.youtubeVideoId === 'string' ? data.youtubeVideoId : null,
    embedUrl: typeof data.embedUrl === 'string' ? data.embedUrl : null,
    thumbnailUrl: typeof data.thumbnailUrl === 'string' ? data.thumbnailUrl : null,
    filePath: typeof data.filePath === 'string' ? data.filePath : null,
    publicUrl: typeof data.publicUrl === 'string' ? data.publicUrl : null,
    fileName: typeof data.fileName === 'string' ? data.fileName : null
  };
}

async function loadTimelineBlocks(weekday: number): Promise<TimelineScheduleBlock[]> {
  const snapshot = await getDocs(query(collection(db, 'scheduleBlocks'), where('isActive', '==', true)));
  const sortedDocs = snapshot.docs.sort((a, b) =>
    String(a.data().startTime ?? '').localeCompare(String(b.data().startTime ?? ''))
  );

  return sortedDocs
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
      } as TimelineScheduleBlock;
    })
    .filter((block: TimelineScheduleBlock) => mapWeekday(block.weekday) === weekday && block.sequenceId);
}

async function loadSequenceItems(sequenceId: string): Promise<TimelineSequenceItem[]> {
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
      .filter((item: TimelineSequenceItem) => item.mediaId);
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
  }).filter((item: TimelineSequenceItem) => item.mediaId);
}

const timelineAdapter: DashboardDataAdapter = {
  loadTimelineBlocks,
  loadSequenceItems,
  async loadMedia(mediaId: string) {
    const mediaSnapshot = await getDoc(doc(db, 'media', mediaId));
    return mediaSnapshot.exists() ? normalizeMediaDoc(mediaSnapshot as { id: string; data: () => Record<string, unknown> }) : null;
  },
  async countPrograms() {
    const count = await getCountFromServer(collection(db, 'programs'));
    return count.data().count;
  },
  async countMedia() {
    const count = await getCountFromServer(collection(db, 'media'));
    return count.data().count;
  }
};

async function resolveTimeline(weekday: number) {
  return resolveSharedTimeline(weekday, timelineAdapter);
}

async function buildNowPlayingPayload() {
  return buildSharedNowPlayingPayload(timelineAdapter);
}

async function getDashboardSummary() {
  return getSharedDashboardSummary(timelineAdapter);
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

    if (method === 'GET' && path === '/presenters') {
      return await withTimeout(getAdminPresenters()) as T;
    }

    if (method === 'GET' && path === '/admin/presenters') {
      return await withTimeout(getAdminPresenterRecords()) as T;
    }

    if (method === 'POST' && path === '/presenters') {
      const payload = init?.body ? JSON.parse(init.body as string) as Record<string, unknown> : {};
      const name = String(payload.name ?? '').trim();
      if (!name) {
        throw new ApiError({ code: 'INVALID_RESPONSE', message: 'Nome é obrigatório para salvar apresentador.' });
      }

      const status = normalizePresenterStatus(payload.status);
      const presenterRef = await addDoc(collection(db, 'presenters'), {
        name,
        shortBio: String(payload.shortBio ?? '').trim(),
        photoUrl: String(payload.photoUrl ?? '').trim(),
        status,
        isActive: mapPresenterActivity(status),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return ({ id: presenterRef.id } as T);
    }

    if (method === 'PUT' && path.startsWith('/presenters/')) {
      const presenterId = path.replace('/presenters/', '').trim();
      if (!presenterId || presenterId.includes('/')) {
        throw new ApiError({ code: 'HTTP_ERROR', status: 400, message: 'Apresentador inválido para atualização.' });
      }

      const payload = init?.body ? JSON.parse(init.body as string) as Record<string, unknown> : {};
      const name = String(payload.name ?? '').trim();
      if (!name) {
        throw new ApiError({ code: 'INVALID_RESPONSE', message: 'Nome é obrigatório para salvar apresentador.' });
      }

      const status = normalizePresenterStatus(payload.status);
      await updateDoc(doc(db, 'presenters', presenterId), {
        name,
        shortBio: String(payload.shortBio ?? '').trim(),
        photoUrl: String(payload.photoUrl ?? '').trim(),
        status,
        isActive: mapPresenterActivity(status),
        updatedAt: serverTimestamp()
      });

      return ({ id: presenterId } as T);
    }

    if (method === 'POST' && path.endsWith('/status') && path.startsWith('/presenters/')) {
      const presenterId = path.replace('/presenters/', '').replace('/status', '').trim();
      if (!presenterId) {
        throw new ApiError({ code: 'HTTP_ERROR', status: 400, message: 'Apresentador inválido para alteração de status.' });
      }

      const payload = init?.body ? JSON.parse(init.body as string) as Record<string, unknown> : {};
      const status = normalizePresenterStatus(payload.status);
      await updateDoc(doc(db, 'presenters', presenterId), {
        status,
        isActive: mapPresenterActivity(status),
        updatedAt: serverTimestamp()
      });

      return ({ id: presenterId, status } as T);
    }

    if (method === 'POST' && path === '/programs') {
      const payload = init?.body ? JSON.parse(init.body as string) as Record<string, unknown> : {};
      const title = String(payload.title ?? '').trim();
      if (!title) {
        throw new ApiError({ code: 'INVALID_RESPONSE', message: 'Título é obrigatório para salvar programa.' });
      }

      const slugBase = String(payload.slug ?? '').trim() || slugifyProgramTitle(title);
      if (!slugBase) {
        throw new ApiError({ code: 'INVALID_RESPONSE', message: 'Não foi possível gerar um slug válido para o programa.' });
      }

      const status = normalizeProgramStatus(payload.status);
      await assertProgramSlugAvailable(slugBase);

      const presenterId = payload.presenterId ? String(payload.presenterId) : null;
      let presenterName: string | null = null;
      if (presenterId) {
        const presenterSnapshot = await getDoc(doc(db, 'presenters', presenterId));
        if (presenterSnapshot.exists()) {
          presenterName = String(presenterSnapshot.data().name ?? '').trim() || null;
        }
      }

      const programRef = await addDoc(collection(db, 'programs'), {
        title,
        slug: slugBase,
        description: String(payload.description ?? '').trim(),
        shortDescription: String(payload.shortDescription ?? '').trim(),
        coverUrl: String(payload.coverUrl ?? '').trim(),
        presenterId,
        presenterName,
        categoryName: String(payload.categoryName ?? '').trim() || null,
        tags: parseProgramTags(payload.tags),
        status,
        isActive: mapProgramActivity(status),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return ({ id: programRef.id } as T);
    }

    if (method === 'PUT' && path.startsWith('/programs/')) {
      const programId = path.replace('/programs/', '').trim();
      if (!programId) {
        throw new ApiError({ code: 'HTTP_ERROR', status: 400, message: 'Programa inválido para atualização.' });
      }

      const payload = init?.body ? JSON.parse(init.body as string) as Record<string, unknown> : {};
      const title = String(payload.title ?? '').trim();
      if (!title) {
        throw new ApiError({ code: 'INVALID_RESPONSE', message: 'Título é obrigatório para salvar programa.' });
      }

      const slugBase = String(payload.slug ?? '').trim() || slugifyProgramTitle(title);
      if (!slugBase) {
        throw new ApiError({ code: 'INVALID_RESPONSE', message: 'Não foi possível gerar um slug válido para o programa.' });
      }

      const status = normalizeProgramStatus(payload.status);
      await assertProgramSlugAvailable(slugBase, programId);

      const presenterId = payload.presenterId ? String(payload.presenterId) : null;
      let presenterName: string | null = null;
      if (presenterId) {
        const presenterSnapshot = await getDoc(doc(db, 'presenters', presenterId));
        if (presenterSnapshot.exists()) {
          presenterName = String(presenterSnapshot.data().name ?? '').trim() || null;
        }
      }

      await updateDoc(doc(db, 'programs', programId), {
        title,
        slug: slugBase,
        description: String(payload.description ?? '').trim(),
        shortDescription: String(payload.shortDescription ?? '').trim(),
        coverUrl: String(payload.coverUrl ?? '').trim(),
        presenterId,
        presenterName,
        categoryName: String(payload.categoryName ?? '').trim() || null,
        tags: parseProgramTags(payload.tags),
        status,
        isActive: mapProgramActivity(status),
        updatedAt: serverTimestamp()
      });

      return ({ id: programId } as T);
    }

    if (method === 'POST' && path.endsWith('/archive') && path.startsWith('/programs/')) {
      const programId = path.replace('/programs/', '').replace('/archive', '').trim();
      await updateDoc(doc(db, 'programs', programId), {
        status: 'INACTIVE',
        isActive: false,
        updatedAt: serverTimestamp()
      });

      return ({ id: programId } as T);
    }

    if (method === 'POST' && path.endsWith('/activate') && path.startsWith('/programs/')) {
      const programId = path.replace('/programs/', '').replace('/activate', '').trim();
      await updateDoc(doc(db, 'programs', programId), {
        status: 'ACTIVE',
        isActive: true,
        updatedAt: serverTimestamp()
      });

      return ({ id: programId } as T);
    }

    if (method === 'GET' && path === '/media') {
      return await withTimeout(getAdminMedia()) as T;
    }

    if (method === 'GET' && path.startsWith('/media/')) {
      const mediaId = path.replace('/media/', '').trim();
      if (!mediaId) {
        throw new ApiError({ code: 'HTTP_ERROR', status: 400, message: 'ID de mídia inválido.' });
      }
      return await withTimeout(getAdminMediaById(mediaId)) as T;
    }

    if (method === 'POST' && path === '/media/youtube') {
      const payload = init?.body ? JSON.parse(init.body as string) as Record<string, unknown> : {};
      const parsed = parseYoutubeUrl(String(payload.youtubeUrl ?? ''));
      const status = normalizeMediaStatus(payload.status, payload.notes);
      const mediaRef = await addDoc(collection(db, 'media'), {
        title: String(payload.title ?? '').trim(),
        mediaType: String(payload.mediaType ?? 'VIDEO'),
        sourceType: 'YOUTUBE',
        ...parsed,
        durationSeconds: Number(payload.durationSeconds ?? 0),
        programId: payload.programId ? String(payload.programId) : null,
        notes: sanitizeMediaNotes(payload.notes),
        status,
        isActive: mapMediaActivity(status),
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

    if (method === 'POST' && path === '/media/local-register') {
      const payload = init?.body ? JSON.parse(init.body as string) as Record<string, unknown> : {};
      const status = normalizeMediaStatus(payload.status, payload.notes);
      const ref = doc(collection(db, 'media'));
      await setDoc(ref, {
        title: String(payload.title ?? '').trim(),
        mediaType: String(payload.mediaType ?? 'AUDIO'),
        sourceType: 'EXTERNAL_PLACEHOLDER',
        filePath: String(payload.filePath ?? '').trim(),
        publicUrl: payload.publicUrl ? String(payload.publicUrl).trim() : null,
        fileName: payload.fileName ? String(payload.fileName).trim() : null,
        durationSeconds: Number(payload.durationSeconds ?? 0),
        programId: payload.programId ? String(payload.programId) : null,
        notes: sanitizeMediaNotes(payload.notes),
        status,
        isActive: mapMediaActivity(status),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return ({ id: ref.id } as T);
    }

    if (method === 'PUT' && path.startsWith('/media/')) {
      const mediaId = path.replace('/media/', '').trim();
      const payload = init?.body ? JSON.parse(init.body as string) as Record<string, unknown> : {};
      const mediaRef = doc(db, 'media', mediaId);
      const mediaSnapshot = await getDoc(mediaRef);
      if (!mediaSnapshot.exists()) {
        throw new ApiError({ code: 'HTTP_ERROR', status: 404, message: 'Mídia não encontrada para atualização.' });
      }

      const current = mediaSnapshot.data();
      const currentSourceType = normalizeSourceType(String(current.sourceType ?? 'youtube'));
      const status = normalizeMediaStatus(payload.status, payload.notes);

      const updatePayload: Record<string, unknown> = {
        title: String(payload.title ?? '').trim(),
        mediaType: String(payload.mediaType ?? 'VIDEO').trim(),
        durationSeconds: Number(payload.durationSeconds ?? 0),
        programId: payload.programId ? String(payload.programId) : null,
        notes: sanitizeMediaNotes(payload.notes),
        status,
        isActive: mapMediaActivity(status),
        updatedAt: serverTimestamp()
      };

      if (currentSourceType === 'YOUTUBE') {
        const parsed = parseYoutubeUrl(String(payload.youtubeUrl ?? current.youtubeUrl ?? ''));
        updatePayload.youtubeUrl = parsed.youtubeUrl ?? null;
        updatePayload.youtubeVideoId = parsed.youtubeVideoId ?? null;
        updatePayload.embedUrl = parsed.embedUrl ?? null;
        updatePayload.thumbnailUrl = payload.thumbnailUrl ? String(payload.thumbnailUrl).trim() : (parsed.thumbnailUrl ?? null);
        updatePayload.filePath = null;
        updatePayload.publicUrl = null;
        updatePayload.fileName = null;
      } else {
        updatePayload.filePath = String(payload.filePath ?? current.filePath ?? '').trim();
        updatePayload.publicUrl = payload.publicUrl ? String(payload.publicUrl).trim() : null;
        updatePayload.fileName = payload.fileName ? String(payload.fileName).trim() : null;
      }

      await updateDoc(mediaRef, updatePayload);
      return ({ id: mediaId } as T);
    }

    if (method === 'POST' && path.endsWith('/status') && path.startsWith('/media/')) {
      const mediaId = path.replace('/media/', '').replace('/status', '').trim();
      const payload = init?.body ? JSON.parse(init.body as string) as Record<string, unknown> : {};
      const status = normalizeMediaStatus(payload.status);
      await updateDoc(doc(db, 'media', mediaId), {
        status,
        isActive: mapMediaActivity(status),
        updatedAt: serverTimestamp()
      });
      return ({ id: mediaId, status } as T);
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
  del: <T>(path: string, init?: RequestInit) => request<T>(path, { ...init, method: 'DELETE' }),
  async getScheduleDayView(payload: { date: string }) {
    const callable = httpsCallable<{ date: string }, ScheduleDayViewResponse>(functions, 'getScheduleDayView');
    const response = await callable(payload);
    return response.data;
  },
  async getScheduleWeekView(payload: { weekStartDate: string }) {
    const callable = httpsCallable<{ weekStartDate: string }, ScheduleWeekViewResponse>(functions, 'getScheduleWeekView');
    const response = await callable(payload);
    return response.data;
  },
  async createScheduleBlock(payload: CreateScheduleBlockPayload) {
    const callable = httpsCallable<CreateScheduleBlockPayload, { ok: true; createdBlockIds: string[]; recurrenceGroupId?: string | null }>(functions, 'createScheduleBlock');
    const response = await callable(payload);
    return response.data;
  },
  async updateScheduleBlock(payload: UpdateScheduleBlockPayload) {
    const callable = httpsCallable<UpdateScheduleBlockPayload, { ok: true; updatedBlockIds: string[] }>(functions, 'updateScheduleBlock');
    const response = await callable(payload);
    return response.data;
  },
  async deleteScheduleBlock(payload: { blockId: string; deleteScope?: 'THIS' | 'THIS_AND_FUTURE' | 'ALL_IN_GROUP' }) {
    const callable = httpsCallable<typeof payload, { ok: true; deletedBlockIds: string[] }>(functions, 'deleteScheduleBlock');
    const response = await callable(payload);
    return response.data;
  },
  async reorderScheduleBlockItems(payload: { blockId: string; items: Array<{ id: string; order: number }> }) {
    const callable = httpsCallable<typeof payload, { ok: true }>(functions, 'reorderScheduleBlockItems');
    const response = await callable(payload);
    return response.data;
  },
  async getPlaybackTimeline(payload?: { now?: string | null }) {
    const callable = httpsCallable<{ now?: string | null }, PlaybackTimelineResponse>(functions, 'getPlaybackTimeline');
    const response = await callable(payload ?? {});
    return response.data;
  },
  async getNowPlaying(payload?: GetNowPlayingCallablePayload) {
    const callable = httpsCallable<GetNowPlayingCallablePayload, NowPlayingResponse>(functions, 'getNowPlaying');
    const response = await callable(payload ?? {});
    return response.data;
  },
  async bootstrapRootAdmin() {
    try {
      const callable = httpsCallable<Record<string, never>, BootstrapRootAdminResponse>(functions, 'bootstrapRootAdmin');
      const response = await callable({});
      return response.data;
    } catch (error) {
      throw normalizeApiError(error);
    }
  },
  async listAppUsers() {
    try {
      const callable = httpsCallable<Record<string, unknown>, ListAppUsersResponse>(functions, 'listAppUsers');
      const response = await callable(withLocalRootAuth());
      return response.data;
    } catch (error) {
      throw normalizeApiError(error);
    }
  },
  async createAppUser(payload: CreateAppUserPayload) {
    try {
      const callable = httpsCallable<Record<string, unknown>, { ok: true; user: CanonicalUser }>(functions, 'createAppUser');
      const response = await callable(withLocalRootAuth(payload));
      return response.data;
    } catch (error) {
      throw normalizeApiError(error);
    }
  },
  async updateAppUser(payload: UpdateAppUserPayload) {
    try {
      const callable = httpsCallable<Record<string, unknown>, { ok: true; user: CanonicalUser }>(functions, 'updateAppUser');
      const response = await callable(withLocalRootAuth(payload));
      return response.data;
    } catch (error) {
      throw normalizeApiError(error);
    }
  },
  async setAppUserPassword(payload: SetAppUserPasswordPayload) {
    try {
      const callable = httpsCallable<Record<string, unknown>, { ok: true }>(functions, 'setAppUserPassword');
      const response = await callable(withLocalRootAuth(payload));
      return response.data;
    } catch (error) {
      throw normalizeApiError(error);
    }
  },
  async deleteAppUser(payload: DeleteAppUserPayload) {
    try {
      const callable = httpsCallable<Record<string, unknown>, { ok: true }>(functions, 'deleteAppUser');
      const response = await callable(withLocalRootAuth(payload));
      return response.data;
    } catch (error) {
      throw normalizeApiError(error);
    }
  },
  async loginLocalUser(payload: LoginLocalUserPayload) {
    try {
      const callable = httpsCallable<LoginLocalUserPayload, { ok: true; session: LocalUserSession }>(functions, 'loginLocalUser');
      const response = await callable(payload);
      return response.data;
    } catch (error) {
      throw normalizeApiError(error);
    }
  },
  async verifyLocalSession(payload: VerifyLocalSessionPayload) {
    try {
      const callable = httpsCallable<VerifyLocalSessionPayload, VerifyLocalSessionResponse>(functions, 'verifyLocalSession');
      const response = await callable(payload);
      return response.data;
    } catch (error) {
      throw normalizeApiError(error);
    }
  },
  async linkGoogleUserOnFirstLogin(payload: LinkGoogleUserOnFirstLoginPayload) {
    try {
      const callable = httpsCallable<LinkGoogleUserOnFirstLoginPayload, LinkGoogleUserOnFirstLoginResponse>(functions, 'linkGoogleUserOnFirstLogin');
      const response = await callable(payload);
      return response.data;
    } catch (error) {
      throw normalizeApiError(error);
    }
  }
};

export { REQUEST_TIMEOUT_MS, token };
