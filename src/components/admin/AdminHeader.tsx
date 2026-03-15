import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { InstitutionSwitcher } from '@/components/InstitutionSwitcher';
import { adminNavItems } from '@/components/admin/adminNavigation';
import type { Institution } from '@/types';

interface Props {
  institution: Institution;
  onInstitutionChange: (v: Institution) => void;
  userEmail: string | null;
}

export function AdminHeader({ institution, onInstitutionChange, userEmail }: Props) {
  const { pathname } = useLocation();
  const currentSection = useMemo(
    () => adminNavItems.find((item) => pathname.startsWith(item.path))?.label ?? 'Dashboard',
    [pathname]
  );

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/95 px-6 py-4 backdrop-blur">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Área Administrativa</p>
        <h1 className="text-xl font-semibold">{currentSection}</h1>
      </div>
      <div className="flex items-center gap-4">
        <InstitutionSwitcher value={institution} onChange={onInstitutionChange} />
        <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">AD</div>
          <div className="hidden md:block">
            <p className="text-xs text-muted-foreground">Administrador</p>
            <p className="text-sm font-medium">{userEmail ?? 'admin@radioosceia.dev'}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
