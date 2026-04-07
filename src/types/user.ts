export type AdminUserAuthSource = 'firebase' | 'local-root';
export type AdminUserRole = 'admin' | 'operador' | 'root';
export type UserProfile = Exclude<AdminUserRole, 'root'>;
export type AdminUserStatus = 'ativo' | 'inativo';
export type UserStatus = AdminUserStatus;

export interface AdminUser {
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

export interface UserFormValues {
  nome: string;
  email: string;
  senha: string;
  perfil: UserProfile;
  status: UserStatus;
}

export interface LocalRootSession {
  token: string;
  expiresAt: string;
  user: AdminUser;
}
