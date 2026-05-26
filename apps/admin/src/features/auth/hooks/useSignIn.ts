import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { signIn, signOut } from '@/lib/auth-client';
import { ApiError } from '@/lib/api-client';

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
      // Reject non-admin accounts on the admin portal.
      if (role !== 'admin') {
        await signOut();
        throw new ApiError(
          403,
          'NOT_ADMIN',
          'This portal is for administrators only. Please use the restaurant portal.',
        );
      }
      return result.data;
    },
    onSuccess: () => {
      navigate('/restaurants', { replace: true });
    },
  });
}
