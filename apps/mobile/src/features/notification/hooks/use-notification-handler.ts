import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { 
  getMessaging, 
  onMessage, 
  onNotificationOpenedApp, 
  getInitialNotification 
} from '@react-native-firebase/messaging';
import { useNotificationStore } from '@/src/store/notification-store';
import { useNotificationNavigation } from '../utils/navigation';
import { notificationApi } from '../api';
import { NotificationType } from '../types';

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function useNotificationHandler() {
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const setUnreadCount = useNotificationStore((state) => state.setUnreadCount);
  const { navigateFromNotification } = useNotificationNavigation();

  // 1. Setup Notification Channel (Android) & Badge (iOS)
  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      }).catch((err) => {
        console.warn('[NotificationHandler] Failed to set notification channel:', err);
      });
    }

    Notifications.setBadgeCountAsync(unreadCount).catch((err) => {
      console.warn('[NotificationHandler] Failed to set badge count:', err);
    });
  }, [unreadCount]);

  // 2. Handle Push Notification Taps & Messages
  useEffect(() => {
    const messaging = getMessaging();

    // Foreground message listener (Firebase)
    // Manually trigger a local notification so it shows up while the app is open
    const unsubscribeOnMessage = onMessage(messaging, async (remoteMessage) => {
      console.log('[NotificationHandler] Foreground message received:', remoteMessage);
      
      // If the backend sends a 'notification' object, Android might handle it.
      // But for consistent UX across platforms/versions, we can manually trigger it
      // if it wasn't already handled by the OS.
      if (remoteMessage.data?.title || remoteMessage.notification?.title) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: (remoteMessage.notification?.title || remoteMessage.data?.title) as string,
            body: (remoteMessage.notification?.body || remoteMessage.data?.body) as string,
            data: remoteMessage.data,
          },
          trigger: null,
        });
      }
    });

    // Background/Quit tap listener
    const unsubscribeOnMessageOpenedApp = onNotificationOpenedApp(messaging, 
      (remoteMessage) => {
        console.log('[NotificationHandler] Notification caused app to open from background:', remoteMessage);
        if (remoteMessage.data) {
          navigateFromNotification(
            remoteMessage.data.type as NotificationType,
            remoteMessage.data
          );
        }
      }
    );

    // Initial notification (App opened from quit state)
    getInitialNotification(messaging)
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('[NotificationHandler] Notification caused app to open from quit state:', remoteMessage);
          if (remoteMessage.data) {
            navigateFromNotification(
              remoteMessage.data.type as NotificationType,
              remoteMessage.data
            );
          }
        }
      });

    return () => {
      unsubscribeOnMessage();
      unsubscribeOnMessageOpenedApp();
    };
  }, [navigateFromNotification]);

  // 3. Refresh unread count on App Foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        notificationApi.getUnreadCount()
          .then((res) => setUnreadCount(res.count))
          .catch((err) => console.warn('[NotificationHandler] Failed to refresh unread count:', err));
      }
    });

    return () => {
      subscription.remove();
    };
  }, [setUnreadCount]);
}
