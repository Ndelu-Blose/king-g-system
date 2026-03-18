import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { isCashierAllowedPath } from '@/lib/cashier-rules';
import AppSidebar from './AppSidebar';

export default function AppLayout() {
  const { isAuthenticated, user } = useAuth();
  const { pathname } = useLocation();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user) return <Navigate to="/login" replace />;

  if (user.role === 'cashier' && !isCashierAllowedPath(pathname)) {
    return <Navigate to="/pos" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="ml-64 min-h-screen p-6">
        <Outlet />
      </main>
    </div>
  );
}
