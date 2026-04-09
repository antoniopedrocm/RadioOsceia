import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import bcrypt from 'bcryptjs';
import * as crypto from 'node:crypto';
import { parseYoutubeUrl } from './youtube.js';
import type { CanonicalUser, UserAuthSource, UserRole, UserStatus } from './types/user.js';
import {
  buildNowPlayingPayload as buildSharedNowPlayingPayload,
  getDashboardSummary as getSharedDashboardSummary,
  resolveTimeline as resolveSharedTimeline,
  type DashboardDataAdapter,
  type TimelineMedia,
  type TimelineScheduleBlock,
  type TimelineSequenceItem
} from '../../src/lib/timeline.js';
import {
  createScheduleBlock as createScheduleBlockHandler,
  deleteScheduleBlock as deleteScheduleBlockHandler,
  getPlaybackTimeline as getPlaybackTimelineHandler,
  getScheduleDayView as getScheduleDayViewHandler,
  getScheduleWeekView as getScheduleWeekViewHandler,
  reorderScheduleBlockItems as reorderScheduleBlockItemsHandler,
  updateScheduleBlock as updateScheduleBlockHandler
} from './schedule.js';

initializeApp();

const db = getFirestore();
type AdminRole = 'admin' | 'operador';
type AdminStatus = 'ativo' | 'inativo';
type LegacyAuthSource = 'firebase' | 'local-root';

type CanonicalSessionPayload = {
  sub: 'local-app-user';
  uid: string;
  role: UserRole;
  authSource: 'LOCAL';
  email: string;
  exp: number;
};

function requireAuth(auth: { uid: string } | null | undefined) {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Usuário não autenticado.');
  }

  return auth.uid;
}

async function requireAdminOrOperator(uid: string) {
  const userDoc = await db.collection('users').doc(uid).get();
  const role = normalizeCanonicalRole(userDoc.data()?.role);
  if (role !== 'ADMIN' && role !== 'OPERADOR') {
    throw new HttpsError('permission-denied', 'Perfil sem permissão para esta operação.');
  }
}

async function requireAdmin(uid: string) {
  const userDoc = await db.collection('users').doc(uid).get();
  const role = normalizeCanonicalRole(userDoc.data()?.role);
  if (role !== 'ADMIN') {
    throw new HttpsError('permission-denied', 'Somente administradores podem gerenciar usuários.');
  }
}

function normalizeAdminRole(role: unknown): AdminRole | null {
  if (role === 'admin') return 'admin';
  if (role === 'operador') return 'operador';
  if (role === 'ADMIN') return 'admin';
  if (role === 'OPERADOR') return 'operador';
  return null;
}

function normalizeAdminStatus(status: unknown): AdminStatus {
  if (status === 'ACTIVE') return 'ativo';
  if (status === 'INACTIVE') return 'inativo';
  return status === 'inativo' ? 'inativo' : 'ativo';
}

function normalizeCanonicalRole(role: unknown): UserRole | null {
  if (role === 'ROOT' || role === 'ADMIN' || role === 'OPERADOR') return role;
  if (role === 'root') return 'ROOT';
  if (role === 'admin') return 'ADMIN';
  if (role === 'operador') return 'OPERADOR';
  return null;
}

function normalizeCanonicalStatus(status: unknown): UserStatus {
  if (status === 'INACTIVE' || status === 'inativo') return 'INACTIVE';
  return 'ACTIVE';
}

function toCanonicalRole(role: AdminRole | 'root'): UserRole {
  if (role === 'root') return 'ROOT';
  if (role === 'admin') return 'ADMIN';
  return 'OPERADOR';
}

function toCanonicalStatus(status: AdminStatus): UserStatus {
  return status === 'inativo' ? 'INACTIVE' : 'ACTIVE';
}

function toCanonicalAuthSource(authSource: 'firebase' | 'local-root', provider?: string): UserAuthSource {
  if (authSource === 'firebase' && provider === 'google') return 'GOOGLE';
  return 'LOCAL';
}

function toLegacyRole(role: UserRole): AdminRole | 'root' {
  if (role === 'ROOT') return 'root';
  if (role === 'ADMIN') return 'admin';
  return 'operador';
}

function toLegacyStatus(status: UserStatus): AdminStatus {
  return status === 'INACTIVE' ? 'inativo' : 'ativo';
}

function toLegacyAuthSource(authSource: UserAuthSource, role: UserRole, provider?: string): LegacyAuthSource {
  if (role === 'ROOT') return 'local-root';
  if (authSource === 'GOOGLE' || provider === 'google') return 'firebase';
  if (provider === 'local-root') return 'local-root';
  return 'firebase';
}

function ensureObject(value: unknown, fallback = 'Payload inválido.'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpsError('invalid-argument', fallback);
  }

  return value as Record<string, unknown>;
}

function ensureTrimmedString(
  value: unknown,
  fieldName: string,
  options: { required?: boolean; minLength?: number; maxLength?: number } = {}
) {
  const required = options.required ?? true;
  if (typeof value !== 'string') {
    if (!required && (value === undefined || value === null)) return null;
    throw new HttpsError('invalid-argument', `Campo inválido: ${fieldName}.`);
  }

  const normalized = value.trim();
  if (!normalized && required) {
    throw new HttpsError('invalid-argument', `Campo obrigatório: ${fieldName}.`);
  }

  if (options.minLength && normalized.length < options.minLength) {
    throw new HttpsError('invalid-argument', `Campo ${fieldName} deve ter ao menos ${options.minLength} caracteres.`);
  }

  if (options.maxLength && normalized.length > options.maxLength) {
    throw new HttpsError('invalid-argument', `Campo ${fieldName} deve ter no máximo ${options.maxLength} caracteres.`);
  }

  return normalized || null;
}

function ensureEmail(value: unknown, fieldName = 'email') {
  const normalized = ensureTrimmedString(value, fieldName, { minLength: 5, maxLength: 320 })?.toLowerCase();
  if (!normalized) {
    throw new HttpsError('invalid-argument', `Campo obrigatório: ${fieldName}.`);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalized)) {
    throw new HttpsError('invalid-argument', `Campo inválido: ${fieldName}.`);
  }

  return normalized;
}

