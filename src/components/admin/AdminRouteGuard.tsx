import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

export function AdminRouteGuard() {
  const { isAuthenticated, isLoading, sessionType, isLocalRoot, user } = useAdminAuth();
  const location = useLocation();
  const hasLocalRootAccess = sessionType === 'local-root' || isLocalRoot === true;
  const hasFirebaseRoleAccess = sessionType === 'firebase' && (user?.role === 'admin' || user?.role === 'operador');
  const isAuthorized = hasLocalRootAccess || hasFirebaseRoleAccess;

  if (isLoading) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Carregando painel...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  if (!isAuthorized) {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{
          from: location.pathname,
          message: 'Você não possui permissão para acessar o painel administrativo.'
        }}
      />
    );
  }

  return <Outlet />;
}

export function AdminLoginRedirect() {
  const { isAuthenticated, isLoading, sessionType, isLocalRoot, user } = useAdminAuth();
  const hasLocalRootAccess = sessionType === 'local-root' || isLocalRoot === true;
  const hasFirebaseRoleAccess = sessionType === 'firebase' && (user?.role === 'admin' || user?.role === 'operador');
  const isAuthorized = hasLocalRootAccess || hasFirebaseRoleAccess;

  if (isLoading) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Carregando...</div>;
  }

  if (isAuthenticated && isAuthorized) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <Outlet />;
}
