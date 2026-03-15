import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const ADMIN_AUTH_KEY = 'radioosceia_admin_auth';

interface AdminAuthContextValue {
  isAuthenticated: boolean;
  login: (email: string) => void;
  logout: () => void;
  userEmail: string | null;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_AUTH_KEY);
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as { authenticated: boolean; email: string | null };
      setIsAuthenticated(parsed.authenticated);
      setUserEmail(parsed.email);
    } catch {
      localStorage.removeItem(ADMIN_AUTH_KEY);
    }
  }, []);

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      isAuthenticated,
      userEmail,
      login: (email: string) => {
        const payload = { authenticated: true, email };
        localStorage.setItem(ADMIN_AUTH_KEY, JSON.stringify(payload));
        setIsAuthenticated(true);
        setUserEmail(email);
      },
      logout: () => {
        localStorage.removeItem(ADMIN_AUTH_KEY);
        setIsAuthenticated(false);
        setUserEmail(null);
      }
    }),
    [isAuthenticated, userEmail]
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
