import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signUp, useSession } from '@/lib/auth-client';
import { ApiError } from '@/lib/api-client';
import { trackEvent } from '@/lib/analytics';

export interface SignUpInput {
  email: string;
  password: string;
  name: string;
}

export function useSignUp() {
  const navigate = useNavigate();
  const { refetch: refetchSession } = useSession();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const signUpWithEmail = async (input: SignUpInput) => {
    setIsPending(true);
    setError(null);

    try {
      const result = await signUp.email({
        email: input.email,
        password: input.password,
        name: input.name,
      });

      if (result.error) {
        throw new ApiError(
          result.error.status ?? 400,
          result.error.code ?? 'SIGNUP_ERROR',
          result.error.message ?? 'Registration failed',
        );
      }

      trackEvent('signup_success', { method: 'email' });
      await refetchSession();
      navigate('/auth/register/business', { replace: true });

      return result.data;
    } catch (caught) {
      const nextError =
        caught instanceof Error ? caught : new Error('Registration failed');
      setError(nextError);
      trackEvent('signup_failure', {
        method: 'email',
        code: nextError instanceof ApiError ? nextError.code : 'UNKNOWN',
        status: nextError instanceof ApiError ? nextError.status : 0,
      });
      return null;
    } finally {
      setIsPending(false);
    }
  };

  return { signUpWithEmail, isPending, error };
}
