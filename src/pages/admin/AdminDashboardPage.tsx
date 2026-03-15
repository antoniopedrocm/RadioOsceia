import { DashboardStatCard } from '@/components/admin/DashboardStatCard';
import { MockChartCard } from '@/components/admin/MockChartCard';
import { DataTable } from '@/components/admin/DataTable';

export function AdminDashboardPage() {
  return <div className="space-y-5"><div className="grid gap-4 md:grid-cols-4"><DashboardStatCard title="Total de programas" value="24" /><DashboardStatCard title="Total de mídias" value="86" /><DashboardStatCard title="Agendados hoje" value="18" /><DashboardStatCard title="No ar agora" value="1" /></div><MockChartCard /><DataTable headers={['Horário','Evento','Status']} rows={[['14:00','Mensagem de Luz no ar','Ativo'],['14:30','Vinheta institucional','Agendado'],['15:00','Estudo do Evangelho','Agendado']]} /></div>;
}
