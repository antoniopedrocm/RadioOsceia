import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User as FirebaseUser
} from 'firebase/auth';
import type { Institution } from '@/types';
import type { AdminUserAuthSource, AdminUserRole, LoginLocalRootPayload } from '@/types/admin-user';
import { fromCanonicalUser, toLegacyAdminUserRole, toLegacyAdminUserStatus } from '@/types/admin-user';
import { auth, configureAuthPersistence } from '@/lib/firebase';
import { api } from '@/lib/api';
import {
  clearLocalRootSession,
  getLocalRootSession,
  isLocalRootSessionValid,
  setLocalRootSession
} from '@/lib/localRootSession';

type AdminRole = Exclude<AdminUserRole, 'root'>;
type SessionType = 'LOCAL' | 'GOOGLE' | null;
type CanonicalRole = 'ROOT' | 'ADMIN' | 'OPERADOR';
type CanonicalSource = 'LOCAL' | 'GOOGLE';

interface BaseAdminUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  institution: Institution;
}

interface FirebaseAdminUser extends BaseAdminUser {
  role: AdminRole;
  authSource: Extract<AdminUserAuthSource, 'firebase'>;
  isLocalRoot: false;
}

interface LocalRootAdminUser extends BaseAdminUser {
  role: 'root';
  authSource: Extract<AdminUserAuthSource, 'local-root'>;
  isLocalRoot: true;
}

interface LocalAdminUser extends BaseAdminUser {
  role: AdminRole;
  authSource: Extract<AdminUserAuthSource, 'local-root'>;
  isLocalRoot: false;
}

type AdminUser = FirebaseAdminUser | LocalRootAdminUser | LocalAdminUser;

interface AdminAuthContextValue {
  isAuthenticated: boolean;
  isFirebaseAuthenticated: boolean;
  isLoading: boolean;
  userEmail: string | null;
  user: AdminUser | null;
  authIssue: AdminAuthIssue | null;
  sessionType: SessionType;
  userRole: CanonicalRole | null;
  authSource: CanonicalSource | null;
  isLocalRoot: boolean;
  login: (email: string, password: string, keepConnected: boolean) => Promise<void>;
  loginLocalUser: (emailOrUsername: string, password: string) => Promise<void>;
  loginWithGoogle: (remember: boolean) => Promise<void>;
  loginLocalRoot: (username: LoginLocalRootPayload['username'], password: LoginLocalRootPayload['password']) => Promise<void>;
  logout: () => Promise<void>;
  clearAuthIssue: () => void;
}

type AdminAuthIssueCategory = 'permission-denied' | 'misconfiguration' | 'temporary-unavailable' | 'unknown';

interface AdminAuthIssue {
  code: string | null;
  category: AdminAuthIssueCategory;
  message: string;
}

class AdminPermissionError extends Error {
  code = 'permission-denied';

