import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import type { AdminUser, UserStatus } from '@/types/user';

interface CallableResponse<T> {
  ok: boolean;
  data: T;
}

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

interface ToggleAdminUserStatusPayload {
  uid: string;
  status: UserStatus;
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

export async function listAdminUsers(): Promise<AdminUser[]> {
  assertFunctionsAvailable();
  const callable = httpsCallable<undefined, CallableResponse<ListAdminUsersData>>(functions, 'listAdminUsers');

  try {
    const response = await callable();
    return response.data.data.users;
  } catch (error) {
    throw new Error(getCallableErrorMessage(error, 'Não foi possível carregar usuários administrativos.'));
  }
}

export async function createAdminUser(payload: CreateAdminUserPayload): Promise<AdminUser> {
  assertFunctionsAvailable();
  const callable = httpsCallable<CreateAdminUserPayload, CallableResponse<{ user: AdminUser }>>(functions, 'createAdminUser');

  try {
    const response = await callable(payload);
    return response.data.data.user;
  } catch (error) {
    throw new Error(getCallableErrorMessage(error, 'Não foi possível criar usuário administrativo.'));
  }
}

export async function updateAdminUser(payload: UpdateAdminUserPayload): Promise<AdminUser> {
  assertFunctionsAvailable();
  const callable = httpsCallable<UpdateAdminUserPayload, CallableResponse<{ user: AdminUser }>>(functions, 'updateAdminUser');

  try {
    const response = await callable(payload);
    return response.data.data.user;
  } catch (error) {
    throw new Error(getCallableErrorMessage(error, 'Não foi possível atualizar usuário administrativo.'));
  }
}

export async function deleteAdminUser(payload: DeleteAdminUserPayload): Promise<void> {
  assertFunctionsAvailable();
  const callable = httpsCallable<DeleteAdminUserPayload, CallableResponse<{ deletedUid: string }>>(functions, 'deleteAdminUser');

  try {
    await callable(payload);
  } catch (error) {
    throw new Error(getCallableErrorMessage(error, 'Não foi possível excluir usuário administrativo.'));
  }
}

export async function toggleAdminUserStatus(payload: ToggleAdminUserStatusPayload): Promise<AdminUser> {
  assertFunctionsAvailable();
  const callable = httpsCallable<ToggleAdminUserStatusPayload, CallableResponse<{ user: AdminUser }>>(functions, 'toggleAdminUserStatus');

  try {
    const response = await callable(payload);
    return response.data.data.user;
  } catch (error) {
    throw new Error(getCallableErrorMessage(error, 'Não foi possível alterar status do usuário.'));
  }
}
