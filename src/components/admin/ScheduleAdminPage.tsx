import { Clock3, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { EmptyState, LoadingState } from '@/components/shared/LoadableMessage';
import { useScheduleTimeline } from '@/hooks/useRadioData';

const weekdays = [
  { label: 'Domingo', value: 'SUNDAY' },
  { label: 'Segunda-feira', value: 'MONDAY' },
  { label: 'Terça-feira', value: 'TUESDAY' },
  { label: 'Quarta-feira', value: 'WEDNESDAY' },
  { label: 'Quinta-feira', value: 'THURSDAY' },
  { label: 'Sexta-feira', value: 'FRIDAY' },
  { label: 'Sábado', value: 'SATURDAY' }
];

export function ScheduleAdminPage() {
  const [weekday, setWeekday] = useState('MONDAY');
  const { flattened, isLoading, timelineErrorMessage, nowPlaying, upNext, playbackErrorMessage } = useScheduleTimeline(weekday);

  const backendMessage = 'Não foi possível conectar ao backend. Verifique se o servidor está em execução em localhost:3333.';

  return (
    <div className="space-y-4">
      {(timelineErrorMessage || playbackErrorMessage) && (
        <EmptyState
          title="Falha ao carregar a grade & fila"
          description={backendMessage}
          tone="warning"
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select className="max-w-xs" value={weekday} onChange={(event) => setWeekday(event.target.value)}>
          {weekdays.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
        </Select>
        <Button className="gap-2">
          <Plus size={16} /> Novo Agendamento
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Timeline de programação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <LoadingState title="Carregando timeline" description="Consultando os blocos de programação do dia selecionado." />
            ) : flattened.length ? (
              flattened.map((item) => (
                <div key={item.itemId} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Clock3 size={16} className="text-primary" />
                      <p className="font-semibold">{new Date(item.startAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                      {nowPlaying?.media?.id === item.mediaId && (
                        <span className="rounded-full bg-success/20 px-2 py-0.5 text-xs text-success">No ar agora</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="gap-1"><Pencil size={14} /> Editar</Button>
                      <Button variant="ghost" size="sm" className="gap-1 text-destructive"><Trash2 size={14} /> Remover</Button>
                    </div>
                  </div>
                  <p className="mt-2 font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.blockTitle} • {item.sourceType}</p>
                </div>
              ))
            ) : (
              <EmptyState title="Nenhum programa encontrado" description="Não há itens agendados para o dia selecionado." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo da execução</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {isLoading ? (
              <LoadingState title="Carregando execução atual" compact />
            ) : (
              <>
                <div className="rounded-lg bg-primary/5 p-3">
                  <p className="text-muted-foreground">Tocando agora</p>
                  <p className="font-semibold">{nowPlaying?.media?.title ?? 'Sem conteúdo'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Próximo conteúdo</p>
                  <p className="font-medium">{upNext[0]?.title ?? '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Origem da mídia</p>
                  <p className="font-medium">{nowPlaying?.media?.sourceType ?? '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tipo</p>
                  <p className="font-medium">{nowPlaying?.media?.mediaType ?? '-'}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
