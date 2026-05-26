import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, type ListUsersParams, type AppRole } from '../api/users.api';

const LIST_KEY = 'admin-users';

export function useUsers(params: ListUsersParams = {}) {
  return useQuery({
    queryKey: [LIST_KEY, params],
    queryFn: () => usersApi.list(params),
  });
}

export function useSetRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AppRole }) =>
      usersApi.setRole(userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: [LIST_KEY] }),
  });
}

export function useBanUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      banReason,
      banExpiresIn,
    }: {
      userId: string;
      banReason?: string;
      banExpiresIn?: number;
    }) => usersApi.banUser(userId, banReason, banExpiresIn),
    onSuccess: () => qc.invalidateQueries({ queryKey: [LIST_KEY] }),
  });
}

export function useUnbanUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => usersApi.unbanUser(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [LIST_KEY] }),
  });
}

export function useRemoveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => usersApi.removeUser(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [LIST_KEY] }),
  });
}
