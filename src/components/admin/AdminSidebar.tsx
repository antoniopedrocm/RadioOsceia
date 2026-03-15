import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LogOut, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminNavItems } from '@/components/admin/adminNavigation';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { cn } from '@/lib/utils';

export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const { logout } = useAdminAuth();

  const onLogout = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-screen flex-col border-r border-slate-200 bg-white px-3 py-4 shadow-sm transition-all duration-200',
        collapsed ? 'w-20' : 'w-72'
      )}
    >
      <div className="mb-6 flex items-center justify-between px-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="rounded-lg bg-blue-100 p-2 text-blue-700">
            <Radio size={20} />
          </span>
          {!collapsed && (
            <div>
              <p className="text-xs uppercase text-slate-500">Admin</p>
              <h2 className="text-sm font-semibold text-slate-800">Rádio OSCEIA</h2>
            </div>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setCollapsed((value) => !value)}>
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </Button>
      </div>

      <nav className="flex-1 space-y-1">
        {adminNavItems.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )
            }
          >
            <Icon size={18} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-2 border-t border-slate-200 pt-4">
        <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/')}>
          <Radio size={16} />
          {!collapsed && 'Site Público'}
        </Button>
        <Button variant="ghost" className="w-full justify-start gap-2 text-destructive hover:bg-destructive/10" onClick={onLogout}>
          <LogOut size={16} />
          {!collapsed && 'Sair'}
        </Button>
      </div>
    </aside>
  );
}
