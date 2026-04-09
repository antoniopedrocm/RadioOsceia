import type { LocalRootSession } from '@/types/admin-user';

export const LOCAL_ROOT_SESSION_KEY = 'radioosceia_local_root_session';

export function getLocalRootSession(): LocalRootSession | null {
  if (typeof window === 'undefined') return null;

  const raw = localStorage.getItem(LOCAL_ROOT_SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as LocalRootSession;
    if (!parsed?.token || !parsed?.expiresAt || !parsed?.user?.id) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function setLocalRootSession(session: LocalRootSession) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_ROOT_SESSION_KEY, JSON.stringify(session));
}

export function clearLocalRootSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LOCAL_ROOT_SESSION_KEY);
}

export function isLocalRootSessionValid(session: LocalRootSession | null): session is LocalRootSession {
  if (!session) return false;
  const expiresAt = Date.parse(session.expiresAt);
  if (!Number.isFinite(expiresAt)) return false;
  return expiresAt > Date.now();
}
