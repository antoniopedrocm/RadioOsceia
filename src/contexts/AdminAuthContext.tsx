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

type AdminRole = 'admin' | 'operador';
type AuthSource = 'firebase' | 'local-breakglass';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  avatarUrl: string;
  institution: Institution;
  authSource: AuthSource;
  isBreakGlass?: boolean;
}

interface AdminAuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  userEmail: string | null;
  user: AdminUser | null;
  authIssue: AdminAuthIssue | null;
  login: (email: string, password: string, keepConnected: boolean) => Promise<void>;
  loginWithGoogle: (remember: boolean) => Promise<void>;
  loginLocalBreakGlass: (username: string, password: string) => Promise<void>;
  isLocalBreakGlassEnabled: boolean;
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
const FIREBASE_PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'unknown-project';
const LOCAL_BREAK_GLASS_STORAGE_KEY = 'radioosceia_local_breakglass_session';

const localBreakGlassConfig = {
  enabled: import.meta.env.VITE_LOCAL_ADMIN_ENABLED === 'true',
  username: import.meta.env.VITE_LOCAL_ADMIN_USERNAME,
  passwordHash: import.meta.env.VITE_LOCAL_ADMIN_PASSWORD_HASH
};

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
      message: 'Permissão negada para sincronizar seu perfil administrativo. Solicite acesso no Firestore para a coleção users/{uid}.'
    };
  }

  if (code === 'failed-precondition' || code === 'invalid-argument' || code === 'unauthenticated') {
    return {
      code,
      category: 'misconfiguration',
      message: 'Configuração do projeto/ambiente inválida. Verifique VITE_FIREBASE_PROJECT_ID e as credenciais Firebase carregadas no app.'
    };
  }

  if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'network-request-failed') {
    return {
      code,
      category: 'temporary-unavailable',
      message: 'Serviço temporariamente indisponível ao sincronizar seu acesso administrativo. Aguarde alguns instantes e tente novamente.'
    };
  }

  return {
    code,
    category: 'unknown',
    message: 'Não foi possível validar seu perfil administrativo agora. Tente novamente em alguns instantes.'
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
  if (code === 'popup-closed-by-user') return 'Login com Google cancelado. Não feche a janela de autenticação e tente novamente.';
  if (code === 'popup-blocked') return 'O navegador bloqueou a janela de login do Google. Libere pop-ups para este site e tente novamente.';
  if (code === 'account-exists-with-different-credential') return 'Esta conta já existe com outro método de login. Use o método original para entrar.';
  if (code === 'operation-not-allowed') return 'Login com Google não está habilitado no momento.';

  return 'Não foi possível fazer login com Google. Tente novamente.';
}

function buildLocalBreakGlassUser(): AdminUser {
  return {
    id: 'local-breakglass-administrador',
    name: 'Administrador',
    email: localBreakGlassConfig.username ?? 'Administrador',
    role: 'admin',
    avatarUrl: 'https://i.pravatar.cc/100?u=local-breakglass-administrador',
    institution: 'Irmão Áureo',
    authSource: 'local-breakglass',
    isBreakGlass: true
  };
}

function hasValidAdminRole(role: unknown): role is AdminRole {
  return role === 'admin' || role === 'operador';
}

function loadBreakGlassSessionFromStorage() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(LOCAL_BREAK_GLASS_STORAGE_KEY) === 'true';
}

function persistBreakGlassSession(active: boolean) {
  if (typeof window === 'undefined') return;
  if (active) {
    localStorage.setItem(LOCAL_BREAK_GLASS_STORAGE_KEY, 'true');
  } else {
    localStorage.removeItem(LOCAL_BREAK_GLASS_STORAGE_KEY);
  }
}

async function sha256Hex(input: string) {
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function upsertProfile(firebaseUser: FirebaseUser): Promise<AdminUser> {
  const operation = `users/${firebaseUser.uid} upsert`;

  const userRef = doc(db, 'users', firebaseUser.uid);
  const snapshot = await getDoc(userRef);

  const existingData = snapshot.exists() ? snapshot.data() : null;
  const existingRole = existingData?.role;
  const role: AdminRole = hasValidAdminRole(existingRole) ? existingRole : 'operador';
  const institution = 'Irmão Áureo' as Institution;
  const isDisabled = existingData?.status === 'inativo';

  const profile: AdminUser = {
    id: firebaseUser.uid,
    name: typeof existingData?.name === 'string'
      ? existingData.name
      : firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? 'Usuário Admin',
    email: firebaseUser.email ?? '',
    role,
    avatarUrl: typeof existingData?.avatarUrl === 'string' ? existingData.avatarUrl : `https://i.pravatar.cc/100?u=${firebaseUser.uid}`,
    institution,
    authSource: 'firebase'
  };

  await setDoc(
    userRef,
    {
      id: firebaseUser.uid,
      name: profile.name,
      email: profile.email,
      role,
      institution,
      status: isDisabled ? 'inativo' : 'ativo',
      updatedAt: serverTimestamp(),
      createdAt: snapshot.exists() ? snapshot.data().createdAt ?? serverTimestamp() : serverTimestamp()
    },
    { merge: true }
  );

  if (!hasValidAdminRole(role)) {
    throw new Error('Perfil sem permissão administrativa.');
  }

  return profile;
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUserState, setFirebaseUserState] = useState<AdminUser | null>(null);
  const [localBreakGlassActive, setLocalBreakGlassActive] = useState(loadBreakGlassSessionFromStorage());
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
    if (!localBreakGlassConfig.enabled && localBreakGlassActive) {
      setLocalBreakGlassActive(false);
      persistBreakGlassSession(false);
    }
  }, [localBreakGlassActive]);

  const resolvedUser = localBreakGlassActive ? buildLocalBreakGlassUser() : firebaseUserState;
  const isAuthenticated = Boolean(resolvedUser);

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      isAuthenticated,
      isLoading,
      user: resolvedUser,
      userEmail: resolvedUser?.email ?? null,
      authIssue,
      isLocalBreakGlassEnabled: localBreakGlassConfig.enabled,
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
          setLocalBreakGlassActive(false);
          persistBreakGlassSession(false);
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
          setLocalBreakGlassActive(false);
          persistBreakGlassSession(false);
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
      loginLocalBreakGlass: async (username: string, password: string) => {
        if (!localBreakGlassConfig.enabled) {
          throw new Error('A conta local de contingência está desabilitada.');
        }

        if (!localBreakGlassConfig.username || !localBreakGlassConfig.passwordHash) {
          throw new Error('Conta local de contingência mal configurada no ambiente.');
        }

        const normalizedUsername = username.trim();
        if (!normalizedUsername || !password.trim()) {
          throw new Error('Informe usuário e senha da conta de contingência.');
        }

        const candidateHash = await sha256Hex(password);
        if (normalizedUsername !== localBreakGlassConfig.username || candidateHash !== localBreakGlassConfig.passwordHash.toLowerCase()) {
          throw new Error('Credenciais locais inválidas.');
        }

        setLocalBreakGlassActive(true);
        persistBreakGlassSession(true);
        setAuthIssue(null);
      },
      logout: async () => {
        try {
          await signOut(auth);
        } catch {
          // sessão local continua podendo encerrar mesmo sem Firebase disponível
        }
        setFirebaseUserState(null);
        setLocalBreakGlassActive(false);
        persistBreakGlassSession(false);
        setAuthIssue(null);
      },
      clearAuthIssue: () => {
        setAuthIssue(null);
      }
    }),
    [authIssue, isAuthenticated, isLoading, resolvedUser]
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
