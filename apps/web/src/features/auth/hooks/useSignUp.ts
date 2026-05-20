import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { signUp } from '@/lib/auth-client';
import { ApiError } from '@/lib/api-client';

export interface SignUpInput {
  email: string;
  password: string;
  name: string;
}

export function useSignUp() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (input: SignUpInput) => {
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
      return result.data;
    },
    onSuccess: () => {
      navigate('/auth/register/business');
    },
  });
}
