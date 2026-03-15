import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Institution } from '@/types';

const STORAGE_KEY = 'radioosceia_admin_auth';

interface MockAdminUser {
  id: string;
  name: string;
  email: string;
  role: 'admin';
  avatarUrl: string;
  institution: Institution;
}

interface PersistedAuth {
  isAuthenticated: boolean;
  keepConnected: boolean;
  user: MockAdminUser;
}

interface AdminAuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  userEmail: string | null;
  user: MockAdminUser | null;
  login: (email: string, password: string, keepConnected: boolean) => Promise<void>;
  logout: () => void;
  updateInstitution: (institution: Institution) => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

function getStorage(keepConnected: boolean) {
  return keepConnected ? localStorage : sessionStorage;
}

function clearPersistedAuth() {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
}

function readPersistedAuth(): PersistedAuth | null {
  const sessionData = sessionStorage.getItem(STORAGE_KEY);
  if (sessionData) {
    return JSON.parse(sessionData) as PersistedAuth;
  }

  const localData = localStorage.getItem(STORAGE_KEY);
  if (localData) {
    return JSON.parse(localData) as PersistedAuth;
  }

  return null;
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MockAdminUser | null>(null);
  const [keepConnected, setKeepConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const isAuthenticated = Boolean(user);

  useEffect(() => {
    try {
      const restored = readPersistedAuth();
      if (restored?.isAuthenticated) {
        setUser(restored.user);
        setKeepConnected(restored.keepConnected);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      isAuthenticated,
      isLoading,
      user,
      userEmail: user?.email ?? null,
      login: async (email: string, password: string, remember) => {
        const trimmedEmail = email.trim();
        if (!trimmedEmail || !password.trim()) {
          throw new Error('Preencha e-mail e senha para continuar.');
        }

        const nextUser: MockAdminUser = {
          id: 'admin-01',
          name: 'Administrador Rádio OSCEIA',
          email: trimmedEmail,
          role: 'admin',
          avatarUrl: 'https://i.pravatar.cc/100?img=12',
          institution: 'Irmão Áureo'
        };

        const persistedPayload: PersistedAuth = {
          isAuthenticated: true,
          keepConnected: remember,
          user: nextUser
        };

        clearPersistedAuth();
        getStorage(remember).setItem(STORAGE_KEY, JSON.stringify(persistedPayload));
        setKeepConnected(remember);
        setUser(nextUser);
      },
      logout: () => {
        clearPersistedAuth();
        setUser(null);
      },
      updateInstitution: (institution) => {
        if (!user) {
          return;
        }

        const nextUser = { ...user, institution };
        const persistedPayload: PersistedAuth = {
          isAuthenticated: true,
          keepConnected,
          user: nextUser
        };

        clearPersistedAuth();
        getStorage(keepConnected).setItem(STORAGE_KEY, JSON.stringify(persistedPayload));
        setUser(nextUser);
      }
    }),
    [isAuthenticated, isLoading, user, keepConnected]
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
