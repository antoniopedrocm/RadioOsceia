import { ScheduleTimeline } from '@/components/public/ScheduleTimeline';
import { FilterBar } from '@/components/admin/FilterBar';

export function ProgramacaoPage() {
  return <div className="space-y-4"><h1 className="text-2xl font-semibold">Programação semanal</h1><FilterBar /><ScheduleTimeline /></div>;
}
