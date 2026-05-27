import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '@/lib/auth-client';

export function RequireRestaurantAccess() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-primary text-4xl">
          progress_activity
        </span>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth/login" replace />;
  }

  const role = (session.user as any)?.role;
  if (role !== 'restaurant') {
    return <Navigate to="/pending-approval" replace />;
  }

  return <Outlet />;
}
