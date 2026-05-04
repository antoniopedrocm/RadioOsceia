import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type {
  CreateScheduleBlockPayload,
  QueueItemType,
  ScheduleBlockRecord,
  ScheduleRecurrenceType,
  UpdateScheduleBlockPayload
} from '@/types/schedule';

export interface ProgramOption {
  id: string;
  title: string;
}

export interface MediaOption {
  id: string;
  title: string;
  programId?: string | null;
  durationSeconds?: number | null;
}

interface LocalItem {
  id?: string;
  itemType: QueueItemType;
  mediaId?: string | null;
  durationSeconds: number;
  notes?: string | null;
  isEnabled: boolean;
}

interface ScheduleBlockFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit' | 'view';
  initialBlock?: ScheduleBlockRecord | null;
  programs: ProgramOption[];
  mediaOptions: MediaOption[];
  onClose: () => void;
  onSubmitCreate?: (payload: CreateScheduleBlockPayload) => Promise<void>;
  onSubmitUpdate?: (payload: UpdateScheduleBlockPayload) => Promise<void>;
}

const weekdayOptions = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' }
];

export function ScheduleBlockFormModal({
  isOpen,
  mode,
  initialBlock,
  programs,
  mediaOptions,
  onClose,
  onSubmitCreate,
  onSubmitUpdate
}: ScheduleBlockFormModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:00');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | 'CANCELLED'>('ACTIVE');
  const [programId, setProgramId] = useState('');
  const [recurrenceType, setRecurrenceType] = useState<ScheduleRecurrenceType>('NONE');
  const [byWeekDays, setByWeekDays] = useState<number[]>([]);
  const [items, setItems] = useState<LocalItem[]>([]);
  const [autoFilledProgramId, setAutoFilledProgramId] = useState('');
  const [applyScope, setApplyScope] = useState<'THIS' | 'THIS_AND_FUTURE' | 'ALL_IN_GROUP'>('THIS');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isReadOnly = mode === 'view';

  useEffect(() => {
    if (!isOpen) return;

    if (initialBlock) {
      setTitle(initialBlock.title ?? '');
      setDescription(initialBlock.description ?? '');
      setDate(initialBlock.date);
      setStartTime(initialBlock.startTime);
      setEndTime(initialBlock.endTime);
      setStatus(initialBlock.status);
      setProgramId(initialBlock.programId ?? '');
      setRecurrenceType(initialBlock.recurrenceType ?? 'NONE');
      setByWeekDays([]);
      setItems(initialBlock.items.map((item) => ({
        id: item.id,
        itemType: item.itemType,
        mediaId: item.mediaId ?? '',
        durationSeconds: item.durationSeconds,
        notes: item.notes ?? '',
        isEnabled: item.isEnabled
      })));
      setAutoFilledProgramId('');
    } else {
      setTitle('');
      setDescription('');
      setDate(new Date().toISOString().slice(0, 10));
      setStartTime('08:00');
      setEndTime('09:00');
      setStatus('ACTIVE');
      setProgramId('');
      setRecurrenceType('NONE');
      setByWeekDays([]);
      setItems([]);
      setAutoFilledProgramId('');
    }

    setApplyScope('THIS');
    setFormError(null);
  }, [isOpen, initialBlock]);

  const mediaMap = useMemo(() => new Map(mediaOptions.map((media) => [media.id, media])), [mediaOptions]);
  const programMediaOptions = useMemo(
    () => mediaOptions.filter((media) => media.programId && media.programId === programId),
    [mediaOptions, programId]
  );

  useEffect(() => {
    if (!isOpen || isReadOnly || !programId || items.length > 0 || autoFilledProgramId === programId || !programMediaOptions.length) {
      return;
    }

    setItems(programMediaOptions.map((media) => ({
      itemType: 'MEDIA',
      mediaId: media.id,
      durationSeconds: media.durationSeconds && media.durationSeconds > 0 ? media.durationSeconds : 30,
      notes: '',
      isEnabled: true
    })));
    setAutoFilledProgramId(programId);
  }, [autoFilledProgramId, isOpen, isReadOnly, items.length, programId, programMediaOptions]);

  if (!isOpen) return null;

  const addItem = () => {
    setItems((current) => ([...current, {
      itemType: 'MEDIA',
      mediaId: '',
      durationSeconds: 30,
      notes: '',
      isEnabled: true
    }]));
  };

  const moveItem = (from: number, to: number) => {
    setItems((current) => {
      if (to < 0 || to >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (isReadOnly) {
      onClose();
      return;
    }

    if (!title.trim()) {
      setFormError('Informe o título do agendamento.');
      return;
    }

    if (endTime <= startTime) {
      setFormError('O horário final deve ser maior que o horário inicial.');
      return;
    }

    if (items.some((item) => Number(item.durationSeconds) <= 0)) {
      setFormError('Todos os itens devem possuir duração maior que zero.');
      return;
    }

    const normalizedItems = items.map((item, index) => ({
      id: item.id,
      itemType: item.itemType,
      mediaId: item.mediaId || null,
      durationSeconds: Number(item.durationSeconds),
      notes: item.notes || null,
      isEnabled: item.isEnabled,
      order: index + 1
    }));

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (mode === 'create' && onSubmitCreate) {
        await onSubmitCreate({
          title: title.trim(),
          description: description.trim() || null,
          date,
          startTime,
          endTime,
          programId: programId || null,
          recurrenceType,
          recurrenceRule: recurrenceType === 'WEEKLY' ? { byWeekDays, interval: 1, count: 26 } : null,
          items: normalizedItems.map(({ order: _order, ...item }) => item)
        });
      }

      if (mode === 'edit' && onSubmitUpdate && initialBlock) {
        await onSubmitUpdate({
          blockId: initialBlock.id,
          applyScope,
          title: title.trim(),
          description: description.trim() || null,
          date,
          startTime,
          endTime,
          programId: programId || null,
          status,
          items: normalizedItems
        });
      }

      onClose();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Falha ao salvar agendamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-xl bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {mode === 'create' ? 'Novo agendamento' : mode === 'edit' ? 'Editar agendamento' : 'Visualizar agendamento'}
          </h2>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Input placeholder="Título" value={title} onChange={(event) => setTitle(event.target.value)} disabled={isReadOnly || isSubmitting} />
          <Input placeholder="Data" type="date" value={date} onChange={(event) => setDate(event.target.value)} disabled={isReadOnly || isSubmitting} />
          <Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} disabled={isReadOnly || isSubmitting} />
          <Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} disabled={isReadOnly || isSubmitting} />
          <Select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} disabled={isReadOnly || isSubmitting}>
            <option value="ACTIVE">Ativo</option>
            <option value="INACTIVE">Inativo</option>
            <option value="CANCELLED">Cancelado</option>
          </Select>
          <Select value={programId} onChange={(event) => setProgramId(event.target.value)} disabled={isReadOnly || isSubmitting}>
            <option value="">Sem programa vinculado</option>
            {programs.map((program) => <option key={program.id} value={program.id}>{program.title}</option>)}
          </Select>
          <Select value={recurrenceType} onChange={(event) => setRecurrenceType(event.target.value as ScheduleRecurrenceType)} disabled={mode !== 'create' || isReadOnly || isSubmitting}>
            <option value="NONE">Sem recorrência</option>
            <option value="DAILY">Diária</option>
            <option value="WEEKLY">Semanal</option>
          </Select>
          {mode === 'edit' ? (
            <Select value={applyScope} onChange={(event) => setApplyScope(event.target.value as typeof applyScope)} disabled={isReadOnly || isSubmitting}>
              <option value="THIS">Somente este bloco</option>
              <option value="THIS_AND_FUTURE">Este e futuros</option>
              <option value="ALL_IN_GROUP">Toda a série</option>
            </Select>
          ) : null}
        </div>

        {recurrenceType === 'WEEKLY' ? (
          <div className="mt-3 rounded-md border p-3">
            <p className="mb-2 text-sm font-medium">Dias da semana</p>
            <div className="flex flex-wrap gap-2">
              {weekdayOptions.map((weekday) => {
                const selected = byWeekDays.includes(weekday.value);
                return (
                  <Button
                    key={weekday.value}
                    size="sm"
                    variant={selected ? 'default' : 'outline'}
                    disabled={isReadOnly || isSubmitting}
                    onClick={() => setByWeekDays((current) => selected ? current.filter((item) => item !== weekday.value) : [...current, weekday.value])}
                  >
                    {weekday.label}
                  </Button>
                );
              })}
            </div>
          </div>
        ) : null}

        <Textarea className="mt-3" placeholder="Descrição" value={description} onChange={(event) => setDescription(event.target.value)} disabled={isReadOnly || isSubmitting} />

        <div className="mt-4 space-y-2 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <p className="font-medium">Itens da fila</p>
            {!isReadOnly ? <Button size="sm" onClick={addItem}>Adicionar item</Button> : null}
          </div>

          {!items.length ? <p className="text-sm text-slate-500">Fila vazia para este bloco.</p> : null}

          {items.map((item, index) => (
            <div key={`${item.id ?? 'new'}-${index}`} className="grid gap-2 rounded-md border p-2 md:grid-cols-6">
              <Select value={item.itemType} onChange={(event) => setItems((current) => current.map((it, idx) => idx === index ? { ...it, itemType: event.target.value as QueueItemType } : it))} disabled={isReadOnly || isSubmitting}>
                <option value="MEDIA">Mídia</option>
                <option value="PROGRAM_HEADER">Cabeçalho</option>
                <option value="BREAK">Intervalo</option>
                <option value="MANUAL">Manual</option>
              </Select>
              <Select value={item.mediaId ?? ''} onChange={(event) => {
                const selected = mediaMap.get(event.target.value);
                setItems((current) => current.map((it, idx) => idx === index ? {
                  ...it,
                  mediaId: event.target.value,
                  durationSeconds: selected?.durationSeconds && selected.durationSeconds > 0 ? selected.durationSeconds : it.durationSeconds
                } : it));
              }} disabled={isReadOnly || isSubmitting}>
                <option value="">Sem mídia</option>
                {mediaOptions.map((media) => <option key={media.id} value={media.id}>{media.title}</option>)}
              </Select>
              <Input type="number" min={1} value={item.durationSeconds} onChange={(event) => setItems((current) => current.map((it, idx) => idx === index ? { ...it, durationSeconds: Number(event.target.value) } : it))} disabled={isReadOnly || isSubmitting} />
              <Input value={item.notes ?? ''} onChange={(event) => setItems((current) => current.map((it, idx) => idx === index ? { ...it, notes: event.target.value } : it))} placeholder="Observação" disabled={isReadOnly || isSubmitting} />
              <Select value={item.isEnabled ? '1' : '0'} onChange={(event) => setItems((current) => current.map((it, idx) => idx === index ? { ...it, isEnabled: event.target.value === '1' } : it))} disabled={isReadOnly || isSubmitting}>
                <option value="1">Habilitado</option>
                <option value="0">Desabilitado</option>
              </Select>
              {!isReadOnly ? (
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => moveItem(index, index - 1)}>↑</Button>
                  <Button size="sm" variant="outline" onClick={() => moveItem(index, index + 1)}>↓</Button>
                  <Button size="sm" variant="ghost" onClick={() => setItems((current) => current.filter((_, idx) => idx !== index))}>Remover</Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {formError ? <p className="mt-3 text-sm text-red-600">{formError}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>{mode === 'view' ? 'Fechar' : isSubmitting ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </div>
    </div>
  );
}
