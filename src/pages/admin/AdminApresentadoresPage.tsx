import { PageHeader } from '@/components/admin/PageHeader';
import { presenters } from '@/data/mockData';
import { PresenterCard } from '@/components/public/PresenterCard';

export function AdminApresentadoresPage() {
  return <div><PageHeader title="Gestão de Apresentadores" description="Cadastro de apresentadores e palestrantes." action="Novo apresentador" /><div className="grid gap-4 md:grid-cols-3">{presenters.map((p) => <PresenterCard key={p.id} presenter={p} />)}</div></div>;
}
