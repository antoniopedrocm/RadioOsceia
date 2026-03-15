import { useEffect, useState } from 'react';
import { Activity, CalendarCheck2, Clapperboard, Library } from 'lucide-react';
import { DashboardStatCard } from '@/components/admin/DashboardStatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import type { DashboardSummary } from '@/types/api';

export function AdminDashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    api.get<DashboardSummary>('/dashboard/summary').then(setSummary).catch(() => setSummary(null));
  }, []);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard title="Total de programas" value={String(summary?.programs ?? '-')} icon={Clapperboard} trend="Dados reais" />
        <DashboardStatCard title="Total de mídias" value={String(summary?.media ?? '-')} icon={Library} trend="Dados reais" />
        <DashboardStatCard title="Conteúdo no ar" value={summary?.nowPlaying ? '01' : '00'} icon={Activity} trend={summary?.nowPlaying ? 'Transmissão ativa' : 'Sem conteúdo'} />
        <DashboardStatCard title="Agendamentos do dia" value={String(summary?.scheduledToday ?? '-')} icon={CalendarCheck2} trend="Dados reais" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Resumo operacional</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">Esta área está preparada para gráficos futuros. Os cards acima e a coluna lateral já usam dados reais da API.</div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>No ar agora</CardTitle></CardHeader>
            <CardContent>
              <p className="font-semibold">{summary?.nowPlaying?.title ?? 'Sem conteúdo no ar'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Próximos itens da fila</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {summary?.upNext?.length ? summary.upNext.map((item) => <p key={item.id}>{item.startTime} • {item.title}</p>) : <p className="text-muted-foreground">Sem itens</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
