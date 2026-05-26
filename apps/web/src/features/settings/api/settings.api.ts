import { apiClient } from '@/lib/api-client';
import type {
  NotificationPreference,
  UpdateNotificationPreferenceInput,
} from '../types';

export const settingsApi = {
  getPreferences: () =>
    apiClient
      .get<NotificationPreference>('/api/notifications/my/preferences')
      .then((r) => r.data),

  updatePreferences: (input: UpdateNotificationPreferenceInput) =>
    apiClient
      .patch<NotificationPreference>('/api/notifications/my/preferences', input)
      .then((r) => r.data),
};
