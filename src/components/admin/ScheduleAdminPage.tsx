import { useCallback, useMemo, useState } from 'react';
import { CalendarDays, Clock3, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState, LoadingState } from '@/components/shared/LoadableMessage';
import { useApiResource } from '@/hooks/useApiResource';
import { api, getApiErrorMessage } from '@/lib/api';
import { calculateQueueDuration, formatDurationSeconds, sortBlocksByStartTime } from '@/lib/schedule';
import type { AdminMediaRecord } from '@/types/media';
import type { AdminProgramRecord } from '@/types/program';
import type {
  CreateScheduleBlockPayload,
  PlaybackTimelineResponse,
  ScheduleBlockRecord,
  ScheduleDayViewResponse,
  ScheduleWeekViewResponse,
  UpdateScheduleBlockPayload
} from '@/types/schedule';
import { ScheduleBlockFormModal } from '@/components/admin/ScheduleBlockFormModal';

function toWeekStart(date: Date) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay();
  utc.setUTCDate(utc.getUTCDate() - day);
  return utc.toISOString().slice(0, 10);
}

export function ScheduleAdminPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [viewMode, setViewMode] = useState<'DAY' | 'WEEK'>('DAY');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view' | null>(null);
  const [modalBlock, setModalBlock] = useState<ScheduleBlockRecord | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const programsState = useApiResource(
    useCallback((signal: AbortSignal) => api.get<AdminProgramRecord[]>('/programs', { signal }), []),
    { initialData: [] as AdminProgramRecord[], fallbackMessage: 'Não foi possível carregar programas.' }
  );

  const mediaState = useApiResource(
    useCallback((signal: AbortSignal) => api.get<AdminMediaRecord[]>('/media', { signal }), []),
    { initialData: [] as AdminMediaRecord[], fallbackMessage: 'Não foi possível carregar mídias.' }
  );

  const dayState = useApiResource(
    useCallback(() => api.getScheduleDayView({ date: selectedDate }), [selectedDate]),
    { initialData: { date: selectedDate, blocks: [] } as ScheduleDayViewResponse, deps: [selectedDate], fallbackMessage: 'Não foi possível carregar a visão diária da grade.' }
  );

  const weekStartDate = useMemo(() => toWeekStart(new Date(`${selectedDate}T00:00:00.000Z`)), [selectedDate]);

  const weekState = useApiResource(
    useCallback(() => api.getScheduleWeekView({ weekStartDate }), [weekStartDate]),
    {
      initialData: { weekStartDate, weekEndDate: weekStartDate, days: [] } as ScheduleWeekViewResponse,
      deps: [weekStartDate],
      fallbackMessage: 'Não foi possível carregar a visão semanal da grade.'
    }
  );

  const playbackState = useApiResource(
    useCallback(() => api.getPlaybackTimeline(), []),
    {
      initialData: { now: new Date().toISOString(), current: null, next: [] } as PlaybackTimelineResponse,
      fallbackMessage: 'Não foi possível carregar o playback atual.'
    }
  );

  const selectedBlock = useMemo(() => dayState.data.blocks.find((block) => block.id === selectedBlockId) ?? null, [dayState.data.blocks, selectedBlockId]);

  const showFeedback = (tone: 'success' | 'error', message: string) => {
    setFeedback({ tone, message });
    window.setTimeout(() => setFeedback(null), 4000);
  };

  const reloadAll = async () => {
    await Promise.all([dayState.reload(), weekState.reload(), playbackState.reload()]);
  };

  const handleCreate = async (payload: CreateScheduleBlockPayload) => {
    try {
      await api.createScheduleBlock(payload);
      await reloadAll();
      showFeedback('success', 'Agendamento criado com sucesso.');
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'Não foi possível criar o agendamento.'));
    }
  };

  const handleUpdate = async (payload: UpdateScheduleBlockPayload) => {
    try {
      await api.updateScheduleBlock(payload);
      await reloadAll();
      showFeedback('success', 'Agendamento atualizado com sucesso.');
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'Não foi possível atualizar o agendamento.'));
    }
  };

  const handleDelete = async (block: ScheduleBlockRecord) => {
    const confirmed = window.confirm(`Deseja excluir o bloco "${block.title}"?`);
    if (!confirmed) return;

    try {
      await api.deleteScheduleBlock({ blockId: block.id, deleteScope: 'THIS' });
      await reloadAll();
      if (selectedBlockId === block.id) setSelectedBlockId(null);
      showFeedback('success', 'Agendamento excluído com sucesso.');
    } catch (error) {
      showFeedback('error', getApiErrorMessage(error, 'Não foi possível excluir o agendamento.'));
    }
  };

  const handleReorder = async (direction: 'up' | 'down', index: number) => {
    if (!selectedBlock) return;

    const items = [...selectedBlock.items];
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= items.length) return;

    const [moved] = items.splice(index, 1);
    items.splice(nextIndex, 0, moved);

    try {
      await api.reorderScheduleBlockItems({
        blockId: selectedBlock.id,
        items: items.map((item, idx) => ({ id: item.id, order: idx + 1 }))
      });
      await dayState.reload();
      showFeedback('success', 'Fila reordenada com sucesso.');
    } catch (error) {
      showFeedback('error', getApiErrorMessage(error, 'Não foi possível reordenar a fila do bloco.'));
    }
  };

  const dayBlocks = sortBlocksByStartTime(dayState.data.blocks);
  const isLoading = dayState.isLoading || weekState.isLoading || programsState.isLoading || mediaState.isLoading;
  const errorMessage = dayState.errorMessage || weekState.errorMessage || programsState.errorMessage || mediaState.errorMessage;

  return (
    <div className="space-y-4">
      {feedback ? <div className={`rounded-lg border px-4 py-3 text-sm ${feedback.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>{feedback.message}</div> : null}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3">
        <Input type="date" className="max-w-44" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
        <Select className="max-w-44" value={viewMode} onChange={(event) => setViewMode(event.target.value as 'DAY' | 'WEEK')}>
          <option value="DAY">Visão do Dia</option>
          <option value="WEEK">Visão da Semana</option>
        </Select>
        <Button className="gap-2" onClick={() => { setModalBlock(null); setModalMode('create'); }}>
          <Plus size={16} /> Novo Agendamento
        </Button>
      </div>

      {isLoading ? <LoadingState title="Carregando grade & fila" description="Consultando blocos, programas e mídias." /> : null}

      {!isLoading && errorMessage ? (
        <EmptyState title="Não foi possível carregar a grade" description={errorMessage} tone="warning" />
      ) : null}

      {!isLoading && !errorMessage ? (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>{viewMode === 'DAY' ? `Grade do dia ${selectedDate}` : `Semana ${weekState.data.weekStartDate} a ${weekState.data.weekEndDate}`}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {viewMode === 'DAY' ? (
                dayBlocks.length ? dayBlocks.map((block) => (
                  <div key={block.id} className={`rounded-xl border p-3 ${selectedBlockId === block.id ? 'border-primary/50 bg-primary/5' : ''}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Clock3 size={16} className="text-primary" />
                        <p className="font-semibold">{block.startTime} - {block.endTime}</p>
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{block.status}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setModalBlock(block); setModalMode('view'); }}><Eye size={14} /></Button>
                        <Button size="sm" variant="outline" onClick={() => { setModalBlock(block); setModalMode('edit'); }}><Pencil size={14} /></Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(block)}><Trash2 size={14} /></Button>
                      </div>
                    </div>
                    <button className="mt-2 text-left" onClick={() => setSelectedBlockId(block.id)}>
                      <p className="font-medium">{block.title}</p>
                      <p className="text-sm text-muted-foreground">Programa: {block.programTitle ?? 'Sem vínculo'} • Itens: {block.items.length} • Duração: {formatDurationSeconds(block.totalDurationSeconds)}</p>
                    </button>
                  </div>
                )) : <EmptyState title="Nenhum bloco para o dia" description="Crie um novo agendamento para iniciar a grade." />
              ) : (
                <div className="space-y-2">
                  {weekState.data.days.map((day) => (
                    <div key={day.date} className="rounded-lg border p-3">
                      <p className="mb-2 flex items-center gap-2 font-medium"><CalendarDays size={14} /> {day.date}</p>
                      {day.blocks.length ? day.blocks.map((block) => (
                        <p key={block.id} className="text-sm text-slate-700">{block.startTime} - {block.endTime} • {block.title} • {block.programTitle ?? 'Sem programa'} • {formatDurationSeconds(block.totalDurationSeconds)}</p>
                      )) : <p className="text-sm text-slate-500">Sem blocos neste dia.</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fila do bloco selecionado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {selectedBlock ? (
                <>
                  <div className="rounded-lg bg-primary/5 p-3">
                    <p className="font-medium">{selectedBlock.title}</p>
                    <p className="text-muted-foreground">{selectedBlock.items.length} itens • total {formatDurationSeconds(calculateQueueDuration(selectedBlock.items))}</p>
                  </div>
                  {selectedBlock.items.length ? selectedBlock.items.map((item, index) => (
                    <div key={item.id} className="rounded-lg border p-2">
                      <p className="font-medium">#{item.order} • {item.mediaTitle ?? item.itemType}</p>
                      <p className="text-xs text-muted-foreground">Tipo: {item.itemType} • Duração: {formatDurationSeconds(item.durationSeconds)} • {item.isEnabled ? 'Habilitado' : 'Desabilitado'}</p>
                      <div className="mt-2 flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => handleReorder('up', index)}>↑</Button>
                        <Button size="sm" variant="outline" onClick={() => handleReorder('down', index)}>↓</Button>
                      </div>
                    </div>
                  )) : <p className="text-slate-500">Fila vazia para este bloco.</p>}
                </>
              ) : <p className="text-slate-500">Selecione um bloco da grade para ver a fila.</p>}

              <div className="rounded-lg border border-dashed p-3">
                <p className="text-xs text-muted-foreground">Tocando agora</p>
                <p className="font-medium">{playbackState.data.current?.itemTitle ?? playbackState.data.current?.blockTitle ?? 'Sem conteúdo no ar'}</p>
                <p className="mt-2 text-xs text-muted-foreground">Próximo</p>
                <p>{playbackState.data.next[0]?.itemTitle ?? playbackState.data.next[0]?.blockTitle ?? '-'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <ScheduleBlockFormModal
        isOpen={modalMode !== null}
        mode={modalMode ?? 'create'}
        initialBlock={modalBlock}
        programs={programsState.data.map((program) => ({ id: program.id, title: program.title }))}
        mediaOptions={mediaState.data.map((media) => ({ id: media.id, title: media.title, durationSeconds: media.durationSeconds }))}
        onClose={() => setModalMode(null)}
        onSubmitCreate={handleCreate}
        onSubmitUpdate={handleUpdate}
      />
    </div>
  );
}
