import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '@/lib/auth-client';
import { useMyRestaurant } from '@/features/restaurant/hooks/useRestaurants';

/**
 * Resolves the user's persisted restaurant-onboarding state.
 *
 * Routing rules:
 *  - role 'restaurant'           → /dashboard
 *  - role 'user' + owns a restaurant → /pending-approval (already submitted, waiting)
 *  - role 'user' + no restaurant → /auth/register/business (first-time, e.g. via Google)
 */
export function RootRedirect({
  unauthenticatedTo = '/auth/login',
}: {
  unauthenticatedTo?: '/auth/login' | '/auth/register';
}) {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <OnboardingLoading />;
  }

  if (!session) {
    return <Navigate to={unauthenticatedTo} replace />;
  }

  const role = (session.user as any)?.role;

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
  const { data: restaurant, isLoading, isError, refetch } = useMyRestaurant();

  if (isLoading) {
    return <OnboardingLoading />;
  }

  if (isError) {
    return <OnboardingLoadError onRetry={() => void refetch()} />;
  }

  if (restaurant) {
    return <Navigate to="/pending-approval" replace />;
  }

  return <Navigate to="/auth/register/business" replace />;
}

type OnboardingStep = 'business' | 'pending';

const onboardingStepPaths: Record<OnboardingStep, string> = {
  business: '/auth/register/business',
  pending: '/pending-approval',
};

/**
 * Keeps bookmarked and refreshed onboarding URLs aligned with server state.
 */
export function RequireOnboardingStep({ step }: { step: OnboardingStep }) {
  const { data: session, isPending: isSessionPending } = useSession();
  const {
    data: restaurant,
    isLoading: isRestaurantLoading,
    isError,
    refetch,
  } = useMyRestaurant();
  const role = (session?.user as any)?.role;

  if (
    isSessionPending ||
    (!!session && role !== 'restaurant' && isRestaurantLoading)
  ) {
    return <OnboardingLoading />;
  }

  if (!session) {
    return <Navigate to="/auth/login" replace />;
  }

  if (role === 'restaurant') {
    return <Navigate to="/dashboard" replace />;
  }

  if (isError) {
    return <OnboardingLoadError onRetry={() => void refetch()} />;
  }

  const currentStepPath = restaurant
    ? onboardingStepPaths.pending
    : onboardingStepPaths.business;

  if (currentStepPath !== onboardingStepPaths[step]) {
    return <Navigate to={currentStepPath} replace />;
  }

  return <Outlet />;
}

function OnboardingLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="material-symbols-outlined animate-spin text-primary text-4xl">
        progress_activity
      </span>
    </div>
  );
}

function OnboardingLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm text-destructive">
        We couldn't restore your restaurant setup progress.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
      >
        Try again
      </button>
    </div>
  );
}
