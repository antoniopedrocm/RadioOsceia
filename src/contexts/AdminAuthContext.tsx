import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setAccessToken } from '@/lib/api';
import type { ApiUser } from '@/types/api';

interface AdminAuthContextValue {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  userEmail: string | null;
  user: ApiUser | null;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const isAuthenticated = Boolean(user);

  useEffect(() => {
    const restore = async () => {
      try {
        const me = await api.get<ApiUser>('/auth/me');
        setUser(me);
      } catch {
        setAccessToken(null);
      }
    };

    void restore();
  }, []);

  const value = useMemo<AdminAuthContextValue>(() => ({
    isAuthenticated,
    user,
    userEmail: user?.email ?? null,
    login: async (email: string, password: string) => {
      const response = await api.post<{ accessToken: string; user: ApiUser }>('/auth/login', { email, password });
      setAccessToken(response.accessToken);
      setUser(response.user);
    },
    logout: async () => {
      try {
        await api.post('/auth/logout');
      } finally {
        setAccessToken(null);
        setUser(null);
      }
    }
  }), [isAuthenticated, user]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  }

  return context;
}
