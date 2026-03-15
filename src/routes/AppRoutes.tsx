import { Navigate, Route, Routes } from 'react-router-dom';
import { PublicLayout } from '@/layouts/PublicLayout';
import { AdminLayout } from '@/layouts/AdminLayout';
import { HomePage } from '@/pages/public/HomePage';
import { ProgramacaoPage } from '@/pages/public/ProgramacaoPage';
import { ProgramasPage } from '@/pages/public/ProgramasPage';
import { ProgramaDetalhePage } from '@/pages/public/ProgramaDetalhePage';
import { ApresentadoresPage } from '@/pages/public/ApresentadoresPage';
import { ComoOuvirPage } from '@/pages/public/ComoOuvirPage';
import { AdminLoginPage } from '@/pages/admin/AdminLoginPage';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { AdminProgramasPage } from '@/pages/admin/AdminProgramasPage';
import { AdminMidiasPage } from '@/pages/admin/AdminMidiasPage';
import { AdminProgramacaoPage } from '@/pages/admin/AdminProgramacaoPage';
import { AdminFilaPage } from '@/pages/admin/AdminFilaPage';
import { AdminApresentadoresPage } from '@/pages/admin/AdminApresentadoresPage';
import { AdminCategoriasPage } from '@/pages/admin/AdminCategoriasPage';
import { AdminInstituicoesPage } from '@/pages/admin/AdminInstituicoesPage';
import { AdminPlayerPage } from '@/pages/admin/AdminPlayerPage';
import { AdminUsuariosPage } from '@/pages/admin/AdminUsuariosPage';
import { AdminLogsPage } from '@/pages/admin/AdminLogsPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/programacao" element={<ProgramacaoPage />} />
        <Route path="/programas" element={<ProgramasPage />} />
        <Route path="/programas/:id" element={<ProgramaDetalhePage />} />
        <Route path="/apresentadores" element={<ApresentadoresPage />} />
        <Route path="/como-ouvir" element={<ComoOuvirPage />} />
      </Route>

      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="programas" element={<AdminProgramasPage />} />
        <Route path="midias" element={<AdminMidiasPage />} />
        <Route path="programacao" element={<AdminProgramacaoPage />} />
        <Route path="fila" element={<AdminFilaPage />} />
        <Route path="apresentadores" element={<AdminApresentadoresPage />} />
        <Route path="categorias" element={<AdminCategoriasPage />} />
        <Route path="instituicoes" element={<AdminInstituicoesPage />} />
        <Route path="player" element={<AdminPlayerPage />} />
        <Route path="usuarios" element={<AdminUsuariosPage />} />
        <Route path="logs" element={<AdminLogsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
