import { useQuery } from '@tanstack/react-query';
import { notificationApi } from '../api';
import { useNotificationStore } from '@/src/store/notification-store';
import { useEffect } from 'react';

export function useNotificationInbox(params: { limit?: number; offset?: number; unreadOnly?: boolean } = {}) {
  const { setItems, setUnreadCount, setLoaded } = useNotificationStore();

  const query = useQuery({
    queryKey: ['notifications', 'inbox', params],
    queryFn: () => notificationApi.getInbox(params),
  });

  useEffect(() => {
    if (query.data) {
      setItems(query.data.items);
      setUnreadCount(query.data.unreadCount);
      setLoaded(true);
    }
  }, [query.data, setItems, setUnreadCount, setLoaded]);

  return query;
}

export function useUnreadCount() {
  const { setUnreadCount } = useNotificationStore();

  const query = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationApi.getUnreadCount(),
    refetchInterval: 60000, // Poll every minute as fallback
  });

  useEffect(() => {
    if (query.data) {
      setUnreadCount(query.data.count);
    }
  }, [query.data, setUnreadCount]);

  return query;
}
