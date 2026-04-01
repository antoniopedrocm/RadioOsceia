import { Outlet } from 'react-router-dom';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

export function AdminLayout() {
  const { user, userEmail } = useAdminAuth();

  return (
    <div className="flex min-h-screen bg-slate-100">
      <AdminSidebar />
      <div className="flex-1">
        <AdminHeader
          userEmail={userEmail}
          userName={user?.name ?? 'Administrador'}
          authSource={user?.authSource}
        />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
