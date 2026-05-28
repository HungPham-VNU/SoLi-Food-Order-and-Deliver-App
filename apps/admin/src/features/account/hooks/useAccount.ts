import { useState } from 'react';
import { authClient, useSession } from '@/lib/auth-client';
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

function toApiError(
  error: { status?: number; code?: string; message?: string },
  fallbackCode: string,
  fallbackMessage: string,
) {
  return new ApiError(
    error.status ?? 400,
    error.code ?? fallbackCode,
    error.message ?? fallbackMessage,
  );
}

function toError(caught: unknown, fallbackMessage: string) {
  return caught instanceof Error ? caught : new Error(fallbackMessage);
}

/**
 * Updates the current admin's profile (name + avatar URL).
 * Backed by better-auth's `updateUser` endpoint, which is callable by any
 * authenticated user against their own account.
 */
export function useUpdateProfile() {
  const { refetch: refetchSession } = useSession();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutateAsync = async (input: UpdateProfileInput) => {
    setIsPending(true);
    setError(null);

    try {
      const { data, error: updateError } = await (authClient as any).updateUser(
        input,
      );
      if (updateError) {
        throw toApiError(
          updateError,
          'UPDATE_PROFILE_FAILED',
          'Failed to update profile',
        );
      }

      await refetchSession();
      return data;
    } catch (caught) {
      const nextError = toError(caught, 'Failed to update profile');
      setError(nextError);
      throw nextError;
    } finally {
      setIsPending(false);
    }
  };

  const mutate = (input: UpdateProfileInput) => {
    void mutateAsync(input).catch(() => undefined);
  };

  return { mutate, mutateAsync, isPending, error };
}

/**
 * Changes the current admin's password. Uses better-auth's `changePassword`.
 * `revokeOtherSessions: true` forces a re-login on every other device.
 */
export function useChangePassword() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutateAsync = async (input: ChangePasswordInput) => {
    setIsPending(true);
    setError(null);

    try {
      const { data, error: passwordError } =
        await (authClient as any).changePassword(input);
      if (passwordError) {
        throw toApiError(
          passwordError,
          'CHANGE_PASSWORD_FAILED',
          'Failed to change password',
        );
      }

      return data;
    } catch (caught) {
      const nextError = toError(caught, 'Failed to change password');
      setError(nextError);
      throw nextError;
    } finally {
      setIsPending(false);
    }
  };

  const mutate = (input: ChangePasswordInput) => {
    void mutateAsync(input).catch(() => undefined);
  };

  return { mutate, mutateAsync, isPending, error };
}
