import { NavLink } from 'react-router-dom';

const links = [
  ['/admin', 'Dashboard'], ['/admin/programas', 'Programas'], ['/admin/midias', 'Mídias'], ['/admin/programacao', 'Grade'], ['/admin/fila', 'Fila'],
  ['/admin/apresentadores', 'Apresentadores'], ['/admin/categorias', 'Categorias'], ['/admin/instituicoes', 'Instituições'],
  ['/admin/player', 'Player'], ['/admin/usuarios', 'Usuários'], ['/admin/logs', 'Logs']
];

export function AdminSidebar() {
  return (
    <aside className="w-64 border-r bg-card p-4">
      <h2 className="mb-4 font-semibold">Painel Administrativo</h2>
      <nav className="space-y-1">
        {links.map(([to, label]) => <NavLink key={to} to={to} className={({isActive}) => `block rounded-md px-3 py-2 text-sm ${isActive ? 'bg-primary text-primary-foreground':'hover:bg-accent'}`}>{label}</NavLink>)}
      </nav>
    </aside>
  );
}
