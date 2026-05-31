import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationInboxResponse {
  items: NotificationItem[];
  total: number;
  unreadCount: number;
}

export function useInbox() {
  return useQuery<NotificationInboxResponse>({
    queryKey: ['notifications', 'inbox'],
    queryFn: async () => {
      const res = await apiClient.get<NotificationInboxResponse>('/api/notifications/my?limit=5');
      return res.data;
    },
    refetchInterval: 15_000,
  });
}
