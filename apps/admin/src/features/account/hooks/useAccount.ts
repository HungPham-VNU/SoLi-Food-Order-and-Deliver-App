import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authClient } from '@/lib/auth-client';
import { ApiError } from '@/lib/api-client';

export interface UpdateProfileInput {
  name?: string;
  image?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  revokeOtherSessions?: boolean;
}

/**
 * Updates the current admin's profile (name + avatar URL).
 * Backed by better-auth's `updateUser` endpoint, which is callable by any
 * authenticated user against their own account.
 */
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      const { data, error } = await (authClient as any).updateUser(input);
      if (error) {
        throw new ApiError(
          error.status ?? 400,
          error.code ?? 'UPDATE_PROFILE_FAILED',
          error.message ?? 'Failed to update profile',
        );
      }
      return data;
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}

/**
 * Changes the current admin's password. Uses better-auth's `changePassword`.
 * `revokeOtherSessions: true` forces a re-login on every other device.
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: async (input: ChangePasswordInput) => {
      const { data, error } = await (authClient as any).changePassword(input);
      if (error) {
        throw new ApiError(
          error.status ?? 400,
          error.code ?? 'CHANGE_PASSWORD_FAILED',
          error.message ?? 'Failed to change password',
        );
      }
      return data;
    },
  });
}