  constructor(message: string) {
    super(message);
    this.name = 'AdminPermissionError';
  }
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

function extractFirebaseErrorCode(error: unknown): string | null {
  if (typeof error === 'object' && error && 'code' in error) {
    return String(error.code).replace(/^(functions|firestore|auth)\//, '');
  }

  return null;
}

function mapAdminAuthIssue(code: string | null): AdminAuthIssue {
  if (code === 'permission-denied') {
    return {
      code,
      category: 'permission-denied',
      message: 'Permissão negada para sincronizar seu perfil administrativo.'
    };
  }

  if (code === 'failed-precondition' || code === 'invalid-argument' || code === 'unauthenticated') {
    return {
      code,
      category: 'misconfiguration',
      message: 'Configuração do projeto/ambiente inválida. Verifique as credenciais Firebase.'
    };
  }

  if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'network-request-failed') {
    return {
      code,
      category: 'temporary-unavailable',
      message: 'Serviço temporariamente indisponível ao sincronizar seu acesso administrativo.'
    };
  }

  return {
    code,
    category: 'unknown',
    message: 'Não foi possível validar seu perfil administrativo agora.'
  };
}

function mapLocalLoginError(code: string | null): string {
  if (code === 'not-found') return 'Usuário não encontrado. Verifique o e-mail/usuário informado.';
  if (code === 'unauthenticated' || code === 'invalid-credential') return 'E-mail/usuário ou senha inválidos. Revise os dados e tente novamente.';
  if (code === 'failed-precondition') return 'Sua conta está desativada. Procure um administrador.';
  if (code === 'too-many-requests') return 'Muitas tentativas de login. Tente novamente em alguns minutos.';

  return 'Não foi possível fazer login agora. Tente novamente.';
}

function mapGoogleLoginError(code: string | null): string {
  if (code === 'popup-closed-by-user') return 'Login com Google cancelado. Tente novamente.';
  if (code === 'popup-blocked') return 'O navegador bloqueou a janela de login do Google.';
  if (code === 'account-exists-with-different-credential') return 'Esta conta já existe com outro método de login.';
  if (code === 'operation-not-allowed') return 'Login com Google não está habilitado no momento.';

  return 'Não foi possível fazer login com Google. Tente novamente.';
}

function toFirebaseAdminUser(firebaseUser: FirebaseUser, role: AdminRole, profileName?: string): FirebaseAdminUser {
  return {
    id: firebaseUser.uid,
    name: profileName ?? firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? 'Usuário Admin',
    email: firebaseUser.email ?? '',
    role,
    avatarUrl: `https://i.pravatar.cc/100?u=${firebaseUser.uid}`,
    institution: 'Irmão Áureo',
    authSource: 'firebase',
    isLocalRoot: false
  };
}

function localUserFromSession(): AdminUser | null {
  const session = getLocalRootSession();
  if (!isLocalRootSessionValid(session)) return null;

  const baseUser = {
    id: session.user.uid,
    name: session.user.nome,
    email: session.user.email,
    avatarUrl: `https://i.pravatar.cc/100?u=${session.user.uid}`,
    institution: 'Irmão Áureo' as Institution,
    authSource: 'local-root' as const
  };

  if (session.user.perfil === 'root') {
    return {
      ...baseUser,
      role: 'root',
      isLocalRoot: true
    };
  }

  return {
    ...baseUser,
    role: session.user.perfil === 'admin' ? 'admin' : 'operador',
    isLocalRoot: false
  };
}

function resolveIdentity(user: AdminUser | null): { role: CanonicalRole | null; source: CanonicalSource | null } {
  if (!user) {
    return { role: null, source: null };
  }

  const role: CanonicalRole = user.role === 'root' ? 'ROOT' : user.role === 'admin' ? 'ADMIN' : 'OPERADOR';
  const source: CanonicalSource = user.authSource === 'local-root' ? 'LOCAL' : 'GOOGLE';
  return { role, source };
}

function assertActiveUser(status: string | undefined) {
  if (status === 'INACTIVE') {
    throw new Error('Sua conta está inativa. Procure um administrador.');
  }
}

function assertAllowedGoogleRole(role: string | undefined): role is 'ADMIN' | 'OPERADOR' {
  return role === 'ADMIN' || role === 'OPERADOR';
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUserState, setFirebaseUserState] = useState<AdminUser | null>(null);
  const [localRootUserState, setLocalRootUserState] = useState<AdminUser | null>(() => localUserFromSession());
  const [isFirebaseAuthenticated, setIsFirebaseAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authIssue, setAuthIssue] = useState<AdminAuthIssue | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      try {
        if (!firebaseUser) {
          setFirebaseUserState(null);
          setIsFirebaseAuthenticated(false);
          setIsLoading(false);
          return;
        }

        const linked = await api.linkGoogleUserOnFirstLogin({
          firebaseUid: firebaseUser.uid,
          email: firebaseUser.email ?? '',
          name: firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? 'Usuário Admin',
          provider: 'google'
        });

        assertActiveUser(linked.user.status);
        if (!assertAllowedGoogleRole(linked.user.role)) {
          throw new AdminPermissionError('Sua conta não possui role administrativa válida.');
        }

        const profile = toFirebaseAdminUser(firebaseUser, linked.user.role === 'ADMIN' ? 'admin' : 'operador', linked.user.name);
        setIsFirebaseAuthenticated(true);
        setFirebaseUserState(profile);
        setAuthIssue(null);
      } catch (error) {
        const code = extractFirebaseErrorCode(error);
        setAuthIssue(mapAdminAuthIssue(code));
        setFirebaseUserState(null);
        setIsFirebaseAuthenticated(false);
        try {
          await signOut(auth);
        } catch {
          // ignore
        }
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const hydrateLocalRootSession = async () => {
      const session = getLocalRootSession();
      if (!isLocalRootSessionValid(session)) {
        clearLocalRootSession();
        setLocalRootUserState(null);
        return;
      }

      const verification = await api.verifyLocalSession({ token: session.token });
      if (!verification.valid || !verification.user || verification.user.status === 'INACTIVE') {
        clearLocalRootSession();
        setLocalRootUserState(null);
        return;
      }

      const user = fromCanonicalUser(verification.user);
      user.perfil = toLegacyAdminUserRole(verification.user.role);
      user.status = toLegacyAdminUserStatus(verification.user.status);
      user.isLocalRoot = verification.user.role === 'ROOT';

      setLocalRootSession({
        token: session.token,
        expiresAt: verification.expiresAt ?? session.expiresAt,
        user
      });
      setLocalRootUserState(localUserFromSession());
    };

    void hydrateLocalRootSession();
  }, []);

  const resolvedUser = localRootUserState ?? firebaseUserState;
  const sessionType: SessionType = localRootUserState ? 'LOCAL' : firebaseUserState ? 'GOOGLE' : null;
  const resolvedIdentity = resolveIdentity(resolvedUser);

  const value = useMemo<AdminAuthContextValue>(() => {
    const loginLocalUser = async (emailOrUsername: string, password: string) => {
      if (!emailOrUsername.trim() || !password.trim()) {
        throw new Error('Preencha usuário/e-mail e senha para continuar.');
      }

      setAuthIssue(null);
      try {
        const response = await api.loginLocalUser({ emailOrUsername: emailOrUsername.trim(), password });
        assertActiveUser(response.session.user.status);

        const user = fromCanonicalUser(response.session.user);
        user.perfil = toLegacyAdminUserRole(response.session.user.role);
        user.status = toLegacyAdminUserStatus(response.session.user.status);
        user.isLocalRoot = response.session.user.role === 'ROOT';

        setLocalRootSession({
          token: response.session.token,
          expiresAt: response.session.expiresAt,
          user
        });
        setLocalRootUserState(localUserFromSession());
        setFirebaseUserState(null);
        setIsFirebaseAuthenticated(false);

        try {
          await signOut(auth);
        } catch {
          // ignore
        }
      } catch (error) {
        const code = extractFirebaseErrorCode(error);
        throw new Error(mapLocalLoginError(code));
      }
    };

    return {
      isAuthenticated: Boolean(resolvedUser),
      isFirebaseAuthenticated,
      isLoading,
      user: resolvedUser,
      sessionType,
      userRole: resolvedIdentity.role,
      authSource: resolvedIdentity.source,
      isLocalRoot: resolvedIdentity.role === 'ROOT',
      userEmail: resolvedUser?.email ?? null,
      authIssue,
      login: async (email: string, password: string) => loginLocalUser(email, password),
      loginLocalUser,
      loginWithGoogle: async (remember) => {
        await configureAuthPersistence(remember);
        setAuthIssue(null);

        try {
          const provider = new GoogleAuthProvider();
          const { user: firebaseUser } = await signInWithPopup(auth, provider);
          const linked = await api.linkGoogleUserOnFirstLogin({
            firebaseUid: firebaseUser.uid,
            email: firebaseUser.email ?? '',
            name: firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? 'Usuário Admin',
            provider: 'google'
          });

          assertActiveUser(linked.user.status);
          if (!assertAllowedGoogleRole(linked.user.role)) {
            throw new AdminPermissionError('Sua conta não possui role administrativa válida.');
          }

          const profile = toFirebaseAdminUser(firebaseUser, linked.user.role === 'ADMIN' ? 'admin' : 'operador', linked.user.name);
          setFirebaseUserState(profile);
          setIsFirebaseAuthenticated(true);
          setLocalRootUserState(null);
          clearLocalRootSession();
        } catch (error) {
          const code = extractFirebaseErrorCode(error);
          if (code === 'permission-denied') {
            const issue = mapAdminAuthIssue(code);
            setAuthIssue(issue);
            throw new Error(issue.message);
          }

          throw new Error(mapGoogleLoginError(code));
        }
      },
      loginLocalRoot: async (username: LoginLocalRootPayload['username'], password: LoginLocalRootPayload['password']) => {
        await loginLocalUser(username, password);
      },
      logout: async () => {
        clearLocalRootSession();
        setLocalRootUserState(null);

        try {
          await signOut(auth);
        } catch {
          // ignore signout errors
        }

        setFirebaseUserState(null);
        setIsFirebaseAuthenticated(false);
        setAuthIssue(null);
      },
      clearAuthIssue: () => {
        setAuthIssue(null);
      }
    };
  }, [authIssue, isFirebaseAuthenticated, isLoading, resolvedIdentity.role, resolvedIdentity.source, resolvedUser, sessionType]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  }

  return context;
}
