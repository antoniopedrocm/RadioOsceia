import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, Radio, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PublicHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const links = [
    ['/', 'Início'], ['/programacao', 'Programação'], ['/programas', 'Programas'], ['/apresentadores', 'Apresentadores'], ['/como-ouvir', 'Como ouvir']
  ];

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 font-semibold"><Radio className="h-5 w-5 text-primary" /> Rádio Institucional</div>

        <div className="hidden items-center gap-3 md:flex">
          <nav className="flex gap-4 text-sm">
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}>{label}</NavLink>
            ))}
          </nav>
          <NavLink to="/admin/login">
            <Button size="sm">Acesso Restrito</Button>
          </NavLink>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="md:hidden"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          aria-label={isMobileMenuOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {isMobileMenuOpen && (
        <div className="border-t bg-background px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-2 text-sm">
            {links.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                onClick={closeMobileMenu}
                className={({ isActive }) => isActive ? 'rounded-md bg-primary/10 px-3 py-2 font-medium text-primary' : 'rounded-md px-3 py-2 text-muted-foreground hover:bg-accent hover:text-foreground'}
              >
                {label}
              </NavLink>
            ))}
            <NavLink to="/admin/login" onClick={closeMobileMenu} className="mt-1">
              <Button className="w-full">Acesso Restrito</Button>
            </NavLink>
          </nav>
        </div>
      )}
    </header>
  );
}
