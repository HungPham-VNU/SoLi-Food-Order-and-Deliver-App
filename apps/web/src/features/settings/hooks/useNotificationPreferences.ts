import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../api/settings.api';
import type { UpdateNotificationPreferenceInput } from '../types';

const KEY = ['settings', 'notification-preferences'] as const;

export function useNotificationPreferences() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => settingsApi.getPreferences(),
    staleTime: 60_000,
  });
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateNotificationPreferenceInput) =>
      settingsApi.updatePreferences(input),
    onSuccess: (data) => {
      qc.setQueryData(KEY, data);
    },
  });
}
