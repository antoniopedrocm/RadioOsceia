import { Select } from '@/components/ui/select';
import { institutions } from '@/data/mockData';
import type { Institution } from '@/types';

interface Props { value: Institution; onChange: (v: Institution) => void }

export function InstitutionSwitcher({ value, onChange }: Props) {
  return (
    <div className="min-w-44">
      <Select value={value} onChange={(e) => onChange(e.target.value as Institution)} aria-label="Selecionar instituição">
        {institutions.map((i) => <option key={i.nome} value={i.nome}>{i.nome}</option>)}
      </Select>
    </div>
  );
}
