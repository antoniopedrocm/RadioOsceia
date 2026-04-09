import {
  api,
  getApiErrorMessage,
  type CreateAppUserPayload,
  type UpdateAppUserPayload
} from '@/lib/api';
import type {
  AdminUserRecord,
  CreateAdminUserPayload,
  DeleteAdminUserPayload,
  LocalRootSession,
  LoginLocalRootPayload,
  SetAdminUserStatusPayload,
  UpdateAdminUserPayload
} from '@/types/admin-user';
import { fromCanonicalUser, toLegacyAdminUserRole, toLegacyAdminUserStatus } from '@/types/admin-user';

function normalizeAdminUsersError(error: unknown, fallback: string): Error {
  return new Error(getApiErrorMessage(error, fallback));
}

function toCanonicalCreatePayload(payload: CreateAdminUserPayload): CreateAppUserPayload {
  return {
    name: payload.nome,
    email: payload.email,
    password: payload.senha,
    role: payload.perfil === 'admin' ? 'ADMIN' : 'OPERADOR',
    status: payload.status === 'inativo' ? 'INACTIVE' : 'ACTIVE',
    authSource: 'LOCAL'
  };
}

function toCanonicalUpdatePayload(payload: UpdateAdminUserPayload): UpdateAppUserPayload {
  return {
    uid: payload.uid,
    name: payload.nome,
    role: payload.perfil === 'admin' ? 'ADMIN' : 'OPERADOR',
    status: payload.status === 'inativo' ? 'INACTIVE' : 'ACTIVE'
  };
}

export async function listAdminUsers(): Promise<AdminUserRecord[]> {
  try {
    const response = await api.listAppUsers();
    return response.users.map(fromCanonicalUser);
  } catch (error) {
    throw normalizeAdminUsersError(error, 'Não foi possível carregar usuários administrativos.');
  }
}

export async function createAdminUser(payload: CreateAdminUserPayload): Promise<AdminUserRecord> {
  try {
    const response = await api.createAppUser(toCanonicalCreatePayload(payload));
    return fromCanonicalUser(response.user);
  } catch (error) {
    throw normalizeAdminUsersError(error, 'Não foi possível criar usuário administrativo.');
  }
}

export async function updateAdminUser(payload: UpdateAdminUserPayload): Promise<AdminUserRecord> {
  try {
    const response = await api.updateAppUser(toCanonicalUpdatePayload(payload));
    if (payload.senha?.trim()) {
      await api.setAppUserPassword({ uid: payload.uid, password: payload.senha.trim() });
      const refreshed = await api.listAppUsers();
      const refreshedUser = refreshed.users.find((user) => user.id === payload.uid || user.firebaseUid === payload.uid);
      return refreshedUser ? fromCanonicalUser(refreshedUser) : fromCanonicalUser(response.user);
    }

    return fromCanonicalUser(response.user);
  } catch (error) {
    throw normalizeAdminUsersError(error, 'Não foi possível atualizar usuário administrativo.');
  }
}

export async function deleteAdminUser(payload: DeleteAdminUserPayload): Promise<void> {
  try {
    await api.deleteAppUser(payload);
  } catch (error) {
    throw normalizeAdminUsersError(error, 'Não foi possível excluir usuário administrativo.');
  }
}

export async function setAdminUserStatus(payload: SetAdminUserStatusPayload): Promise<void> {
  try {
    await api.updateAppUser({
      uid: payload.uid,
      status: payload.status === 'inativo' ? 'INACTIVE' : 'ACTIVE'
    });
  } catch (error) {
    throw normalizeAdminUsersError(error, 'Não foi possível alterar status do usuário.');
  }
}

export async function loginLocalRoot(payload: LoginLocalRootPayload): Promise<LocalRootSession> {
  try {
    const response = await api.loginLocalUser({ emailOrUsername: payload.username, password: payload.password });
    const user = fromCanonicalUser(response.session.user);
    user.perfil = toLegacyAdminUserRole(response.session.user.role);
    user.status = toLegacyAdminUserStatus(response.session.user.status);
    user.isLocalRoot = response.session.user.role === 'ROOT';
    return {
      token: response.session.token,
      expiresAt: response.session.expiresAt,
      user
    };
  } catch (error) {
    throw normalizeAdminUsersError(error, 'Não foi possível autenticar o usuário local.');
  }
}

export async function verifyLocalRootSession(token: string): Promise<boolean> {
  try {
    const response = await api.verifyLocalSession({ token });
    return response.valid === true;
  } catch (error) {
    void error;
    return false;
  }
}
