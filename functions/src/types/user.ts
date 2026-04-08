export const USER_AUTH_SOURCES = ['LOCAL', 'GOOGLE'] as const;
export type UserAuthSource = (typeof USER_AUTH_SOURCES)[number];

export const USER_ROLES = ['ROOT', 'ADMIN', 'OPERADOR'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface CanonicalUser {
  id: string;
  email: string;
  name: string;
  authSource: UserAuthSource;
  role: UserRole;
  status: UserStatus;
  isActive: boolean;
  isProtected: boolean;
  firebaseUid?: string;
  provider?: string;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}
