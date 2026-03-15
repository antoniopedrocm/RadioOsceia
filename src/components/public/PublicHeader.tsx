import { NavLink } from 'react-router-dom';
import { Radio } from 'lucide-react';

export function PublicHeader() {
  const links = [
    ['/', 'Início'], ['/programacao', 'Programação'], ['/programas', 'Programas'], ['/apresentadores', 'Apresentadores'], ['/como-ouvir', 'Como ouvir']
  ];
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 font-semibold"><Radio className="h-5 w-5 text-primary" /> Rádio Institucional</div>
        <nav className="flex gap-4 text-sm">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}>{label}</NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
