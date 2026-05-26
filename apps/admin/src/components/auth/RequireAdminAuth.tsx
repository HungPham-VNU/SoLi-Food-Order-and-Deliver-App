import { Navigate, Outlet } from 'react-router-dom';
import { useSession, signOut } from '@/lib/auth-client';
import { useEffect } from 'react';

export function RequireAdminAuth() {
  const { data: session, isPending } = useSession();

  // If a non-admin slips through (e.g. role changed mid-session), sign them out.
  useEffect(() => {
    if (!session) return;
    const role = (session.user as any)?.role;
    if (role !== 'admin') {
      signOut();
    }
  }, [session]);

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
    return <Navigate to="/login" replace />;
  }

  const role = (session.user as any)?.role;
  if (role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
