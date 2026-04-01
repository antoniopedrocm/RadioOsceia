export type UserProfile = 'admin' | 'operador';

export type UserStatus = 'ativo' | 'inativo';
export type AdminUserAuthSource = 'firebase' | 'local-breakglass';

export interface AdminUser {
  id: string;
  uid: string;
  nome: string;
  email: string;
  perfil: UserProfile;
  status: UserStatus;
  dataCriacao: string;
  ultimoAcesso: string;
  provider: string;
  authSource: AdminUserAuthSource;
  institution?: string | null;
  isBreakGlass?: boolean;
  disabled?: boolean;
}

export interface UserFormValues {
  nome: string;
  email: string;
  senha: string;
  perfil: UserProfile;
  status: UserStatus;
}
