import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { FieldValue, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { db } from './lib/firebaseAdmin';
import type { CanonicalUser, UserAuthSource, UserRole, UserStatus } from './types/canonical-user';

interface LoginLocalUserPayload {
  emailOrUsername?: unknown;
  password?: unknown;
}

interface LinkGoogleUserOnFirstLoginPayload {
  firebaseUid?: unknown;
  email?: unknown;
  name?: unknown;
  provider?: unknown;
}

interface VerifyLocalSessionPayload {
  token?: unknown;
}

interface LocalRootAuthorizedPayload {
  localRootToken?: unknown;
}

interface CreateAppUserPayload extends LocalRootAuthorizedPayload {
  name?: unknown;
  email?: unknown;
  role?: unknown;
  status?: unknown;
  authSource?: unknown;
  institution?: unknown;
  password?: unknown;
}

interface UpdateAppUserPayload extends LocalRootAuthorizedPayload {
  uid?: unknown;
  name?: unknown;
  role?: unknown;
  status?: unknown;
  institution?: unknown;
}

interface SetAppUserPasswordPayload extends LocalRootAuthorizedPayload {
  uid?: unknown;
  password?: unknown;
}

interface DeleteAppUserPayload extends LocalRootAuthorizedPayload {
  uid?: unknown;
}

function normalizeUserRole(value: unknown): UserRole {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'ROOT' || normalized === 'ADMIN' || normalized === 'OPERADOR') {
    return normalized;
  }

  if (normalized === 'ADMINISTRADOR') return 'ADMIN';
  if (normalized === 'OPERATOR') return 'OPERADOR';
  return 'OPERADOR';
}

function normalizeUserStatus(value: unknown): UserStatus {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'INACTIVE' || normalized === 'INATIVO') return 'INACTIVE';
  return 'ACTIVE';
}

function normalizeAuthSource(value: unknown): UserAuthSource {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'LOCAL' || normalized === 'GOOGLE') {
    return normalized;
  }

  return 'LOCAL';
}

function mapCanonicalUser(snapshot: QueryDocumentSnapshot): CanonicalUser {
  const data = snapshot.data();
  const role = normalizeUserRole(data.role);
  const status = normalizeUserStatus(data.status);
  const authSource = normalizeAuthSource(data.authSource);
  const provider = typeof data.provider === 'string' ? data.provider : authSource === 'GOOGLE' ? 'google' : 'local-root';

  return {
    id: snapshot.id,
    email: String(data.email ?? ''),
    name: String(data.name ?? data.nome ?? data.email ?? 'Usuário sem nome'),
    authSource,
    role,
    status,
    isActive: status === 'ACTIVE',
    isProtected: Boolean(data.isProtected ?? role === 'ROOT'),
    firebaseUid: typeof data.firebaseUid === 'string' ? data.firebaseUid : undefined,
    passwordHash: typeof data.passwordHash === 'string' ? data.passwordHash : undefined,
    provider,
    lastLoginAt: data.lastLoginAt?.toDate instanceof Function ? data.lastLoginAt.toDate().toISOString() : undefined,
    createdAt: data.createdAt?.toDate instanceof Function ? data.createdAt.toDate().toISOString() : undefined,
    updatedAt: data.updatedAt?.toDate instanceof Function ? data.updatedAt.toDate().toISOString() : undefined
  };
}

