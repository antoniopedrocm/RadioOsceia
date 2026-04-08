import type { CanonicalUser, UserRole as CanonicalUserRole, UserStatus as CanonicalUserStatus } from '@/types/user';

export type AdminUserAuthSource = 'firebase' | 'local-root';
export type AdminUserRole = 'admin' | 'operador' | 'root';
export type UserProfile = Exclude<AdminUserRole, 'root'>;
export type AdminUserStatus = 'ativo' | 'inativo';
export type UserStatus = AdminUserStatus;

export interface AdminUserRecord {
  id: string;
  uid: string;
  nome: string;
  email: string;
  perfil: AdminUserRole;
  status: AdminUserStatus;
  dataCriacao: string;
  ultimoAcesso: string;
  provider: string | null;
  authSource: AdminUserAuthSource;
  isProtected: boolean;
  isLocalRoot: boolean;
  institution?: string | null;
}

export function toLegacyAdminUserRole(role: CanonicalUserRole): AdminUserRole {
  if (role === 'ROOT') return 'root';
  if (role === 'ADMIN') return 'admin';
  return 'operador';
}

export function toLegacyAdminUserStatus(status: CanonicalUserStatus): AdminUserStatus {
  return status === 'INACTIVE' ? 'inativo' : 'ativo';
}

export function fromCanonicalUser(user: CanonicalUser): AdminUserRecord {
  const uid = user.firebaseUid ?? user.id;
  return {
    id: user.id,
    uid,
    nome: user.name,
    email: user.email,
    perfil: toLegacyAdminUserRole(user.role),
    status: toLegacyAdminUserStatus(user.status),
    dataCriacao: user.createdAt ?? '',
    ultimoAcesso: user.lastLoginAt ?? '',
    provider: user.provider ?? null,
    authSource: user.authSource === 'GOOGLE' ? 'firebase' : user.provider === 'local-root' ? 'local-root' : 'firebase',
    isProtected: user.isProtected,
    isLocalRoot: user.role === 'ROOT',
    institution: null
  };
}

export interface UserFormValues {
  nome: string;
  email: string;
  senha: string;
  perfil: UserProfile;
  status: UserStatus;
}

export interface CreateAdminUserPayload {
  nome: string;
  email: string;
  senha: string;
  perfil: UserProfile;
  status: UserStatus;
}

export interface UpdateAdminUserPayload {
  uid: string;
  nome: string;
  perfil: UserProfile;
  status: UserStatus;
  senha?: string;
}

export interface SetAdminUserStatusPayload {
  uid: string;
  status: UserStatus;
}

export interface DeleteAdminUserPayload {
  uid: string;
}

export interface LoginLocalRootPayload {
  username: string;
  password: string;
}

export interface LocalRootSession {
  token: string;
  expiresAt: string;
  user: AdminUserRecord;
}

// Backward-compatible aliases.
export type AdminUser = AdminUserRecord;
