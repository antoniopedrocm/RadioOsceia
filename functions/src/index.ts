import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import bcrypt from 'bcryptjs';
import * as crypto from 'node:crypto';
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
type AdminRole = 'admin' | 'operador';
type AdminStatus = 'ativo' | 'inativo';

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

async function requireAdmin(uid: string) {
  const userDoc = await db.collection('users').doc(uid).get();
  const role = String(userDoc.data()?.role ?? '');
  if (role !== 'admin') {
    throw new HttpsError('permission-denied', 'Somente administradores podem gerenciar usuários.');
  }
}

function normalizeAdminRole(role: unknown): AdminRole | null {
  return role === 'admin' || role === 'operador' ? role : null;
}

function normalizeAdminStatus(status: unknown): AdminStatus {
  return status === 'inativo' ? 'inativo' : 'ativo';
}

function getUserProviderLabel(providerData: Array<{ providerId?: string }>) {
  if (!providerData.length) return 'password';
  if (providerData.some((provider) => provider.providerId === 'google.com')) return 'google';
  if (providerData.some((provider) => provider.providerId === 'password')) return 'password';
  return providerData[0]?.providerId ?? 'desconhecido';
}

function toAdminUserViewModel(params: {
  uid: string;
  email: string;
  displayName: string;
  role: AdminRole;
  status: AdminStatus;
  disabled: boolean;
  provider: string;
  creationTime?: string | null;
  lastSignInTime?: string | null;
  institution?: string | null;
}) {
  return {
    id: params.uid,
    uid: params.uid,
    nome: params.displayName,
    email: params.email,
    perfil: params.role,
    status: params.status,
    dataCriacao: params.creationTime ?? '',
    ultimoAcesso: params.lastSignInTime ?? '',
    provider: params.provider,
    authSource: 'firebase',
    institution: params.institution ?? null,
    disabled: params.disabled
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



type LocalRootSessionPayload = {
  sub: 'local-root-admin';
  role: 'root';
  authSource: 'local-root';
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

function toBase64Url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url');
}

function signLocalRootToken(payload: LocalRootSessionPayload, secret: string) {
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
    if (payload.role !== 'root') return null;
    if (payload.authSource !== 'local-root') return null;
    if (typeof payload.username !== 'string' || !payload.username.trim()) return null;
    if (typeof payload.exp !== 'number') return null;
    if (payload.exp * 1000 <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

async function verifyLocalRootPassword(password: string, passwordHash: string) {
  if (!passwordHash) return false;
  return bcrypt.compare(password, passwordHash);
}

function buildLocalRootUser() {
  const cfg = getLocalRootConfig();
  return {
    id: 'local-root-admin',
    uid: 'local-root-admin',
    nome: cfg.username,
    email: 'local-root@radioosceia.local',
    perfil: 'root',
    status: 'ativo',
    dataCriacao: '',
    ultimoAcesso: '',
    provider: 'local-root',
    authSource: 'local-root',
    isProtected: true,
    isLocalRoot: true,
    institution: null
  };
}

async function isFirebaseAdmin(uid: string) {
  const userDoc = await db.collection('users').doc(uid).get();
  return String(userDoc.data()?.role ?? '') === 'admin';
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
    .where('role', '==', 'admin')
    .where('status', '==', 'ativo')
    .get();

  if (activeAdminSnapshot.docs.filter((docItem) => docItem.id !== params.targetUid).length === 0) {
    throw new HttpsError('failed-precondition', 'Não é permitido remover/desativar o último admin ativo.');
  }
}

async function requireAdminOrOperatorOrLocalRoot(request: { auth?: { uid?: string } | null; data?: Record<string, unknown> }) {
  const uid = request.auth?.uid;
  if (uid) {
    const userDoc = await db.collection('users').doc(uid).get();
    const role = String(userDoc.data()?.role ?? '');
    if (role === 'admin' || role === 'operador') {
      return { uid, role, isLocalRoot: false };
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
    role: 'root',
    authSource: 'local-root',
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

export const listAdminUsers = onCall(async (request) => {
  await requireAdminOrOperatorOrLocalRoot(request);

  const auth = getAuth();
  const adminProfilesSnapshot = await db.collection('users').where('role', 'in', ['admin', 'operador']).get();
  const profileByUid = new Map<string, Record<string, unknown>>(adminProfilesSnapshot.docs.map((docItem) => [docItem.id, docItem.data() as Record<string, unknown>]));

  let nextPageToken: string | undefined = undefined;
  const users: Array<Record<string, unknown>> = [];

  do {
    const result = await auth.listUsers(1000, nextPageToken);
    result.users.forEach((authUser) => {
      const profile = profileByUid.get(authUser.uid);
      const role = normalizeAdminRole(profile?.role);
      if (!role) return;

      const status = normalizeAdminStatus(profile?.status ?? (authUser.disabled ? 'inativo' : 'ativo'));
      const viewModel = toAdminUserViewModel({
        uid: authUser.uid,
        email: authUser.email ?? String(profile?.email ?? ''),
        displayName: authUser.displayName ?? String(profile?.name ?? authUser.email?.split('@')[0] ?? 'Usuário'),
        role,
        status,
        disabled: authUser.disabled,
        provider: getUserProviderLabel(authUser.providerData),
        creationTime: authUser.metadata.creationTime ?? null,
        lastSignInTime: authUser.metadata.lastSignInTime ?? null,
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
    role,
    status,
    institution: data.institution ?? 'Irmão Áureo',
    isActive: status === 'ativo',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return {
    ok: true,
    user: { ...toAdminUserViewModel({
      uid: createdUser.uid,
      email: createdUser.email ?? data.email.trim().toLowerCase(),
      displayName: createdUser.displayName ?? data.nome.trim(),
      role,
      status,
      disabled: createdUser.disabled,
      provider: 'password',
      creationTime: createdUser.metadata.creationTime ?? null,
      lastSignInTime: createdUser.metadata.lastSignInTime ?? null,
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
    role,
    status,
    isActive: status === 'ativo',
    institution: data.institution ?? 'Irmão Áureo',
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  const updated = await auth.getUser(targetUid);
  return {
    ok: true,
    user: { ...toAdminUserViewModel({
      uid: updated.uid,
      email: updated.email ?? '',
      displayName: updated.displayName ?? data.nome.trim(),
      role,
      status,
      disabled: updated.disabled,
      provider: getUserProviderLabel(updated.providerData),
      creationTime: updated.metadata.creationTime ?? null,
      lastSignInTime: updated.metadata.lastSignInTime ?? null,
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
  await targetRef.set({ status, isActive: status === 'ativo', updatedAt: FieldValue.serverTimestamp() }, { merge: true });

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
    const activeAdminSnapshot = await db.collection('users').where('role', '==', 'admin').where('status', '==', 'ativo').get();
    if (activeAdminSnapshot.docs.filter((docItem) => docItem.id !== data.uid).length === 0) {
      throw new HttpsError('failed-precondition', 'Não é permitido remover o último admin ativo.');
    }
  }

  const auth = getAuth();
  await auth.deleteUser(data.uid.trim());
  await targetRef.set({
    deleted: true,
    deletedAt: FieldValue.serverTimestamp(),
    status: 'inativo',
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
