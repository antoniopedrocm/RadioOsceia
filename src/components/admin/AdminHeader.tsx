import { InstitutionSwitcher } from '@/components/InstitutionSwitcher';
import type { Institution } from '@/types';

interface Props { institution: Institution; onInstitutionChange: (v: Institution) => void }

export function AdminHeader({ institution, onInstitutionChange }: Props) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/95 p-4 backdrop-blur">
      <h1 className="font-semibold">Gestão Rádio / Web TV</h1>
      <InstitutionSwitcher value={institution} onChange={onInstitutionChange} />
    </header>
  );
}
