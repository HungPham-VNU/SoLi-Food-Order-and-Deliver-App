import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { signIn } from '@/lib/auth-client';
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
      return result.data;
    },
    onSuccess: () => {
      navigate('/dashboard');
    },
  });
}
