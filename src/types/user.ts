export type UserProfile = 'admin' | 'operador';

export type UserStatus = 'ativo' | 'inativo';

export interface AdminUser {
  id: string;
  nome: string;
  email: string;
  perfil: UserProfile;
  status: UserStatus;
  dataCriacao: string;
  ultimoAcesso: string;
}

export interface UserFormValues {
  nome: string;
  email: string;
  senha: string;
  perfil: UserProfile;
  status: UserStatus;
}
