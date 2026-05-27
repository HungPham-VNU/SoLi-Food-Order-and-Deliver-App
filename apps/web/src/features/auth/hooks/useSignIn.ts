import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { signIn, signOut } from '@/lib/auth-client';
import { ApiError } from '@/lib/api-client';
import { identifyUser, trackEvent } from '@/lib/analytics';
import { Sentry } from '@/lib/observability';

export interface SignInInput {
  email: string;
  password: string;
}

export function useSignIn() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (input: SignInInput) => {
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
      // Admin accounts belong on the admin portal — refuse and sign out.
      if (role === 'admin') {
        await signOut();
        throw new ApiError(
          403,
          'ADMIN_USE_ADMIN_PORTAL',
          'Admin accounts must sign in via the admin portal.',
        );
      }
      return result.data;
    },
    onSuccess: (session) => {
      trackEvent('login_success', { method: 'email' });
      if (session?.user?.id) {
        identifyUser(session.user.id);
        Sentry.setUser({ id: session.user.id });
      }
      navigate('/dashboard');
    },
    onError: (error) => {
      trackEvent('login_failure', {
        method: 'email',
        code: error instanceof ApiError ? error.code : 'UNKNOWN',
        status: error instanceof ApiError ? error.status : 0,
      });
    },
  });
}