async function requireLocalRootToken(token: unknown) {
  const normalizedToken = String(token ?? '').trim();
  if (!normalizedToken) {
    throw new HttpsError('unauthenticated', 'Sessão local inválida.');
  }

  const sessionSnapshot = await db.collection('localSessions').doc(normalizedToken).get();
  if (!sessionSnapshot.exists) {
    throw new HttpsError('unauthenticated', 'Sessão local expirada.');
  }

  const sessionData = sessionSnapshot.data() ?? {};
  const expiresAtMs = Date.parse(String(sessionData.expiresAt ?? ''));
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    throw new HttpsError('unauthenticated', 'Sessão local expirada.');
  }

  const userId = String(sessionData.userId ?? '').trim();
  if (!userId) {
    throw new HttpsError('permission-denied', 'Sessão local sem usuário vinculado.');
  }

  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    throw new HttpsError('permission-denied', 'Usuário da sessão não encontrado.');
  }

  const userData = userDoc.data() ?? {};
  const role = normalizeUserRole(userData.role);
  const status = normalizeUserStatus(userData.status);

  if (status !== 'ACTIVE' || (role !== 'ROOT' && role !== 'ADMIN')) {
    throw new HttpsError('permission-denied', 'Permissão insuficiente.');
  }

  return { userId, role, expiresAt: String(sessionData.expiresAt) };
}

async function findLocalUserByEmailOrUsername(value: string) {
  const users = db.collection('users');

  if (value.includes('@')) {
    const byEmail = await users.where('email', '==', value).limit(1).get();
    if (!byEmail.empty) return byEmail.docs[0];

    const byLowerEmail = await users.where('email', '==', value.toLowerCase()).limit(1).get();
    if (!byLowerEmail.empty) return byLowerEmail.docs[0];
  }

  const byUsername = await users.where('username', '==', value).limit(1).get();
  if (!byUsername.empty) return byUsername.docs[0];

  const byName = await users.where('nome', '==', value).limit(1).get();
  if (!byName.empty) return byName.docs[0];

  return null;
}

export const loginLocalUser = onCall(async (request: CallableRequest<LoginLocalUserPayload>) => {
  const emailOrUsername = String(request.data?.emailOrUsername ?? '').trim();
  const password = String(request.data?.password ?? '');

  if (!emailOrUsername || !password) {
    throw new HttpsError('invalid-argument', 'Informe e-mail/usuário e senha.');
  }

  const userDoc = await findLocalUserByEmailOrUsername(emailOrUsername);
  if (!userDoc) {
    throw new HttpsError('not-found', 'Usuário não encontrado.');
  }

  const userData = userDoc.data();
  const passwordHash = typeof userData.passwordHash === 'string' ? userData.passwordHash : '';
  if (!passwordHash || !bcrypt.compareSync(password, passwordHash)) {
    throw new HttpsError('unauthenticated', 'Credenciais inválidas.');
  }

  const status = normalizeUserStatus(userData.status);
  if (status !== 'ACTIVE') {
    throw new HttpsError('failed-precondition', 'Conta inativa.');
  }

  const authSource = normalizeAuthSource(userData.authSource);
  if (authSource !== 'LOCAL') {
    throw new HttpsError('permission-denied', 'Esta conta não aceita autenticação local.');
  }

  await userDoc.ref.update({
    lastLoginAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  const reloaded = await userDoc.ref.get();
  if (!reloaded.exists) {
    throw new HttpsError('not-found', 'Usuário não encontrado após atualização.');
  }

  const mapped = mapCanonicalUser(reloaded as QueryDocumentSnapshot);
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  const token = randomUUID();

  await db.collection('localSessions').doc(token).set({
    userId: mapped.id,
    token,
    role: mapped.role,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    expiresAt
  });

  return {
    ok: true as const,
    session: {
      token,
      expiresAt,
      user: mapped
    }
  };
});

export const verifyLocalSession = onCall(async (request: CallableRequest<VerifyLocalSessionPayload>) => {
  const token = String(request.data?.token ?? '').trim();
  if (!token) {
    return { valid: false };
  }

  const sessionSnapshot = await db.collection('localSessions').doc(token).get();
  if (!sessionSnapshot.exists) {
    return { valid: false };
  }

  const data = sessionSnapshot.data() ?? {};
  const expiresAt = String(data.expiresAt ?? '');
  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return { valid: false };
  }

  const userId = String(data.userId ?? '').trim();
  if (!userId) {
    return { valid: false };
  }

  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    return { valid: false };
  }

  return {
    valid: true,
    expiresAt,
    user: mapCanonicalUser(userDoc as QueryDocumentSnapshot)
  };
});

