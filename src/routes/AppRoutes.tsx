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
import { AdminApresentadoresPage } from '@/pages/admin/AdminApresentadoresPage';
import { AdminConfiguracoesPage } from '@/pages/admin/AdminConfiguracoesPage';
import { AdminLoginRedirect, AdminRouteGuard } from '@/components/admin/AdminRouteGuard';

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

      <Route path="/admin" element={<AdminLoginRedirect />}>
        <Route path="login" element={<AdminLoginPage />} />
      </Route>

      <Route path="/admin" element={<AdminRouteGuard />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="programas" element={<AdminProgramasPage />} />
          <Route path="midias" element={<AdminMidiasPage />} />
          <Route path="programacao" element={<AdminProgramacaoPage />} />
          <Route path="apresentadores" element={<AdminApresentadoresPage />} />
          <Route path="configuracoes" element={<AdminConfiguracoesPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
