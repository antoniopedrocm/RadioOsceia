import { Activity, CalendarCheck2, Clapperboard, Library } from 'lucide-react';
import { DashboardStatCard } from '@/components/admin/DashboardStatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function AdminDashboardPage() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard title="Total de programas" value="24" icon={Clapperboard} trend="+2 novos no mês" />
        <DashboardStatCard title="Total de mídias" value="186" icon={Library} trend="42 publicados" />
        <DashboardStatCard title="Conteúdo no ar" value="01" icon={Activity} trend="Transmissão estável" />
        <DashboardStatCard title="Agendamentos do dia" value="18" icon={CalendarCheck2} trend="3 pendentes de revisão" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Audiência (mock)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 rounded-xl bg-gradient-to-b from-primary/20 to-primary/5" />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>No ar agora</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">Mensagem de Luz</p>
              <p className="text-sm text-muted-foreground">com Ana Clara • até 09:00</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Próximos itens da fila</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>09:00 • Estudo do Evangelho</p>
              <p>10:30 • Vinheta Institucional</p>
              <p>11:00 • Momento Musical</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