export const bootstrapRootAdmin = onCall(async () => {
  const users = db.collection('users');
  const existingRoot = await users.where('role', '==', 'ROOT').limit(1).get();
  if (!existingRoot.empty) {
    return { ok: true as const, created: false, user: mapCanonicalUser(existingRoot.docs[0]) };
  }

  const userId = randomUUID();
  const email = 'root@radioosceia.local';
  const now = FieldValue.serverTimestamp();
  await users.doc(userId).set({
    id: userId,
    email,
    username: 'root',
    name: 'Root Admin',
    role: 'ROOT',
    status: 'ACTIVE',
    authSource: 'LOCAL',
    provider: 'local-root',
    isProtected: true,
    passwordHash: bcrypt.hashSync('12345678', 10),
    createdAt: now,
    updatedAt: now
  });

  const created = await users.doc(userId).get();
  return { ok: true as const, created: true, user: mapCanonicalUser(created as QueryDocumentSnapshot) };
});

export const listAppUsers = onCall(async (request: CallableRequest<LocalRootAuthorizedPayload>) => {
  await requireLocalRootToken(request.data?.localRootToken);
  const usersSnapshot = await db.collection('users').orderBy('name', 'asc').get();
  return {
    users: usersSnapshot.docs.map((doc) => mapCanonicalUser(doc))
  };
});

export const createAppUser = onCall(async (request: CallableRequest<CreateAppUserPayload>) => {
  await requireLocalRootToken(request.data?.localRootToken);

  const name = String(request.data?.name ?? '').trim();
  const email = String(request.data?.email ?? '').trim().toLowerCase();
  const role = normalizeUserRole(request.data?.role);
  const status = normalizeUserStatus(request.data?.status);
  const authSource = normalizeAuthSource(request.data?.authSource);
  const institution = String(request.data?.institution ?? '').trim();
  const password = String(request.data?.password ?? '');

  if (!name || !email) {
    throw new HttpsError('invalid-argument', 'Nome e e-mail são obrigatórios.');
  }

  const users = db.collection('users');
  const duplicated = await users.where('email', '==', email).limit(1).get();
  if (!duplicated.empty) {
    throw new HttpsError('already-exists', 'Já existe usuário com este e-mail.');
  }

  const uid = randomUUID();
  const now = FieldValue.serverTimestamp();
  await users.doc(uid).set({
    id: uid,
    name,
    email,
    role,
    status,
    authSource,
    provider: authSource === 'GOOGLE' ? 'google' : 'local-root',
    institution: institution || null,
    isProtected: false,
    passwordHash: authSource === 'LOCAL' ? bcrypt.hashSync(password || '12345678', 10) : null,
    createdAt: now,
    updatedAt: now
  });

  const created = await users.doc(uid).get();
  return { ok: true as const, user: mapCanonicalUser(created as QueryDocumentSnapshot) };
});

export const updateAppUser = onCall(async (request: CallableRequest<UpdateAppUserPayload>) => {
  await requireLocalRootToken(request.data?.localRootToken);

  const uid = String(request.data?.uid ?? '').trim();
  if (!uid) {
    throw new HttpsError('invalid-argument', 'UID do usuário é obrigatório.');
  }

  const updates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp()
  };

  if (request.data?.name !== undefined) updates.name = String(request.data.name ?? '').trim();
  if (request.data?.role !== undefined) updates.role = normalizeUserRole(request.data.role);
  if (request.data?.status !== undefined) updates.status = normalizeUserStatus(request.data.status);
  if (request.data?.institution !== undefined) {
    const institution = String(request.data.institution ?? '').trim();
    updates.institution = institution || null;
  }

  const userRef = db.collection('users').doc(uid);
  const current = await userRef.get();
  if (!current.exists) {
    throw new HttpsError('not-found', 'Usuário não encontrado.');
  }

  await userRef.update(updates);
  const updated = await userRef.get();
  return { ok: true as const, user: mapCanonicalUser(updated as QueryDocumentSnapshot) };
});

