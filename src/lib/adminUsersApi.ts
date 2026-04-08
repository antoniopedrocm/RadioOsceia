import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { getLocalRootSession } from '@/lib/localRootSession';
import type { AdminUser, LocalRootSession, UserStatus } from '@/types/user';

interface ListAdminUsersData {
  users: AdminUser[];
}

interface CreateAdminUserPayload {
  nome: string;
  email: string;
  senha: string;
  perfil: 'admin' | 'operador';
  status: UserStatus;
}

interface UpdateAdminUserPayload {
  uid: string;
  nome: string;
  perfil: 'admin' | 'operador';
  status: UserStatus;
  senha?: string;
}

interface DeleteAdminUserPayload {
  uid: string;
}

interface SetAdminUserStatusPayload {
  uid: string;
  status: UserStatus;
}

interface LoginLocalRootPayload {
  username: string;
  password: string;
}

interface VerifyLocalRootSessionPayload {
  token: string;
}

function getCallableErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return String((error as { message: string }).message);
  }

  return fallback;
}

function assertFunctionsAvailable() {
  if (!functions) {
    throw new Error('Firebase Functions não está disponível neste ambiente.');
  }
}

function withLocalRootAuth<T extends object>(payload?: T): Record<string, unknown> {
  const session = getLocalRootSession();
  return {
    ...((payload ?? {}) as Record<string, unknown>),
    localRootToken: session?.token ?? null
  };
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  assertFunctionsAvailable();
  const callable = httpsCallable<Record<string, unknown>, ListAdminUsersData>(functions, 'listAdminUsers');

  try {
    const response = await callable(withLocalRootAuth());
    return response.data.users;
  } catch (error) {
    throw new Error(getCallableErrorMessage(error, 'Não foi possível carregar usuários administrativos.'));
  }
}

export async function createAdminUser(payload: CreateAdminUserPayload): Promise<AdminUser> {
  assertFunctionsAvailable();
  const callable = httpsCallable<Record<string, unknown>, { ok: true; user: AdminUser }>(functions, 'createAdminUser');

  try {
    const response = await callable(withLocalRootAuth(payload));
    return response.data.user;
  } catch (error) {
    throw new Error(getCallableErrorMessage(error, 'Não foi possível criar usuário administrativo.'));
  }
}

export async function updateAdminUser(payload: UpdateAdminUserPayload): Promise<AdminUser> {
  assertFunctionsAvailable();
  const callable = httpsCallable<Record<string, unknown>, { ok: true; user: AdminUser }>(functions, 'updateAdminUser');

  try {
    const response = await callable(withLocalRootAuth(payload));
    return response.data.user;
  } catch (error) {
    throw new Error(getCallableErrorMessage(error, 'Não foi possível atualizar usuário administrativo.'));
  }
}

export async function deleteAdminUser(payload: DeleteAdminUserPayload): Promise<void> {
  assertFunctionsAvailable();
  const callable = httpsCallable<Record<string, unknown>, { ok: true }>(functions, 'deleteAdminUser');

  try {
    await callable(withLocalRootAuth(payload));
  } catch (error) {
    throw new Error(getCallableErrorMessage(error, 'Não foi possível excluir usuário administrativo.'));
  }
}

export async function setAdminUserStatus(payload: SetAdminUserStatusPayload): Promise<void> {
  assertFunctionsAvailable();
  const callable = httpsCallable<Record<string, unknown>, { ok: true }>(functions, 'setAdminUserStatus');

  try {
    await callable(withLocalRootAuth(payload));
  } catch (error) {
    throw new Error(getCallableErrorMessage(error, 'Não foi possível alterar status do usuário.'));
  }
}

export async function loginLocalRoot(payload: LoginLocalRootPayload): Promise<LocalRootSession> {
  assertFunctionsAvailable();
  const callable = httpsCallable<LoginLocalRootPayload, { ok: true; session: LocalRootSession }>(functions, 'loginLocalRoot');

  try {
    const response = await callable(payload);
    return response.data.session;
  } catch (error) {
    throw new Error(getCallableErrorMessage(error, 'Não foi possível autenticar o root local.'));
  }
}

export async function verifyLocalRootSession(token: string): Promise<boolean> {
  assertFunctionsAvailable();
  const callable = httpsCallable<VerifyLocalRootSessionPayload, { valid: boolean }>(functions, 'verifyLocalRootSession');

  try {
    const response = await callable({ token });
    return response.data.valid === true;
  } catch {
    return false;
  }
}
