import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { InstitutionSwitcher } from '@/components/InstitutionSwitcher';
import { adminNavItems } from '@/components/admin/adminNavigation';

interface Props {
  userEmail: string | null;
  userName: string;
  authSource?: 'firebase' | 'local-root';
}

export function AdminHeader({ userEmail, userName, authSource = 'firebase' }: Props) {
  const { pathname } = useLocation();
  const currentSection = useMemo(
    () => adminNavItems.find((item) => pathname.startsWith(item.path))?.label ?? 'Dashboard',
    [pathname]
  );
  const initials = userName
    .split(' ')
    .slice(0, 2)
    .map((name) => name[0])
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">Área Administrativa</p>
        <h1 className="text-xl font-semibold text-slate-900">{currentSection}</h1>
      </div>
      <div className="flex items-center gap-4">
        <InstitutionSwitcher />
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">{initials}</div>
          <div className="hidden md:block">
            <p className="text-xs text-slate-500">{authSource === 'local-root' ? 'Root local' : 'Administrador Firebase'}</p>
            <p className="text-sm font-medium text-slate-700">{userEmail ?? 'admin@radioirmaoaureo.dev'}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
