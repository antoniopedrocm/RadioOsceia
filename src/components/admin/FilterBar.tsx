import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export function FilterBar() {
  return (
    <div className="grid gap-3 rounded-xl border bg-card p-3 md:grid-cols-3">
      <Input placeholder="Buscar..." />
      <Select><option>Todos status</option><option>Ativo</option><option>Rascunho</option></Select>
      <Select><option>Todas categorias</option><option>Estudo</option><option>Reflexão</option></Select>
    </div>
  );
}
