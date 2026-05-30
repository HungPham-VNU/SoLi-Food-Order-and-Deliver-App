// Custom entry point for the app.
//
// The Firebase background message handler MUST be registered at module level
// in the entry file — not inside a React component or a lazily-loaded route
// like _layout.tsx. When Android receives a push notification while the app is
// killed, it starts a headless JS task by running only the entry bundle. Expo
// Router lazily loads routes (including _layout.tsx), so a handler registered
// there is never reached in the headless path, producing the warning:
//   "No task registered for key ReactNativeFirebaseMessagingHeadlessTask"
//
// Using require('expo-router/entry') at the END (instead of a static import)
// ensures the handler is registered before Expo Router initialises, because
// Babel hoists static import() calls to the top of the module.

import { Platform } from 'react-native';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';

if (Platform.OS !== 'web') {
  setBackgroundMessageHandler(getMessaging(), async (remoteMessage) => {
    console.log('[BackgroundMessage] Received:', remoteMessage);

    const title =
      typeof remoteMessage.notification?.title === 'string'
        ? remoteMessage.notification.title
        : (remoteMessage.data?.title as string | undefined);
    const body =
      typeof remoteMessage.notification?.body === 'string'
        ? remoteMessage.notification.body
        : (remoteMessage.data?.body as string | undefined);

    if (title || body) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: title ?? 'UIT Food Notification',
            body: body ?? 'Open the app to see details',
            data: remoteMessage.data,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
            color: '#0d631b',
          },
          trigger: null,
        });
      } catch (error) {
        console.error('[BackgroundMessage] Failed to schedule notification:', error);
      }
    }
  });
}

// Load Expo Router after registering the background handler.
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('expo-router/entry');
