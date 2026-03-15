import { Outlet } from 'react-router-dom';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

export function AdminLayout() {
  const { user, userEmail, updateInstitution } = useAdminAuth();

  return (
    <div className="flex min-h-screen bg-slate-100">
      <AdminSidebar />
      <div className="flex-1">
        <AdminHeader
          institution={user?.institution ?? 'Irmão Áureo'}
          onInstitutionChange={updateInstitution}
          userEmail={userEmail}
          userName={user?.name ?? 'Administrador'}
        />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
