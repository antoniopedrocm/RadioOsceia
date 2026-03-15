import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { InstitutionSwitcher } from '@/components/InstitutionSwitcher';
import { adminNavItems } from '@/components/admin/adminNavigation';
import type { Institution } from '@/types';

interface Props {
  institution: Institution;
  onInstitutionChange: (v: Institution) => void;
  userEmail: string | null;
  userName: string;
}

export function AdminHeader({ institution, onInstitutionChange, userEmail, userName }: Props) {
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
        <InstitutionSwitcher value={institution} onChange={onInstitutionChange} />
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">{initials}</div>
          <div className="hidden md:block">
            <p className="text-xs text-slate-500">Administrador</p>
            <p className="text-sm font-medium text-slate-700">{userEmail ?? 'admin@radioosceia.dev'}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