function ensureCanonicalRole(role: unknown): UserRole {
  const normalized = normalizeCanonicalRole(role);
  if (!normalized) {
    throw new HttpsError('invalid-argument', 'Campo inválido: role.');
  }
  return normalized;
}

function ensureCanonicalStatus(status: unknown): UserStatus {
  if (status === 'ACTIVE' || status === 'active' || status === 'ativo') return 'ACTIVE';
  if (status === 'INACTIVE' || status === 'inactive' || status === 'inativo') return 'INACTIVE';
  throw new HttpsError('invalid-argument', 'Campo inválido: status.');
}

function ensureAuthSource(value: unknown): UserAuthSource {
  if (value === 'LOCAL' || value === 'local') return 'LOCAL';
  if (value === 'GOOGLE' || value === 'google') return 'GOOGLE';
  throw new HttpsError('invalid-argument', 'Campo inválido: authSource.');
}

function ensurePassword(value: unknown, fieldName = 'password') {
  const password = ensureTrimmedString(value, fieldName, { minLength: 8, maxLength: 128 });
  if (!password) {
    throw new HttpsError('invalid-argument', `Campo obrigatório: ${fieldName}.`);
  }

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  if (!hasUppercase || !hasLowercase || !hasNumber || !hasSymbol) {
    throw new HttpsError(
      'invalid-argument',
      `Campo ${fieldName} deve conter ao menos 1 letra maiúscula, 1 minúscula, 1 número e 1 símbolo.`
    );
  }

  return password;
}

function assertPasswordHashFormat(hash: string, fieldName = 'passwordHash') {
  if (!hash.startsWith('$2')) {
    throw new HttpsError('failed-precondition', `${fieldName} inválido. Use hash bcrypt.`);
  }
}

function getUserProviderLabel(providerData: Array<{ providerId?: string }>) {
  if (!providerData.length) return 'password';
  if (providerData.some((provider) => provider.providerId === 'google.com')) return 'google';
  if (providerData.some((provider) => provider.providerId === 'password')) return 'password';
  return providerData[0]?.providerId ?? 'desconhecido';
}

function toAdminUserViewModel(params: CanonicalUser & {
  institution?: string | null;
  uid?: string;
}) {
  return {
    id: params.id,
    uid: params.uid ?? params.firebaseUid ?? params.id,
    nome: params.name,
    email: params.email,
    perfil: toLegacyRole(params.role),
    status: toLegacyStatus(params.status),
    dataCriacao: params.createdAt ?? '',
    ultimoAcesso: params.lastLoginAt ?? '',
    provider: params.provider,
    authSource: toLegacyAuthSource(params.authSource, params.role, params.provider),
    institution: params.institution ?? null,
    disabled: params.status === 'INACTIVE'
  };
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
    .get();

  const activeBlocks = blocksSnapshot.docs
    .filter((doc) => doc.data().isActive === true)
    .sort((a, b) =>
      String(a.data().startTime ?? '').localeCompare(String(b.data().startTime ?? ''))
    );

  return activeBlocks.map((blockDoc) => {
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

export const createScheduleBlock = onCall(createScheduleBlockHandler);
export const updateScheduleBlock = onCall(updateScheduleBlockHandler);
export const deleteScheduleBlock = onCall(deleteScheduleBlockHandler);
export const reorderScheduleBlockItems = onCall(reorderScheduleBlockItemsHandler);
export const getScheduleDayView = onCall(getScheduleDayViewHandler);
export const getScheduleWeekView = onCall(getScheduleWeekViewHandler);
export const getPlaybackTimeline = onCall(getPlaybackTimelineHandler);



type LocalRootSessionPayload = {
  sub: 'local-root-admin';
  role: 'ROOT';
  authSource: 'LOCAL';
  username: string;
  exp: number;
};

function getLocalRootConfig() {
  const ttlMinutesRaw = Number(process.env.LOCAL_ROOT_SESSION_TTL_MINUTES);
  const ttlMinutes = Number.isFinite(ttlMinutesRaw) && ttlMinutesRaw >= 5 && ttlMinutesRaw <= 24 * 60
    ? Math.floor(ttlMinutesRaw)
    : 8 * 60;

  return {
    enabled: process.env.LOCAL_ROOT_ENABLED === 'true',
    username: process.env.LOCAL_ROOT_USERNAME ?? 'Admin',
    passwordHash: process.env.LOCAL_ROOT_PASSWORD_HASH ?? '',
    sessionSecret: process.env.LOCAL_ROOT_SESSION_SECRET ?? '',
    sessionTtlMinutes: ttlMinutes
  };
}

function getLocalAuthConfig() {
  const ttlMinutesRaw = Number(process.env.LOCAL_SESSION_TTL_MINUTES);
  const ttlMinutes = Number.isFinite(ttlMinutesRaw) && ttlMinutesRaw >= 5 && ttlMinutesRaw <= 24 * 60
    ? Math.floor(ttlMinutesRaw)
    : 8 * 60;

  return {
    enabled: process.env.LOCAL_AUTH_ENABLED === 'true',
    sessionSecret: process.env.LOCAL_SESSION_SECRET?.trim() ?? '',
    sessionTtlMinutes: ttlMinutes
  };
}

function toBase64Url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url');
}

function signLocalRootToken(payload: LocalRootSessionPayload, secret: string) {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = toBase64Url(JSON.stringify(payload));
  const signature = toBase64Url(crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${signature}`;
}

function signLocalUserToken(payload: CanonicalSessionPayload, secret: string) {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = toBase64Url(JSON.stringify(payload));
  const signature = toBase64Url(crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${signature}`;
}

function verifyLocalRootToken(token: string, secret: string): LocalRootSessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const expected = toBase64Url(crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest());
  if (signature !== expected) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as LocalRootSessionPayload;
    if (payload.sub !== 'local-root-admin') return null;
    if (payload.role !== 'ROOT') return null;
    if (payload.authSource !== 'LOCAL') return null;
    if (typeof payload.username !== 'string' || !payload.username.trim()) return null;
    if (typeof payload.exp !== 'number') return null;
    if (payload.exp * 1000 <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function verifyLocalUserToken(token: string, secret: string): CanonicalSessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expected = toBase64Url(crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest());
  if (signature !== expected) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as CanonicalSessionPayload;
    if (payload.sub !== 'local-app-user') return null;
    if (!payload.uid?.trim()) return null;
    if (!payload.email?.trim()) return null;
    if (payload.authSource !== 'LOCAL') return null;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) return null;
    if (!normalizeCanonicalRole(payload.role)) return null;
    return payload;
  } catch {
    return null;
  }
}

function toIsoString(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return ((value as { toDate: () => Date }).toDate()).toISOString();
  }
  return undefined;
}

