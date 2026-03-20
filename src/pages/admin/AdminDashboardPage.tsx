import { Activity, CalendarCheck2, Clapperboard, Library } from 'lucide-react';
import { DashboardStatCard } from '@/components/admin/DashboardStatCard';
import { EmptyState, LoadingState } from '@/components/shared/LoadableMessage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDashboardSummary } from '@/hooks/useRadioData';

export function AdminDashboardPage() {
  const { data: summary, isLoading, errorMessage } = useDashboardSummary();

  return (
    <div className="space-y-5">
      {errorMessage && (
        <EmptyState
          title="Não foi possível conectar ao backend"
          description="Verifique se o servidor está em execução em localhost:3333. O painel continuará acessível, mas exibirá estados vazios até a API responder."
          tone="warning"
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard title="Total de programas" value={isLoading ? '...' : String(summary.programs ?? 0)} icon={Clapperboard} trend={errorMessage ? 'Aguardando backend' : 'Dados reais'} />
        <DashboardStatCard title="Total de mídias" value={isLoading ? '...' : String(summary.media ?? 0)} icon={Library} trend={errorMessage ? 'Aguardando backend' : 'Dados reais'} />
        <DashboardStatCard title="Conteúdo no ar" value={summary.nowPlaying ? '01' : '00'} icon={Activity} trend={summary.nowPlaying ? 'Transmissão ativa' : 'Sem conteúdo'} />
        <DashboardStatCard title="Agendamentos do dia" value={isLoading ? '...' : String(summary.scheduledToday ?? 0)} icon={CalendarCheck2} trend={errorMessage ? 'Aguardando backend' : 'Dados reais'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Resumo operacional</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingState title="Carregando resumo" description="Consultando os indicadores operacionais da rádio." compact />
            ) : (
              <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">Esta área está preparada para gráficos futuros. Os cards acima e a coluna lateral já usam dados reais da API.</div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>No ar agora</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <LoadingState title="Carregando status da transmissão" compact />
              ) : summary.nowPlaying ? (
                <p className="font-semibold">{summary.nowPlaying.title}</p>
              ) : (
                <EmptyState title="Sem conteúdo no ar" description="Nenhuma transmissão ativa foi informada pela API." compact />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Próximos itens da fila</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {isLoading ? (
                <LoadingState title="Carregando fila" compact />
              ) : summary.upNext.length ? (
                summary.upNext.map((item) => <p key={item.id}>{item.startTime} • {item.title}</p>)
              ) : (
                <EmptyState title="Sem itens" description="Nenhum próximo item foi retornado pelo backend." compact />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
