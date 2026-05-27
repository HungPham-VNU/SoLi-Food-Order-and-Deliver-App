import { Navigate } from 'react-router-dom';
import { useSession } from '@/lib/auth-client';
import { useMyRestaurant } from '@/features/restaurant/hooks/useRestaurants';

/**
 * Decides where to send the user after a successful login (root path `/`).
 *
 * Routing rules:
 *  - role 'restaurant'           → /dashboard
 *  - role 'user' + owns a restaurant → /pending-approval (already submitted, waiting)
 *  - role 'user' + no restaurant → /auth/register/business (first-time, e.g. via Google)
 *  - admins should land on the admin portal (port 5174); on the web portal they
 *    fall through to /pending-approval since they have no restaurant context here.
 */
export function RootRedirect() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;

  // For restaurant role we don't need to fetch anything — go straight to dashboard.
  if (role === 'restaurant') {
    return <Navigate to="/dashboard" replace />;
  }

  return <UserRoleRedirect />;
}

/**
 * Separate component so the `useMyRestaurant` hook only runs (and the request
 * only fires) for non-restaurant roles. Restaurant owners hit the dashboard
 * immediately with no extra round-trip.
 */
function UserRoleRedirect() {
  const { data: restaurant, isLoading } = useMyRestaurant();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-primary text-4xl">
          progress_activity
        </span>
      </div>
    );
  }

  if (restaurant) {
    return <Navigate to="/pending-approval" replace />;
  }

  return <Navigate to="/auth/register/business" replace />;
}