function toCanonicalUserFromDoc(docId: string, rawData: Record<string, unknown>): CanonicalUser {
  const role = normalizeCanonicalRole(rawData.role) ?? 'OPERADOR';
  const status = normalizeCanonicalStatus(rawData.status);
  const authSource: UserAuthSource = rawData.authSource === 'GOOGLE' ? 'GOOGLE' : 'LOCAL';

  return {
    id: docId,
    firebaseUid: typeof rawData.firebaseUid === 'string' ? rawData.firebaseUid : undefined,
    email: String(rawData.email ?? ''),
    name: String(rawData.name ?? ''),
    role,
    status,
    authSource,
    provider: typeof rawData.provider === 'string' ? rawData.provider : undefined,
    passwordHash: typeof rawData.passwordHash === 'string' ? rawData.passwordHash : undefined,
    isActive: status === 'ACTIVE',
    isProtected: Boolean(rawData.isProtected ?? false),
    createdAt: toIsoString(rawData.createdAt),
    updatedAt: toIsoString(rawData.updatedAt),
    lastLoginAt: toIsoString(rawData.lastLoginAt)
  };
}

async function listCanonicalUsers(includeLocalRoot = true): Promise<CanonicalUser[]> {
  const usersSnapshot = await db.collection('users').get();
  const users = usersSnapshot.docs.map((docItem) => toCanonicalUserFromDoc(docItem.id, docItem.data() as Record<string, unknown>))
    .filter((user) => user.role === 'ROOT' || user.role === 'ADMIN' || user.role === 'OPERADOR');

  if (!includeLocalRoot) {
    return users.filter((user) => user.id !== 'local-root-admin');
  }

  return users;
}

async function verifyLocalRootPassword(password: string, passwordHash: string) {
  if (!passwordHash) return false;
  return bcrypt.compare(password, passwordHash);
}

function buildLocalRootUser() {
  const cfg = getLocalRootConfig();
  return {
    ...toAdminUserViewModel({
    id: 'local-root-admin',
    uid: 'local-root-admin',
    email: 'local-root@radioosceia.local',
    name: cfg.username,
    role: 'ROOT',
    status: 'ACTIVE',
    provider: 'local-root',
    authSource: 'LOCAL',
    isActive: true,
    isProtected: true,
    institution: null
    }),
    isProtected: true,
    isLocalRoot: true
  };
}

async function isFirebaseAdmin(uid: string) {
  const userDoc = await db.collection('users').doc(uid).get();
  return normalizeCanonicalRole(userDoc.data()?.role) === 'ADMIN';
}

async function requireAdminOrLocalRoot(request: { auth?: { uid?: string } | null; data?: Record<string, unknown> }) {
  const uid = request.auth?.uid;
  if (uid && await isFirebaseAdmin(uid)) {
    return { uid, isLocalRoot: false };
  }

  const cfg = getLocalRootConfig();
  const token = typeof request.data?.localRootToken === 'string' ? request.data.localRootToken : '';
  if (!cfg.enabled || !cfg.sessionSecret || !token) {
    throw new HttpsError('permission-denied', 'Somente admin Firebase ou root local podem executar esta operação.');
  }

  const payload = verifyLocalRootToken(token, cfg.sessionSecret);
  if (!payload || payload.username !== cfg.username) {
    throw new HttpsError('permission-denied', 'Sessão local root inválida ou expirada.');
  }

  return { uid: 'local-root-admin', isLocalRoot: true };
}

async function ensureCanRemoveActiveAdmin(params: { targetUid: string; nextStatus: AdminStatus; nextRole: AdminRole; currentRole: AdminRole | null; currentStatus: AdminStatus }) {
  const currentlyActiveAdmin = params.currentRole === 'admin' && params.currentStatus === 'ativo';
  const remainsActiveAdmin = params.nextRole === 'admin' && params.nextStatus === 'ativo';

  if (!currentlyActiveAdmin || remainsActiveAdmin) {
    return;
  }

  const activeAdminSnapshot = await db.collection('users')
    .where('role', 'in', ['ADMIN', 'admin'])
    .get();

  const remainingActiveAdmins = activeAdminSnapshot.docs.filter((docItem) => {
    if (docItem.id === params.targetUid) return false;
    const status = normalizeCanonicalStatus(docItem.data()?.status);
    return status === 'ACTIVE';
  });

  if (remainingActiveAdmins.length === 0) {
    throw new HttpsError('failed-precondition', 'Não é permitido remover/desativar o último admin ativo.');
  }
}

async function requireAdminOrOperatorOrLocalRoot(request: { auth?: { uid?: string } | null; data?: Record<string, unknown> }) {
  const uid = request.auth?.uid;
  if (uid) {
    const userDoc = await db.collection('users').doc(uid).get();
    const role = normalizeCanonicalRole(userDoc.data()?.role);
    if (role === 'ADMIN' || role === 'OPERADOR') {
      return { uid, role: role === 'ADMIN' ? 'admin' : 'operador', isLocalRoot: false };
    }
  }

  const root = await requireAdminOrLocalRoot(request);
  return { ...root, role: 'root' as const };
}