export const setAppUserPassword = onCall(async (request: CallableRequest<SetAppUserPasswordPayload>) => {
  await requireLocalRootToken(request.data?.localRootToken);
  const uid = String(request.data?.uid ?? '').trim();
  const password = String(request.data?.password ?? '');

  if (!uid || password.length < 6) {
    throw new HttpsError('invalid-argument', 'Informe um UID e uma senha válida.');
  }

  const userRef = db.collection('users').doc(uid);
  const user = await userRef.get();
  if (!user.exists) {
    throw new HttpsError('not-found', 'Usuário não encontrado.');
  }

  await userRef.update({
    passwordHash: bcrypt.hashSync(password, 10),
    authSource: 'LOCAL',
    provider: 'local-root',
    updatedAt: FieldValue.serverTimestamp()
  });

  return { ok: true as const };
});

export const deleteAppUser = onCall(async (request: CallableRequest<DeleteAppUserPayload>) => {
  await requireLocalRootToken(request.data?.localRootToken);
  const uid = String(request.data?.uid ?? '').trim();
  if (!uid) {
    throw new HttpsError('invalid-argument', 'UID do usuário é obrigatório.');
  }

  const userRef = db.collection('users').doc(uid);
  const user = await userRef.get();
  if (!user.exists) {
    throw new HttpsError('not-found', 'Usuário não encontrado.');
  }

  const data = user.data() ?? {};
  if (Boolean(data.isProtected) || normalizeUserRole(data.role) === 'ROOT') {
    throw new HttpsError('permission-denied', 'Usuário protegido não pode ser removido.');
  }

  await userRef.delete();
  return { ok: true as const };
});

export const linkGoogleUserOnFirstLogin = onCall(async (request: CallableRequest<LinkGoogleUserOnFirstLoginPayload>) => {
  const firebaseUid = String(request.data?.firebaseUid ?? '').trim();
  const email = String(request.data?.email ?? '').trim().toLowerCase();
  const name = String(request.data?.name ?? '').trim();
  const provider = String(request.data?.provider ?? '').trim().toLowerCase();

  if (!firebaseUid || !email || !name || provider !== 'google') {
    throw new HttpsError('invalid-argument', 'Dados inválidos para vincular usuário Google.');
  }

  const users = db.collection('users');

  const byUid = await users.where('firebaseUid', '==', firebaseUid).limit(1).get();
  if (!byUid.empty) {
    const doc = byUid.docs[0];
    await doc.ref.update({
      name,
      email,
      authSource: 'GOOGLE',
      provider: 'google',
      lastLoginAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    const refreshed = await doc.ref.get();
    return {
      ok: true as const,
      linked: true,
      created: false,
      strategy: 'firebaseUid',
      user: mapCanonicalUser(refreshed as QueryDocumentSnapshot)
    };
  }

  const byEmail = await users.where('email', '==', email).limit(1).get();
  if (!byEmail.empty) {
    const doc = byEmail.docs[0];
    await doc.ref.update({
      firebaseUid,
      name,
      email,
      authSource: 'GOOGLE',
      provider: 'google',
      lastLoginAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    const refreshed = await doc.ref.get();
    return {
      ok: true as const,
      linked: true,
      created: false,
      strategy: 'email',
      user: mapCanonicalUser(refreshed as QueryDocumentSnapshot)
    };
  }

  const now = FieldValue.serverTimestamp();
  await users.doc(firebaseUid).set({
    id: firebaseUid,
    firebaseUid,
    email,
    name,
    role: 'OPERADOR',
    status: 'ACTIVE',
    authSource: 'GOOGLE',
    provider: 'google',
    isProtected: false,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now
  });

  const created = await users.doc(firebaseUid).get();
  return {
    ok: true as const,
    linked: false,
    created: true,
    strategy: 'create',
    user: mapCanonicalUser(created as QueryDocumentSnapshot)
  };
});
