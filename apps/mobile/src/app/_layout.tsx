import '@/src/lib/reanimated-logger';
import '../global.css';
import '@/src/lib/nativewind-interop';
import { AppState, Platform, ActivityIndicator, View, Text } from 'react-native';
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  onlineManager,
} from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { Stack, useRouter, useSegments, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  getMessaging,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';

import { useSession } from '@/src/lib/auth-client';
import { LocationInitializer } from '@/src/features/location';
import {
  useNotificationSocket,
  usePushToken,
  useNotificationHandler,
} from '@/src/features/notification';
import Toast from 'react-native-toast-message';
import {
  captureMobileException,
  initMobileObservability,
  Sentry,
} from '@/src/lib/observability';
import {
  identifyMobileUser,
  MobileAnalyticsProvider,
  resetMobileAnalyticsIdentity,
} from '@/src/lib/analytics';

initMobileObservability();

// Register background handler
if (Platform.OS !== 'web') {
  setBackgroundMessageHandler(getMessaging(), async (remoteMessage) => {
    console.log('[BackgroundMessage] Received:', remoteMessage);

    // If the app is in background or closed, we may need to manually trigger a notification
    // for data-only messages. For messages with a 'notification' block, Android handles them automatically.
    // But for reliability across different Android versions/distributions, we check here.
    const title =
      remoteMessage.notification?.title || remoteMessage.data?.title;
    const body = remoteMessage.notification?.body || remoteMessage.data?.body;

    if (title || body) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: (title || 'UIT Food Notification') as string,
            body: (body || 'Open the app to see details') as string,
            data: remoteMessage.data,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
            color: '#0d631b',
          },
          trigger: null,
        });
      } catch (error) {
        captureMobileException(error, {
          source: 'firebase_background_message',
        });
        console.error(
          '[BackgroundMessage] Failed to schedule notification:',
          error,
        );
      }
    }
  });
}

function MobileErrorFallback() {
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-lg font-semibold text-gray-900">
        Something went wrong
      </Text>
      <Text className="mt-2 text-sm text-gray-500 text-center">
        Please restart the app.
      </Text>
    </View>
  );
}

function RootNavigation() {
  const { data: session, isPending } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const pathname = usePathname();
  const userId = session?.user?.id;

  useEffect(() => {
    Sentry.addBreadcrumb({
      category: 'navigation',
      message: `Navigated to ${pathname}`,
      level: 'info',
    });
  }, [pathname]);

  // Initialize notifications
  useNotificationSocket();
  usePushToken();
  useNotificationHandler();

  useEffect(() => {
    if (isPending) return;

    if (userId) {
      identifyMobileUser(userId);
      Sentry.setUser({ id: userId });
      return;
    }

    resetMobileAnalyticsIdentity();
    Sentry.setUser(null);
  }, [userId, isPending]);

  useEffect(() => {
    if (isPending) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (session && inAuthGroup) {
      // Redirect to customer flow if logged in but in auth flow
      router.replace('/(customer)/(tabs)');
    } else if (!session && !inAuthGroup && segments.length > 0) {
      // Redirect to auth flow if not logged in but in customer flow
      router.replace('/(auth)');
    }
  }, [session, isPending, segments, router]);

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color="#0d631b" />
      </View>
    );
  }

  return (
    <>
      <LocationInitializer />
      <Stack screenOptions={{ headerShown: false }} />
      <Toast />
    </>
  );
}

function AppLayout() {
  // 1. Create the client (stable across renders)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 2 } },
      }),
  );

  // 2. Setup Online Manager (Detects Wi-Fi/Data changes)
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    onlineManager.setEventListener((setOnline) => {
      unsubscribe = NetInfo.addEventListener((state) => {
        setOnline(!!state.isConnected);
      });

      return () => unsubscribe?.();
    });

    return () => unsubscribe?.();
  }, []);

  // 3. Setup Focus Manager (Detects App background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (Platform.OS !== 'web') {
        focusManager.setFocused(status === 'active');
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <Sentry.ErrorBoundary fallback={<MobileErrorFallback />}>
      <QueryClientProvider client={queryClient}>
        <MobileAnalyticsProvider>
          <RootNavigation />
        </MobileAnalyticsProvider>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  );
}

export default Sentry.wrap(AppLayout);