export const loginLocalRoot = onCall(async (request) => {
  const cfg = getLocalRootConfig();
  const data = request.data as { username?: string; password?: string };

  if (!cfg.enabled) {
    throw new HttpsError('failed-precondition', 'Root local está desabilitado.');
  }

  if (!cfg.passwordHash || !cfg.sessionSecret) {
    throw new HttpsError('failed-precondition', 'Root local não configurado no servidor.');
  }

  const username = data.username?.trim() ?? '';
  const password = data.password?.trim() ?? '';

  if (username !== cfg.username || !(await verifyLocalRootPassword(password, cfg.passwordHash))) {
    throw new HttpsError('permission-denied', 'Credenciais do root local inválidas.');
  }

  const ttlSeconds = cfg.sessionTtlMinutes * 60;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const token = signLocalRootToken({
    sub: 'local-root-admin',
    role: 'ROOT',
    authSource: 'LOCAL',
    username: cfg.username,
    exp: nowSeconds + ttlSeconds
  }, cfg.sessionSecret);

  const session = {
    token,
    expiresAt: new Date((nowSeconds + ttlSeconds) * 1000).toISOString(),
    user: buildLocalRootUser()
  };

  return { ok: true, session };
});

export const listAppUsers = onCall(async (request) => {
  await requireAdminOrOperatorOrLocalRoot(request);
  const users = await listCanonicalUsers(true);
  users.sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
  return { users };
});

