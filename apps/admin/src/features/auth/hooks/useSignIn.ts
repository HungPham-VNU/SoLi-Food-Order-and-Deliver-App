import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn, signOut, useSession } from '@/lib/auth-client';
import { ApiError } from '@/lib/api-client';

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
      // Reject non-admin accounts on the admin portal.
      if (role !== 'admin') {
        await signOut();
        throw new ApiError(
          403,
          'NOT_ADMIN',
          'This portal is for administrators only. Please use the restaurant portal.',
        );
      }

      await refetchSession();
      navigate('/restaurants', { replace: true });

      return result.data;
    } catch (caught) {
      const nextError =
        caught instanceof Error ? caught : new Error('Sign-in failed');
      setError(nextError);
      return null;
    } finally {
      setIsPending(false);
    }
  };

  return { signInWithEmail, isPending, error };
}
