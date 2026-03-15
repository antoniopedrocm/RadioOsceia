import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

interface FilterBarProps {
  searchPlaceholder?: string;
  categoryLabel?: string;
}

export function FilterBar({ searchPlaceholder = 'Buscar...', categoryLabel = 'Todas categorias' }: FilterBarProps) {
  return (
    <div className="grid gap-3 rounded-xl border bg-card p-3 md:grid-cols-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
        <Input className="pl-9" placeholder={searchPlaceholder} />
      </div>
      <Select>
        <option>Todos status</option>
        <option>Ativo</option>
        <option>Rascunho</option>
        <option>Arquivado</option>
      </Select>
      <Select>
        <option>{categoryLabel}</option>
        <option>Estudo</option>
        <option>Jornal</option>
        <option>Musical</option>
      </Select>
    </div>
  );
}
