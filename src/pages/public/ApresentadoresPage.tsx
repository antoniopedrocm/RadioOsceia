import { PresenterCard } from '@/components/public/PresenterCard';
import { presenters } from '@/data/mockData';

export function ApresentadoresPage() {
  return <div><h1 className="mb-4 text-2xl font-semibold">Apresentadores e palestrantes</h1><div className="grid gap-4 md:grid-cols-3">{presenters.map((p) => <PresenterCard key={p.id} presenter={p} />)}</div></div>;
}
