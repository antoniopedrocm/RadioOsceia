import {
  LayoutDashboard,
  Clapperboard,
  Library,
  CalendarRange,
  Mic2,
  Settings,
  type LucideIcon
} from 'lucide-react';

export interface AdminNavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

export const adminNavItems: AdminNavItem[] = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Programas', path: '/admin/programas', icon: Clapperboard },
  { label: 'Mídias', path: '/admin/midias', icon: Library },
  { label: 'Grade & Fila', path: '/admin/programacao', icon: CalendarRange },
  { label: 'Apresentadores', path: '/admin/apresentadores', icon: Mic2 },
  { label: 'Configurações', path: '/admin/configuracoes', icon: Settings }
];
