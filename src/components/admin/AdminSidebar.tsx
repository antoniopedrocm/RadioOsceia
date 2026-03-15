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
    navigate('/admin/login');
  };

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-screen flex-col border-r bg-card px-3 py-4 shadow-sm transition-all duration-200',
        collapsed ? 'w-20' : 'w-72'
      )}
    >
      <div className="mb-6 flex items-center justify-between px-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="rounded-lg bg-primary/10 p-2 text-primary">
            <Radio size={20} />
          </span>
          {!collapsed && (
            <div>
              <p className="text-xs uppercase text-muted-foreground">Admin</p>
              <h2 className="text-sm font-semibold">Rádio OSCEIA</h2>
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
                isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )
            }
          >
            <Icon size={18} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-2 border-t pt-4">
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
