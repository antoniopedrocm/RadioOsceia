import { useCallback } from 'react';
import { useApiResource } from '@/hooks/useApiResource';
import { api } from '@/lib/api';
import { EmptyState, LoadingState } from '@/components/shared/LoadableMessage';
import type { ScheduleWeekViewResponse } from '@/types/schedule';

function getWeekStartIso() {
  const now = new Date();
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  utc.setUTCDate(utc.getUTCDate() - utc.getUTCDay());
  return utc.toISOString().slice(0, 10);
}

export function ScheduleTimeline() {
  const weekStartDate = getWeekStartIso();
  const weekState = useApiResource(
    useCallback((_signal: AbortSignal) => api.getScheduleWeekView({ weekStartDate }), [weekStartDate]),
    {
      initialData: { weekStartDate, weekEndDate: weekStartDate, days: [] } as ScheduleWeekViewResponse,
      deps: [weekStartDate],
      fallbackMessage: 'Não foi possível carregar a programação semanal.'
    }
  );

  if (weekState.isLoading) {
    return <LoadingState title="Carregando programação" description="Consultando a grade da semana." />;
  }

  if (weekState.errorMessage) {
    return <EmptyState title="Programação indisponível" description={weekState.errorMessage} tone="warning" />;
  }

  return (
    <div className="space-y-3">
      {weekState.data.days.map((day) => (
        <div key={day.date} className="rounded-lg border bg-card p-3">
          <p className="mb-2 font-semibold">{day.date}</p>
          {day.blocks.length ? day.blocks.map((item) => (
            <div key={item.id} className="mb-1 flex items-center gap-3 rounded-md border bg-white p-2 last:mb-0">
              <div className="w-24 text-sm text-muted-foreground">{item.startTime} - {item.endTime}</div>
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.programTitle ?? 'Sem programa'} • {item.status}</p>
              </div>
            </div>
          )) : <p className="text-sm text-muted-foreground">Sem programação neste dia.</p>}
        </div>
      ))}
    </div>
  );
}
