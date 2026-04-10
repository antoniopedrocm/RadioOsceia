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

  return {
    ok: true as const,
    session: {
      token: randomUUID(),
      expiresAt,
      user: mapped
    }
  };
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
