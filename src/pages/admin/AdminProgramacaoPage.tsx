import { PageHeader } from '@/components/admin/PageHeader';
import { ScheduleAdminPage } from '@/components/admin/ScheduleAdminPage';

export function AdminProgramacaoPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Grade & Fila"
        description="Gerencie a programação semanal com visão operacional de reprodução."
      />
      <ScheduleAdminPage />
    </div>
  );
}
