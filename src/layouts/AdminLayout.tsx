import { Outlet } from 'react-router-dom';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { useInstitution } from '@/hooks/useInstitution';

export function AdminLayout() {
  const { institution, setInstitution } = useInstitution();
  return (
    <div className="flex min-h-screen bg-muted/30">
      <AdminSidebar />
      <div className="flex-1">
        <AdminHeader institution={institution} onInstitutionChange={setInstitution} />
        <main className="p-5"><Outlet /></main>
      </div>
    </div>
  );
}
