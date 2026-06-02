import { signIn, signUp, signOut, authClient } from '@/src/lib/auth-client';
import type { SignInFormData, SignUpFormData } from '../types';

type SignOutOptions = Parameters<typeof signOut>[0];

export const authApi = {
  signIn: async (data: SignInFormData) => {
    return await signIn.email({
      email: data.email,
      password: data.password,
    });
  },

  signUp: async (data: SignUpFormData) => {
    return await signUp.email({
      email: data.email,
      password: data.password,
      name: data.fullName,
      phoneNumber: data.phone,
    });
  },

  sendOtp: async (phoneNumber: string) => {
    return await authClient.phoneNumber.sendOtp({
      phoneNumber,
    });
  },

  verifyOtp: async (phoneNumber: string, code: string) => {
    return await authClient.phoneNumber.verify({
      phoneNumber,
      code,
    });
  },

  signInWithGoogle: async () => {
    return await signIn.social({
      provider: 'google',
    });
  },

  signOut: async (options?: SignOutOptions) => {
    return await signOut(options);
  },
};
