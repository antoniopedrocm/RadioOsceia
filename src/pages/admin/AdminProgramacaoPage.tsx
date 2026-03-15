import { PageHeader } from '@/components/admin/PageHeader';
import { ScheduleTimeline } from '@/components/public/ScheduleTimeline';
import { FormSection } from '@/components/admin/FormSection';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export function AdminProgramacaoPage() {
  return <div className="space-y-4"><PageHeader title="Grade / Programação" description="Visão por dia, horário e timeline de reprodução." action="Novo agendamento" /><ScheduleTimeline /><FormSection title="Agendamento"><Input placeholder="Título do bloco" /><Select><option>Programa</option></Select><Select><option>Mídia</option></Select><Select><option>Dia</option></Select><Input type="time" /><Input type="time" /><Select><option>Prioridade</option></Select><Select><option>Repetição</option></Select><Select><option>Instituição</option></Select><Textarea placeholder="Observações" /></FormSection></div>;
}