export const createAppUser = onCall(async (request) => {
  await requireAdminOrLocalRoot(request);
  const payload = ensureObject(request.data, 'Payload inválido para criação de usuário.');
  const name = ensureTrimmedString(payload.name, 'name', { minLength: 2, maxLength: 120 });
  const email = ensureEmail(payload.email);
  const role = ensureCanonicalRole(payload.role);
  if (role === 'ROOT') {
    throw new HttpsError('failed-precondition', 'Não é permitido criar usuário com role ROOT por esta operação.');
  }
  const status = ensureCanonicalStatus(payload.status ?? 'ACTIVE');
  const authSource = ensureAuthSource(payload.authSource ?? 'LOCAL');
  const institution = ensureTrimmedString(payload.institution, 'institution', { required: false, maxLength: 120 }) ?? 'Irmão Áureo';
  const passwordInput = typeof payload.password === 'string' && payload.password.trim()
    ? payload.password.trim()
    : null;
  const password = authSource === 'LOCAL' ? ensurePassword(payload.password) : null;
  if (authSource === 'GOOGLE' && passwordInput) {
    throw new HttpsError('invalid-argument', 'Usuário com authSource GOOGLE não pode informar password.');
  }

  const duplicatedByEmailSnapshot = await db.collection('users')
    .where('email', '==', email)
    .limit(1)
    .get();
  if (!duplicatedByEmailSnapshot.empty) {
    throw new HttpsError('already-exists', 'Já existe usuário cadastrado com este e-mail.');
  }

  const firebaseUid: string | null = null;
  const userRef = db.collection('users').doc();
  const canonicalUser: CanonicalUser = {
    id: userRef.id,
    email,
    name: name ?? email.split('@')[0],
    role,
    status,
    authSource,
    provider: authSource === 'GOOGLE' ? 'google' : 'local',
    isActive: status === 'ACTIVE',
    isProtected: false,
    passwordHash: authSource === 'LOCAL' && password ? await bcrypt.hash(password, 12) : undefined
  };

  await userRef.set({
    ...canonicalUser,
    firebaseUid,
    institution,
    lastLoginAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return { ok: true, user: canonicalUser };
});

export const updateAppUser = onCall(async (request) => {
  const actor = await requireAdminOrLocalRoot(request);
  const payload = ensureObject(request.data, 'Payload inválido para atualização de usuário.');
  const uid = ensureTrimmedString(payload.uid ?? payload.id, 'uid');
  if (!uid) throw new HttpsError('invalid-argument', 'Campo obrigatório: uid.');
  if (!actor.isLocalRoot && actor.uid === uid && normalizeCanonicalRole(payload.role) !== 'ADMIN') {
    throw new HttpsError('failed-precondition', 'Você não pode remover seu próprio acesso administrativo.');
  }

  const userRef = db.collection('users').doc(uid);
  const snapshot = await userRef.get();
  if (!snapshot.exists) {
    throw new HttpsError('not-found', 'Usuário não encontrado.');
  }

  const existingUser = toCanonicalUserFromDoc(uid, snapshot.data() as Record<string, unknown>);
  const role = payload.role ? ensureCanonicalRole(payload.role) : existingUser.role;
  const status = payload.status ? ensureCanonicalStatus(payload.status) : existingUser.status;
  const name = payload.name ? ensureTrimmedString(payload.name, 'name', { minLength: 2, maxLength: 120 }) : existingUser.name;
  const institution = payload.institution
    ? ensureTrimmedString(payload.institution, 'institution', { required: false, maxLength: 120 }) ?? 'Irmão Áureo'
    : undefined;

  if (!actor.isLocalRoot && actor.uid === uid && (role !== 'ADMIN' || status !== 'ACTIVE')) {
    throw new HttpsError('failed-precondition', 'Você não pode perder o próprio acesso administrativo.');
  }

  await ensureCanRemoveActiveAdmin({
    targetUid: uid,
    nextRole: role === 'ADMIN' ? 'admin' : 'operador',
    nextStatus: status === 'ACTIVE' ? 'ativo' : 'inativo',
    currentRole: existingUser.role === 'ADMIN' ? 'admin' : existingUser.role === 'OPERADOR' ? 'operador' : null,
    currentStatus: existingUser.status === 'ACTIVE' ? 'ativo' : 'inativo'
  });

  if (existingUser.firebaseUid) {
    await getAuth().updateUser(existingUser.firebaseUid, {
      displayName: name ?? existingUser.name,
      disabled: status === 'INACTIVE'
    });
  }

  await userRef.set({
    name: name ?? existingUser.name,
    role,
    status,
    isActive: status === 'ACTIVE',
    ...(institution ? { institution } : {}),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  const updatedDoc = await userRef.get();
  return { ok: true, user: toCanonicalUserFromDoc(uid, updatedDoc.data() as Record<string, unknown>) };
});

export const setAppUserPassword = onCall(async (request) => {
  await requireAdminOrLocalRoot(request);
  const payload = ensureObject(request.data, 'Payload inválido para atualização de senha.');
  const uid = ensureTrimmedString(payload.uid ?? payload.id, 'uid');
  if (!uid) throw new HttpsError('invalid-argument', 'Campo obrigatório: uid.');
  const password = ensurePassword(payload.password);

  const userRef = db.collection('users').doc(uid);
  const snapshot = await userRef.get();
  if (!snapshot.exists) {
    throw new HttpsError('not-found', 'Usuário não encontrado.');
  }

  const user = toCanonicalUserFromDoc(uid, snapshot.data() as Record<string, unknown>);
  if (user.authSource === 'GOOGLE' && !user.firebaseUid) {
    throw new HttpsError('failed-precondition', 'Usuário Google sem vínculo Firebase não suporta senha local.');
  }

  if (user.firebaseUid) {
    await getAuth().updateUser(user.firebaseUid, { password });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await userRef.set({
    authSource: 'LOCAL',
    provider: 'password',
    passwordHash,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return { ok: true };
});

export const deleteAppUser = onCall(async (request) => {
  const actor = await requireAdminOrLocalRoot(request);
  const payload = ensureObject(request.data, 'Payload inválido para exclusão de usuário.');
  const uid = ensureTrimmedString(payload.uid ?? payload.id, 'uid');
  if (!uid) throw new HttpsError('invalid-argument', 'Campo obrigatório: uid.');
  if (!actor.isLocalRoot && actor.uid === uid) {
    throw new HttpsError('failed-precondition', 'Você não pode excluir a própria conta.');
  }

  const userRef = db.collection('users').doc(uid);
  const snapshot = await userRef.get();
  if (!snapshot.exists) {
    throw new HttpsError('not-found', 'Usuário não encontrado.');
  }

  const user = toCanonicalUserFromDoc(uid, snapshot.data() as Record<string, unknown>);
  await ensureCanRemoveActiveAdmin({
    targetUid: uid,
    nextRole: user.role === 'ADMIN' ? 'operador' : 'operador',
    nextStatus: 'inativo',
    currentRole: user.role === 'ADMIN' ? 'admin' : user.role === 'OPERADOR' ? 'operador' : null,
    currentStatus: user.status === 'ACTIVE' ? 'ativo' : 'inativo'
  });

  if (user.firebaseUid) {
    await getAuth().deleteUser(user.firebaseUid).catch(() => null);
  }

  await userRef.set({
    deleted: true,
    deletedAt: FieldValue.serverTimestamp(),
    status: 'INACTIVE',
    isActive: false,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return { ok: true };
});

export const loginLocalUser = onCall(async (request) => {
  const cfg = getLocalAuthConfig();
  if (!cfg.enabled) {
    throw new HttpsError('failed-precondition', 'Autenticação local desabilitada.');
  }

  if (!cfg.sessionSecret) {
    throw new HttpsError('failed-precondition', 'Segredo de sessão local não configurado.');
  }

  const payload = ensureObject(request.data, 'Payload inválido para login local.');
  const emailOrUsername = ensureTrimmedString(payload.emailOrUsername, 'emailOrUsername', { minLength: 3, maxLength: 320 });
  const password = ensureTrimmedString(payload.password, 'password', { minLength: 1, maxLength: 128 });
  if (!emailOrUsername || !password) {
    throw new HttpsError('invalid-argument', 'Credenciais inválidas.');
  }

  const normalizedIdentifier = emailOrUsername.toLowerCase();
  const emailLike = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailOrUsername);

  const candidateSnapshots = [];
  if (emailLike) {
    const normalizedEmail = ensureEmail(emailOrUsername, 'emailOrUsername');
    candidateSnapshots.push(await db.collection('users')
      .where('email', '==', normalizedEmail)
      .where('authSource', '==', 'LOCAL')
      .limit(1)
      .get());
  }

  if (!emailLike || candidateSnapshots[0]?.empty) {
    candidateSnapshots.push(await db.collection('users')
      .where('username', '==', normalizedIdentifier)
      .where('authSource', '==', 'LOCAL')
      .limit(1)
      .get());
  }

  const userDoc = candidateSnapshots.flatMap((snapshot) => snapshot.docs)[0];
  if (!userDoc) {
    throw new HttpsError('permission-denied', 'Credenciais inválidas.');
  }

  const user = toCanonicalUserFromDoc(userDoc.id, userDoc.data() as Record<string, unknown>);
  if (user.status === 'INACTIVE') {
    throw new HttpsError('permission-denied', 'Conta inativa.');
  }

  const passwordHash = user.passwordHash ?? '';
  assertPasswordHashFormat(passwordHash);
  const valid = await bcrypt.compare(password, passwordHash);
  if (!valid) {
    throw new HttpsError('permission-denied', 'Credenciais inválidas.');
  }

  const ttlSeconds = cfg.sessionTtlMinutes * 60;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const exp = nowSeconds + ttlSeconds;
  const token = signLocalUserToken({
    sub: 'local-app-user',
    uid: user.id,
    role: user.role,
    authSource: 'LOCAL',
    email: user.email,
    exp
  }, cfg.sessionSecret);

  await userDoc.ref.set({
    lastLoginAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return {
    ok: true,
    session: {
      token,
      expiresAt: new Date(exp * 1000).toISOString(),
      user: {
        ...user,
        lastLoginAt: new Date().toISOString()
      }
    }
  };
});

export const verifyLocalSession = onCall(async (request) => {
  const cfg = getLocalAuthConfig();
  if (!cfg.enabled || !cfg.sessionSecret) {
    return { valid: false };
  }

  const payload = ensureObject(request.data, 'Payload inválido para validação de sessão.');
  const token = ensureTrimmedString(payload.token, 'token');
  if (!token) return { valid: false };

  const parsed = verifyLocalUserToken(token, cfg.sessionSecret);
  if (!parsed) return { valid: false };

  const userDoc = await db.collection('users').doc(parsed.uid).get();
  if (!userDoc.exists) return { valid: false };
  const user = toCanonicalUserFromDoc(userDoc.id, userDoc.data() as Record<string, unknown>);
  if (user.status !== 'ACTIVE' || user.authSource !== 'LOCAL') return { valid: false };

  return {
    valid: true,
    expiresAt: new Date(parsed.exp * 1000).toISOString(),
    user
  };
});

export const linkGoogleUserOnFirstLogin = onCall(async (request) => {
  const uid = requireAuth(request.auth);
  const payload = ensureObject(request.data, 'Payload inválido para vínculo Google no primeiro login.');
  const firebaseUid = ensureTrimmedString(payload.firebaseUid, 'firebaseUid');
  const email = ensureEmail(payload.email);
  const name = ensureTrimmedString(payload.name, 'name', { minLength: 2, maxLength: 160 });
  const provider = ensureTrimmedString(payload.provider, 'provider');

  if (!firebaseUid || !name || provider !== 'google') {
    throw new HttpsError('invalid-argument', 'Payload inválido. Use { firebaseUid, email, name, provider: "google" }.');
  }

  if (uid !== firebaseUid) {
    throw new HttpsError('permission-denied', 'firebaseUid divergente do usuário autenticado.');
  }

  let targetDocId = firebaseUid;
  let linked = false;
  let created = false;

  const pendingGoogleUsers = await db.collection('users')
    .where('authSource', '==', 'GOOGLE')
    .where('email', '==', email)
    .where('firebaseUid', '==', null)
    .limit(1)
    .get();

  const pendingGoogleUser = pendingGoogleUsers.docs[0];
  if (pendingGoogleUser) {
    targetDocId = pendingGoogleUser.id;
    linked = true;
    await pendingGoogleUser.ref.set({
      email,
      name,
      provider: 'google',
      firebaseUid,
      lastLoginAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  } else {
    const existingByUidRef = db.collection('users').doc(firebaseUid);
    const existingByUid = await existingByUidRef.get();
    if (existingByUid.exists) {
      await existingByUidRef.set({
        email,
        name,
        authSource: 'GOOGLE',
        provider: 'google',
        firebaseUid,
        lastLoginAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    } else {
      // Estratégia adotada quando não há cadastro pendente:
      // cria automaticamente um usuário canônico Google com perfil OPERADOR ativo.
      created = true;
      await existingByUidRef.set({
        id: firebaseUid,
        email,
        name,
        role: 'OPERADOR',
        status: 'ACTIVE',
        authSource: 'GOOGLE',
        provider: 'google',
        isActive: true,
        isProtected: false,
        firebaseUid,
        lastLoginAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
  }

  const resolvedDoc = await db.collection('users').doc(targetDocId).get();
  if (!resolvedDoc.exists) {
    throw new HttpsError('not-found', 'Não foi possível resolver o cadastro canônico do usuário Google.');
  }

  const canonicalUser = toCanonicalUserFromDoc(resolvedDoc.id, resolvedDoc.data() as Record<string, unknown>);
  if (canonicalUser.status === 'INACTIVE') {
    throw new HttpsError('permission-denied', 'Acesso bloqueado: usuário inativo.');
  }

  return {
    ok: true,
    linked,
    created,
    strategy: created ? 'create_default_google_operador_active' : 'link_existing_or_reuse',
    user: canonicalUser
  };
});

export const listAdminUsers = onCall(async (request) => {
  await requireAdminOrOperatorOrLocalRoot(request);

  const auth = getAuth();
  const adminProfilesSnapshot = await db.collection('users').where('role', 'in', ['ADMIN', 'OPERADOR', 'admin', 'operador']).get();
  const profileByUid = new Map<string, Record<string, unknown>>(adminProfilesSnapshot.docs.map((docItem) => [docItem.id, docItem.data() as Record<string, unknown>]));

  let nextPageToken: string | undefined = undefined;
  const users: Array<Record<string, unknown>> = [];

  do {
    const result = await auth.listUsers(1000, nextPageToken);
    result.users.forEach((authUser) => {
      const profile = profileByUid.get(authUser.uid);
      const role = normalizeAdminRole(profile?.role);
      if (!role) return;

      const status = normalizeAdminStatus(profile?.status ?? (authUser.disabled ? 'INACTIVE' : 'ACTIVE'));
      const canonicalStatus = toCanonicalStatus(status);
      const provider = getUserProviderLabel(authUser.providerData);
      const authSource = toCanonicalAuthSource('firebase', provider);
      const viewModel = toAdminUserViewModel({
        id: authUser.uid,
        firebaseUid: authUser.uid,
        email: authUser.email ?? String(profile?.email ?? ''),
        name: authUser.displayName ?? String(profile?.name ?? authUser.email?.split('@')[0] ?? 'Usuário'),
        role: toCanonicalRole(role),
        status: canonicalStatus,
        provider,
        authSource,
        isActive: canonicalStatus === 'ACTIVE',
        isProtected: Boolean(profile?.isProtected ?? false),
        createdAt: authUser.metadata.creationTime ?? undefined,
        lastLoginAt: authUser.metadata.lastSignInTime ?? undefined,
        updatedAt: undefined,
        institution: typeof profile?.institution === 'string' ? profile.institution : null
      });

      users.push({ ...viewModel, isProtected: false, isLocalRoot: false });
    });

    nextPageToken = result.pageToken;
  } while (nextPageToken);

  if (getLocalRootConfig().enabled) {
    users.unshift(buildLocalRootUser());
  }

  users.sort((a, b) => String(b.dataCriacao ?? '').localeCompare(String(a.dataCriacao ?? '')));

  return { users };
});

export const createAdminUser = onCall(async (request) => {
  await requireAdminOrLocalRoot(request);

  const data = request.data as { nome?: string; email?: string; senha?: string; perfil?: AdminRole; status?: AdminStatus; institution?: string };
  const role = normalizeAdminRole(data.perfil);
  const status = normalizeAdminStatus(data.status);

  if (!data.nome?.trim() || !data.email?.trim() || !data.senha?.trim() || !role) {
    throw new HttpsError('invalid-argument', 'Dados inválidos. Informe nome, e-mail, senha e perfil administrativo.');
  }

  const auth = getAuth();
  const createdUser = await auth.createUser({
    email: data.email.trim().toLowerCase(),
    password: data.senha,
    displayName: data.nome.trim(),
    disabled: status === 'inativo'
  });

  await db.collection('users').doc(createdUser.uid).set({
    id: createdUser.uid,
    name: data.nome.trim(),
    email: data.email.trim().toLowerCase(),
    authSource: toCanonicalAuthSource('firebase', 'password'),
    role: toCanonicalRole(role),
    status: toCanonicalStatus(status),
    institution: data.institution ?? 'Irmão Áureo',
    isActive: status === 'ativo',
    isProtected: false,
    firebaseUid: createdUser.uid,
    passwordHash: null,
    provider: 'password',
    lastLoginAt: createdUser.metadata.lastSignInTime ?? null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return {
    ok: true,
    user: { ...toAdminUserViewModel({
      id: createdUser.uid,
      firebaseUid: createdUser.uid,
      email: createdUser.email ?? data.email.trim().toLowerCase(),
      name: createdUser.displayName ?? data.nome.trim(),
      role: toCanonicalRole(role),
      status: toCanonicalStatus(status),
      provider: 'password',
      authSource: toCanonicalAuthSource('firebase', 'password'),
      isActive: !createdUser.disabled,
      isProtected: false,
      createdAt: createdUser.metadata.creationTime ?? undefined,
      lastLoginAt: createdUser.metadata.lastSignInTime ?? undefined,
      institution: data.institution ?? 'Irmão Áureo'
    }), isProtected: false, isLocalRoot: false }
  };
});

export const updateAdminUser = onCall(async (request) => {
  const actor = await requireAdminOrLocalRoot(request);

  const data = request.data as { uid?: string; nome?: string; perfil?: AdminRole; status?: AdminStatus; senha?: string; institution?: string };
  if (!data.uid?.trim()) {
    throw new HttpsError('invalid-argument', 'UID do usuário é obrigatório.');
  }

  if (data.uid === 'local-root-admin') {
    throw new HttpsError('failed-precondition', 'Usuário root local não é editável por esta operação.');
  }

  const role = normalizeAdminRole(data.perfil);
  const status = normalizeAdminStatus(data.status);
  if (!data.nome?.trim() || !role) {
    throw new HttpsError('invalid-argument', 'Nome e perfil administrativo válidos são obrigatórios.');
  }

  const auth = getAuth();
  const targetUid = data.uid.trim();
  const targetUser = await auth.getUser(targetUid);
  const targetSnapshot = await db.collection('users').doc(targetUid).get();
  const currentRole = normalizeAdminRole(targetSnapshot.data()?.role);
  const currentStatus = normalizeAdminStatus(targetSnapshot.data()?.status ?? (targetUser.disabled ? 'inativo' : 'ativo'));

  if (!actor.isLocalRoot && actor.uid === targetUid && (role !== 'admin' || status === 'inativo')) {
    throw new HttpsError('failed-precondition', 'Você não pode remover seu próprio acesso administrativo.');
  }

  await ensureCanRemoveActiveAdmin({
    targetUid,
    nextRole: role,
    nextStatus: status,
    currentRole,
    currentStatus
  });

  await auth.updateUser(targetUid, {
    displayName: data.nome.trim(),
    disabled: status === 'inativo',
    ...(data.senha?.trim() ? { password: data.senha } : {})
  });

  await db.collection('users').doc(targetUid).set({
    id: targetUid,
    name: data.nome.trim(),
    email: targetUser.email ?? '',
    authSource: toCanonicalAuthSource('firebase', getUserProviderLabel(targetUser.providerData)),
    role: toCanonicalRole(role),
    status: toCanonicalStatus(status),
    isActive: status === 'ativo',
    isProtected: Boolean(targetSnapshot.data()?.isProtected ?? false),
    firebaseUid: targetUid,
    passwordHash: null,
    provider: getUserProviderLabel(targetUser.providerData),
    lastLoginAt: targetUser.metadata.lastSignInTime ?? null,
    institution: data.institution ?? 'Irmão Áureo',
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  const updated = await auth.getUser(targetUid);
  return {
    ok: true,
    user: { ...toAdminUserViewModel({
      id: updated.uid,
      firebaseUid: updated.uid,
      email: updated.email ?? '',
      name: updated.displayName ?? data.nome.trim(),
      role: toCanonicalRole(role),
      status: toCanonicalStatus(status),
      provider: getUserProviderLabel(updated.providerData),
      authSource: toCanonicalAuthSource('firebase', getUserProviderLabel(updated.providerData)),
      isActive: !updated.disabled,
      isProtected: false,
      createdAt: updated.metadata.creationTime ?? undefined,
      lastLoginAt: updated.metadata.lastSignInTime ?? undefined,
      institution: data.institution ?? 'Irmão Áureo'
    }), isProtected: false, isLocalRoot: false }
  };
});

export const setAdminUserStatus = onCall(async (request) => {
  const actor = await requireAdminOrLocalRoot(request);

  const data = request.data as { uid?: string; status?: AdminStatus };
  if (!data.uid?.trim()) {
    throw new HttpsError('invalid-argument', 'UID do usuário é obrigatório.');
  }

  if (data.uid === 'local-root-admin') {
    throw new HttpsError('failed-precondition', 'Usuário root local não pode ser desativado por esta operação.');
  }

  const status = normalizeAdminStatus(data.status);
  const targetUid = data.uid.trim();
  if (!actor.isLocalRoot && actor.uid === targetUid && status === 'inativo') {
    throw new HttpsError('failed-precondition', 'Você não pode desativar a própria conta.');
  }

  const targetRef = db.collection('users').doc(targetUid);
  const targetSnapshot = await targetRef.get();
  const targetRole = normalizeAdminRole(targetSnapshot.data()?.role);

  if (!targetRole) {
    throw new HttpsError('failed-precondition', 'Usuário alvo não possui perfil administrativo válido.');
  }

  const targetStatus = normalizeAdminStatus(targetSnapshot.data()?.status);
  await ensureCanRemoveActiveAdmin({
    targetUid,
    nextRole: targetRole,
    nextStatus: status,
    currentRole: targetRole,
    currentStatus: targetStatus
  });

  const auth = getAuth();
  await auth.updateUser(targetUid, { disabled: status === 'inativo' });
  await targetRef.set({
    status: toCanonicalStatus(status),
    isActive: status === 'ativo',
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return { ok: true };
});

export const deleteAdminUser = onCall(async (request) => {
  const actor = await requireAdminOrLocalRoot(request);

  const data = request.data as { uid?: string };
  if (!data.uid?.trim()) {
    throw new HttpsError('invalid-argument', 'UID do usuário é obrigatório.');
  }

  if (data.uid === 'local-root-admin') {
    throw new HttpsError('failed-precondition', 'Usuário root local não pode ser excluído.');
  }

  if (!actor.isLocalRoot && data.uid === actor.uid) {
    throw new HttpsError('failed-precondition', 'Você não pode excluir a própria conta.');
  }

  const targetRef = db.collection('users').doc(data.uid.trim());
  const targetSnapshot = await targetRef.get();
  const targetRole = normalizeAdminRole(targetSnapshot.data()?.role);

  if (!targetRole) {
    throw new HttpsError('failed-precondition', 'Usuário alvo não possui perfil administrativo válido.');
  }

  if (targetRole === 'admin') {
    const activeAdminSnapshot = await db.collection('users').where('role', 'in', ['ADMIN', 'admin']).get();
    const remainingActiveAdmins = activeAdminSnapshot.docs.filter((docItem) => {
      if (docItem.id === data.uid) return false;
      return normalizeCanonicalStatus(docItem.data()?.status) === 'ACTIVE';
    });
    if (remainingActiveAdmins.length === 0) {
      throw new HttpsError('failed-precondition', 'Não é permitido remover o último admin ativo.');
    }
  }

  const auth = getAuth();
  await auth.deleteUser(data.uid.trim());
  await targetRef.set({
    deleted: true,
    deletedAt: FieldValue.serverTimestamp(),
    status: 'INACTIVE',
    isActive: false,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return { ok: true };
});

export const verifyLocalRootSession = onCall(async (request) => {
  const cfg = getLocalRootConfig();
  const token = (request.data as { token?: string }).token;
  if (!cfg.enabled || !cfg.sessionSecret || !token) {
    return { valid: false };
  }

  const payload = verifyLocalRootToken(token, cfg.sessionSecret);
  if (!payload || payload.username !== cfg.username) {
    return { valid: false };
  }

  return { valid: true, user: buildLocalRootUser() };
});


export const bootstrapRootAdmin = onCall(async () => {
  const username = process.env.ROOT_ADMIN_USERNAME?.trim() ?? '';
  const email = process.env.ROOT_ADMIN_EMAIL?.trim().toLowerCase() ?? '';
  const passwordHash = process.env.ROOT_ADMIN_PASSWORD_HASH?.trim() ?? '';

  const missing: string[] = [];
  if (!username) missing.push('ROOT_ADMIN_USERNAME');
  if (!email) missing.push('ROOT_ADMIN_EMAIL');
  if (!passwordHash) missing.push('ROOT_ADMIN_PASSWORD_HASH');

  if (missing.length > 0) {
    throw new HttpsError(
      'failed-precondition',
      `Configuração ausente para bootstrap root admin: ${missing.join(', ')}`
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError('failed-precondition', 'ROOT_ADMIN_EMAIL inválido.');
  }
  assertPasswordHashFormat(passwordHash, 'ROOT_ADMIN_PASSWORD_HASH');

  const existingRootSnapshot = await db.collection('users')
    .where('role', '==', 'ROOT')
    .where('authSource', '==', 'LOCAL')
    .where('isProtected', '==', true)
    .limit(1)
    .get();

  const existingRoot = existingRootSnapshot.docs[0];
  if (existingRoot) {
    const existingData = existingRoot.data() as Record<string, unknown>;
    await existingRoot.ref.set({
      name: username,
      email,
      passwordHash,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    const canonicalUser = toCanonicalUserFromDoc(existingRoot.id, {
      ...existingData,
      name: username,
      email,
      passwordHash
    });
    return {
      ok: true,
      created: false,
      user: canonicalUser
    };
  }

  const rootRef = db.collection('users').doc();
  await rootRef.set({
    id: rootRef.id,
    name: username,
    email,
    authSource: 'LOCAL',
    role: 'ROOT',
    status: 'ACTIVE',
    isActive: true,
    isProtected: true,
    provider: 'local',
    passwordHash,
    firebaseUid: null,
    lastLoginAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return {
    ok: true,
    created: true,
    user: {
      id: rootRef.id,
      name: username,
      email,
      role: 'ROOT' as const,
      authSource: 'LOCAL' as const,
      status: 'ACTIVE' as const,
      isActive: true,
      isProtected: true,
      provider: 'local',
      firebaseUid: undefined,
      passwordHash: undefined
    }
  };
});

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
    { uid: 'admin-radio', email: 'admin@irmaoaureo.dev', password: 'Admin@123456', role: 'ADMIN' as const, name: 'Administrador Rádio Irmão Áureo' },
    { uid: 'operador-radio', email: 'operador@irmaoaureo.dev', password: 'Operador@123456', role: 'OPERADOR' as const, name: 'Operador Rádio Irmão Áureo' }
  ];

  for (const user of users) {
    try {
      await auth.getUser(user.uid);
    } catch {
      await auth.createUser({ uid: user.uid, email: user.email, password: user.password, displayName: user.name });
    }

    await db.collection('users').doc(user.uid).set({
      id: user.uid,
      name: user.name,
      email: user.email,
      authSource: 'LOCAL',
      role: user.role,
      status: 'ACTIVE',
      institution: 'Irmão Áureo',
      isActive: true,
      isProtected: false,
      firebaseUid: user.uid,
      passwordHash: null,
      provider: 'password',
      lastLoginAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }

  return { ok: true };
});
