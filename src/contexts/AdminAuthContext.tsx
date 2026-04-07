import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import type { Institution } from '@/types';
import { auth, configureAuthPersistence, db } from '@/lib/firebase';
import { loginLocalRoot as loginLocalRootApi } from '@/lib/adminUsersApi';
import {
  clearLocalRootSession,
  getLocalRootSession,
  isLocalRootSessionValid,
  setLocalRootSession
} from '@/lib/localRootSession';

type AdminRole = 'admin' | 'operador';

type SessionType = 'firebase' | 'local-root' | null;

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole | 'root';
  avatarUrl: string;
  institution: Institution;
  authSource: 'firebase' | 'local-root';
  isLocalRoot: boolean;
}

interface AdminAuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  userEmail: string | null;
  user: AdminUser | null;
  authIssue: AdminAuthIssue | null;
  sessionType: SessionType;
  isLocalRoot: boolean;
  login: (email: string, password: string, keepConnected: boolean) => Promise<void>;
  loginWithGoogle: (remember: boolean) => Promise<void>;
  loginLocalRoot: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearAuthIssue: () => void;
}

type AdminAuthIssueCategory = 'permission-denied' | 'misconfiguration' | 'temporary-unavailable' | 'unknown';

interface AdminAuthIssue {
  code: string | null;
  category: AdminAuthIssueCategory;
  message: string;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

function extractFirebaseErrorCode(error: unknown): string | null {
  if (typeof error === 'object' && error && 'code' in error) {
    return String(error.code).replace(/^(firestore|auth)\//, '');
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

function mapEmailLoginError(code: string | null): string {
  if (code === 'user-not-found') return 'Usuário não encontrado. Verifique o e-mail informado.';
  if (code === 'wrong-password' || code === 'invalid-credential') return 'E-mail ou senha inválidos. Revise os dados e tente novamente.';
  if (code === 'invalid-email') return 'E-mail inválido. Verifique o formato informado.';
  if (code === 'too-many-requests') return 'Muitas tentativas de login. Tente novamente em alguns minutos.';
  if (code === 'user-disabled') return 'Sua conta está desativada. Procure um administrador.';

  return 'Não foi possível fazer login agora. Tente novamente.';
}

function mapGoogleLoginError(code: string | null): string {
  if (code === 'popup-closed-by-user') return 'Login com Google cancelado. Tente novamente.';
  if (code === 'popup-blocked') return 'O navegador bloqueou a janela de login do Google.';
  if (code === 'account-exists-with-different-credential') return 'Esta conta já existe com outro método de login.';
  if (code === 'operation-not-allowed') return 'Login com Google não está habilitado no momento.';

  return 'Não foi possível fazer login com Google. Tente novamente.';
}

function toFirebaseAdminUser(firebaseUser: FirebaseUser, role: AdminRole, profileName?: string): AdminUser {
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

function hasValidAdminRole(role: unknown): role is AdminRole {
  return role === 'admin' || role === 'operador';
}

async function upsertProfile(firebaseUser: FirebaseUser): Promise<AdminUser> {
  const userRef = doc(db, 'users', firebaseUser.uid);
  const snapshot = await getDoc(userRef);

  const existingData = snapshot.exists() ? snapshot.data() : null;
  const existingRole = existingData?.role;
  const role: AdminRole = hasValidAdminRole(existingRole) ? existingRole : 'operador';
  const profile = toFirebaseAdminUser(firebaseUser, role, typeof existingData?.name === 'string' ? existingData.name : undefined);

  await setDoc(
    userRef,
    {
      id: firebaseUser.uid,
      name: profile.name,
      email: profile.email,
      role,
      institution: 'Irmão Áureo',
      status: existingData?.status === 'inativo' ? 'inativo' : 'ativo',
      updatedAt: serverTimestamp(),
      createdAt: snapshot.exists() ? snapshot.data().createdAt ?? serverTimestamp() : serverTimestamp()
    },
    { merge: true }
  );

  return profile;
}

function localRootUserFromSession() {
  const session = getLocalRootSession();
  if (!isLocalRootSessionValid(session)) return null;

  return {
    id: session.user.uid,
    name: session.user.nome,
    email: session.user.email,
    role: 'root' as const,
    avatarUrl: 'https://i.pravatar.cc/100?u=radioosceia-local-root',
    institution: 'Irmão Áureo' as Institution,
    authSource: 'local-root' as const,
    isLocalRoot: true
  };
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUserState, setFirebaseUserState] = useState<AdminUser | null>(null);
  const [localRootUserState, setLocalRootUserState] = useState<AdminUser | null>(() => localRootUserFromSession());
  const [isLoading, setIsLoading] = useState(true);
  const [authIssue, setAuthIssue] = useState<AdminAuthIssue | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      try {
        if (!firebaseUser) {
          setFirebaseUserState(null);
          return;
        }

        const profile = await upsertProfile(firebaseUser);
        setFirebaseUserState(profile);
        setAuthIssue(null);
      } catch (error) {
        const code = extractFirebaseErrorCode(error);
        setAuthIssue(mapAdminAuthIssue(code));
        setFirebaseUserState(null);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const session = getLocalRootSession();
    if (!isLocalRootSessionValid(session)) {
      clearLocalRootSession();
      setLocalRootUserState(null);
      return;
    }

    setLocalRootUserState(localRootUserFromSession());
  }, []);

  const resolvedUser = localRootUserState ?? firebaseUserState;
  const sessionType: SessionType = localRootUserState ? 'local-root' : firebaseUserState ? 'firebase' : null;

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      isAuthenticated: Boolean(resolvedUser),
      isLoading,
      user: resolvedUser,
      sessionType,
      isLocalRoot: sessionType === 'local-root',
      userEmail: resolvedUser?.email ?? null,
      authIssue,
      login: async (email: string, password: string, remember) => {
        if (!email.trim() || !password.trim()) {
          throw new Error('Preencha e-mail e senha para continuar.');
        }

        await configureAuthPersistence(remember);
        setAuthIssue(null);

        try {
          const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
          const profile = await upsertProfile(credential.user);
          setFirebaseUserState(profile);
          setLocalRootUserState(null);
          clearLocalRootSession();
        } catch (error) {
          const code = extractFirebaseErrorCode(error);
          if (code === 'permission-denied') {
            const issue = mapAdminAuthIssue(code);
            setAuthIssue(issue);
            throw new Error(issue.message);
          }

          throw new Error(mapEmailLoginError(code));
        }
      },
      loginWithGoogle: async (remember) => {
        await configureAuthPersistence(remember);
        setAuthIssue(null);

        try {
          const provider = new GoogleAuthProvider();
          const { user: firebaseUser } = await signInWithPopup(auth, provider);
          const profile = await upsertProfile(firebaseUser);
          setFirebaseUserState(profile);
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
      loginLocalRoot: async (username: string, password: string) => {
        if (!username.trim() || !password.trim()) {
          throw new Error('Informe usuário e senha do root local.');
        }

        const session = await loginLocalRootApi({ username, password });
        setLocalRootSession(session);
        setLocalRootUserState(localRootUserFromSession());
        setAuthIssue(null);
      },
      logout: async () => {
        try {
          await signOut(auth);
        } catch {
          // ignore signout errors
        }

        setFirebaseUserState(null);
        setLocalRootUserState(null);
        clearLocalRootSession();
        setAuthIssue(null);
      },
      clearAuthIssue: () => {
        setAuthIssue(null);
      }
    }),
    [authIssue, isLoading, resolvedUser, sessionType]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  }

  return context;
}
