import { apiFetch } from '@/src/lib/api-client';
import {
  NotificationInboxResponse,
  NotificationPreferenceResponse,
  UnreadCountResponse,
} from '../types';

export const notificationApi = {
  getInbox: (params: { limit?: number; offset?: number; unreadOnly?: boolean; type?: string } = {}) => {
    const query = new URLSearchParams(params as any).toString();
    return apiFetch<NotificationInboxResponse>(`/api/notifications/my${query ? `?${query}` : ''}`);
  },

  getUnreadCount: () => {
    return apiFetch<UnreadCountResponse>('/api/notifications/my/unread-count');
  },

  markAsRead: (id: string) => {
    return apiFetch<{ success: boolean }>(`/api/notifications/${id}/read`, {
      method: 'PATCH',
    });
  },

  markAllAsRead: () => {
    return apiFetch<{ count: number }>('/api/notifications/my/read-all', {
      method: 'PATCH',
    });
  },

  registerPushToken: (token: string, platform: 'ios' | 'android') => {
    return apiFetch<{ registered: boolean }>('/api/notifications/my/push-tokens', {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    });
  },

  deregisterPushToken: (token: string) => {
    return apiFetch<{ removed: boolean }>('/api/notifications/my/push-tokens', {
      method: 'DELETE',
      body: JSON.stringify({ token }),
    });
  },

  getPreferences: () => {
    return apiFetch<NotificationPreferenceResponse>(
      '/api/notifications/my/preferences',
    );
  },

  updatePreferences: (
    prefs: Partial<
      Pick<
        NotificationPreferenceResponse,
        | 'pushEnabled'
        | 'inAppEnabled'
        | 'emailEnabled'
        | 'smsEnabled'
        | 'mutedTypes'
        | 'quietHoursStart'
        | 'quietHoursEnd'
        | 'email'
        | 'timezone'
      >
    >,
  ) => {
    return apiFetch<NotificationPreferenceResponse>(
      '/api/notifications/my/preferences',
      { method: 'PATCH', body: JSON.stringify(prefs) },
    );
  },
};
