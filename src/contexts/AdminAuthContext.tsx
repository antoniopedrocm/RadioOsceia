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

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'operador';
  avatarUrl: string;
  institution: Institution;
}

interface AdminAuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  userEmail: string | null;
  user: AdminUser | null;
  authIssue: AdminAuthIssue | null;
  login: (email: string, password: string, keepConnected: boolean) => Promise<void>;
  loginWithGoogle: (remember: boolean) => Promise<void>;
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

  if (code === 'unavailable' || code === 'deadline-exceeded') {
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
  if (code === 'user-not-found') {
    return 'Usuário não encontrado. Verifique o e-mail informado.';
  }

  if (code === 'wrong-password' || code === 'invalid-credential') {
    return 'E-mail ou senha inválidos. Revise os dados e tente novamente.';
  }

  if (code === 'invalid-email') {
    return 'E-mail inválido. Verifique o formato informado.';
  }

  if (code === 'too-many-requests') {
    return 'Muitas tentativas de login. Tente novamente em alguns minutos.';
  }

  return 'Não foi possível fazer login agora. Tente novamente.';
}

function mapGoogleLoginError(code: string | null): string {
  if (code === 'popup-closed-by-user') {
    return 'Login com Google cancelado. Não feche a janela de autenticação e tente novamente.';
  }

  if (code === 'popup-blocked') {
    return 'O navegador bloqueou a janela de login do Google. Libere pop-ups para este site e tente novamente.';
  }

  if (code === 'account-exists-with-different-credential') {
    return 'Esta conta já existe com outro método de login. Use o método original para entrar.';
  }

  if (code === 'operation-not-allowed') {
    return 'Login com Google não está habilitado no momento.';
  }

  return 'Não foi possível fazer login com Google. Tente novamente.';
}

async function upsertProfile(firebaseUser: FirebaseUser): Promise<AdminUser> {
  const operation = `users/${firebaseUser.uid} upsert`;
  console.info('[AdminAuth] Firestore upsert started', {
    uid: firebaseUser.uid,
    projectId: FIREBASE_PROJECT_ID,
    operation
  });

  const userRef = doc(db, 'users', firebaseUser.uid);
  try {
    const snapshot = await getDoc(userRef);

    const role = snapshot.exists() ? String(snapshot.data().role ?? 'operador') : 'operador';
    const institution = 'Irmão Áureo' as Institution;

    const profile: AdminUser = {
      id: firebaseUser.uid,
      name: snapshot.data()?.name ?? firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? 'Usuário Admin',
      email: firebaseUser.email ?? '',
      role: role === 'admin' ? 'admin' : 'operador',
      avatarUrl: snapshot.data()?.avatarUrl ?? `https://i.pravatar.cc/100?u=${firebaseUser.uid}`,
      institution
    };

    await setDoc(
      userRef,
      {
        ...profile,
        institution,
        updatedAt: serverTimestamp(),
        createdAt: snapshot.exists() ? snapshot.data().createdAt ?? serverTimestamp() : serverTimestamp()
      },
      { merge: true }
    );

    console.info('[AdminAuth] Firestore upsert succeeded', {
      uid: firebaseUser.uid,
      projectId: FIREBASE_PROJECT_ID,
      operation
    });

    return profile;
  } catch (error) {
    console.error('[AdminAuth] Firestore upsert failed', {
      uid: firebaseUser.uid,
      projectId: FIREBASE_PROJECT_ID,
      operation,
      code: extractFirebaseErrorCode(error)
    });
    throw error;
  }
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authIssue, setAuthIssue] = useState<AdminAuthIssue | null>(null);
  const isAuthenticated = Boolean(user);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      try {
        if (!firebaseUser) {
          setUser(null);
          setAuthIssue(null);
          return;
        }

        const profile = await upsertProfile(firebaseUser);
        setUser(profile);
        setAuthIssue(null);
      } catch (error) {
        const code = extractFirebaseErrorCode(error);
        const issue = mapAdminAuthIssue(code);
        console.error('[AdminAuth] Failed to sync administrative profile', {
          uid: firebaseUser?.uid ?? null,
          projectId: FIREBASE_PROJECT_ID,
          operation: firebaseUser?.uid ? `users/${firebaseUser.uid} upsert` : 'users/{uid} upsert',
          code,
          category: issue.category
        });
        setAuthIssue(issue);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      isAuthenticated,
      isLoading,
      user,
      userEmail: user?.email ?? null,
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
          setUser(profile);
        } catch (error) {
          const code = extractFirebaseErrorCode(error);
          const issue = mapAdminAuthIssue(code);

          if (code === 'permission-denied') {
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
          setUser(profile);
        } catch (error) {
          const code = extractFirebaseErrorCode(error);
          const issue = mapAdminAuthIssue(code);

          if (code === 'permission-denied') {
            setAuthIssue(issue);
            throw new Error(issue.message);
          }

          throw new Error(mapGoogleLoginError(code));
        }
      },
      logout: async () => {
        await signOut(auth);
        setUser(null);
        setAuthIssue(null);
      },
      clearAuthIssue: () => {
        setAuthIssue(null);
      }
    }),
    [authIssue, isAuthenticated, isLoading, user]
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
