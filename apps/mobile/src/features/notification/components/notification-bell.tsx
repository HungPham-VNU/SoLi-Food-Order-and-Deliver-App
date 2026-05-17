import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useNotificationStore } from '@/src/store/notification-store';

interface NotificationBellProps {
  size?: number;
  color?: string;
}

export function NotificationBell({
  size = 24,
  color = '#0d631b',
}: NotificationBellProps) {
  const router = useRouter();
  const unreadCount = useNotificationStore((state) => state.unreadCount);

  return (
    <TouchableOpacity
      onPress={() => router.push('/notifications')}
      className="relative p-2"
    >
      <Bell size={size} color={color} />
      {unreadCount > 0 && (
        <View
          className="absolute top-1 right-1 bg-red-500 rounded-full min-w-[18px] h-[18px] items-center justify-center px-1"
          style={{ borderWidth: 2, borderColor: 'white' }}
        >
          <Text className="text-white text-[10px] font-bold">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
