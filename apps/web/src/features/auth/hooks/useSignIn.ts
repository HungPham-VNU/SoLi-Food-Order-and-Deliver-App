import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn, signOut, useSession } from '@/lib/auth-client';
import { ApiError } from '@/lib/api-client';
import { identifyUser, trackEvent } from '@/lib/analytics';
import { setObservabilityUser, pushObservabilityEvent } from '@/lib/observability';

export interface SignInInput {
  email: string;
  password: string;
}

export function useSignIn() {
  const navigate = useNavigate();
  const { refetch: refetchSession } = useSession();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const signInWithEmail = async (input: SignInInput) => {
    setIsPending(true);
    setError(null);

    try {
      const result = await signIn.email({
        email: input.email,
        password: input.password,
      });

      if (result.error) {
        throw new ApiError(
          result.error.status ?? 401,
          result.error.code ?? 'AUTH_ERROR',
          result.error.message ?? 'Invalid credentials',
        );
      }

      const role = (result.data?.user as any)?.role;
      // Admin accounts belong on the admin portal; refuse and sign out.
      if (role === 'admin') {
        await signOut();
        throw new ApiError(
          403,
          'ADMIN_USE_ADMIN_PORTAL',
          'Admin accounts must sign in via the admin portal.',
        );
      }

      trackEvent('login_success', { method: 'email' });
      pushObservabilityEvent('user.sign_in', { method: 'credentials' });
      if (result.data?.user?.id) {
        identifyUser(result.data.user.id);
        setObservabilityUser(result.data.user.id);
      }
      await refetchSession();
      navigate('/auth/onboarding', { replace: true });

      return result.data;
    } catch (caught) {
      const nextError =
        caught instanceof Error ? caught : new Error('Sign-in failed');
      setError(nextError);
      trackEvent('login_failure', {
        method: 'email',
        code: nextError instanceof ApiError ? nextError.code : 'UNKNOWN',
        status: nextError instanceof ApiError ? nextError.status : 0,
      });
      return null;
    } finally {
      setIsPending(false);
    }
  };

  return { signInWithEmail, isPending, error };
}
