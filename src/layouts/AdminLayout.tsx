import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import type { Institution } from '@/types';

export function AdminLayout() {
  const [institution, setInstitution] = useState<Institution>('Irmão Áureo');
  const { userEmail } = useAdminAuth();

  return (
    <div className="flex min-h-screen bg-muted/30">
      <AdminSidebar />
      <div className="flex-1">
        <AdminHeader institution={institution} onInstitutionChange={setInstitution} userEmail={userEmail} />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
