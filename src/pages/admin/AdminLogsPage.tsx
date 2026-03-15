import { PageHeader } from '@/components/admin/PageHeader';
import { DataTable } from '@/components/admin/DataTable';
import { logs } from '@/data/mockData';

export function AdminLogsPage() {
  return <div><PageHeader title="Logs / Atividades" description="Auditoria mockada de ações administrativas." /><DataTable headers={['Data/Hora','Usuário','Ação','Entidade','Descrição','Status']} rows={logs} /></div>;
}
