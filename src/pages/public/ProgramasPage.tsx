import { ProgramCard } from '@/components/public/ProgramCard';
import { programs } from '@/data/mockData';

export function ProgramasPage() {
  return <div><h1 className="mb-4 text-2xl font-semibold">Todos os programas</h1><div className="grid gap-4 md:grid-cols-3">{programs.map((p) => <ProgramCard key={p.id} program={p} />)}</div></div>;
}
