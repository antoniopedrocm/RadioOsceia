import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User as FirebaseUser } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
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
  login: (email: string, password: string, keepConnected: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

function mapFirebaseAuthError(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    return 'Não foi possível entrar. Verifique suas credenciais.';
  }

  const errorCode = error.code.replace('auth/', '');
  const messages: Record<string, string> = {
    'invalid-credential': 'E-mail ou senha inválidos.',
    'wrong-password': 'Senha incorreta.',
    'user-not-found': 'Usuário não encontrado.',
    'invalid-email': 'E-mail inválido.',
    'too-many-requests': 'Muitas tentativas. Tente novamente em instantes.'
  };

  return messages[errorCode] ?? 'Não foi possível entrar. Verifique suas credenciais.';
}

async function upsertProfile(firebaseUser: FirebaseUser): Promise<AdminUser> {
  const userRef = doc(db, 'users', firebaseUser.uid);
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

  await setDoc(userRef, {
    ...profile,
    institution,
    updatedAt: serverTimestamp(),
    createdAt: snapshot.exists() ? snapshot.data().createdAt ?? serverTimestamp() : serverTimestamp()
  }, { merge: true });

  return profile;
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isAuthenticated = Boolean(user);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      try {
        if (!firebaseUser) {
          setUser(null);
          return;
        }

        const profile = await upsertProfile(firebaseUser);
        setUser(profile);
      } catch (error) {
        console.error('Falha ao sincronizar perfil administrativo no Firestore.', error);
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
      login: async (email: string, password: string, remember) => {
        const normalizedEmail = email.trim();
        if (!normalizedEmail || !password.trim()) {
          throw new Error('Preencha e-mail e senha para continuar.');
        }

        try {
          await configureAuthPersistence(remember);
          const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
          const profile = await upsertProfile(credential.user);
          setUser(profile);
        } catch (error) {
          throw new Error(mapFirebaseAuthError(error));
        }
      },
      logout: async () => {
        await signOut(auth);
        setUser(null);
      }
    }),
    [isAuthenticated, isLoading, user]
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
