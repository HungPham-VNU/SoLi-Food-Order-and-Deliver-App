import '@/src/lib/reanimated-logger';
import '../global.css';
import '@/src/lib/nativewind-interop';
import { AppState, Platform, View } from 'react-native';
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  onlineManager,
} from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from '@/src/lib/auth-client';
import { LocationInitializer } from '@/src/features/location';
import {
  useNotificationSocket,
  usePushToken,
  useNotificationHandler,
} from '@/src/features/notification';
import Toast from 'react-native-toast-message';
import { AppLoadingScreen } from '@/src/components/app-loading-screen';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootNavigation() {
  const { data: session, isPending } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const userId = session?.user?.id;

  // Initialize notifications
  useNotificationSocket();
  usePushToken();
  useNotificationHandler();

  useEffect(() => {
    if (isPending) return;

    if (userId) {
      return;
    }
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
    return <AppLoadingScreen />;
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
  const splashHiddenRef = useRef(false);

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

  const handleRootLayout = useCallback(() => {
    if (splashHiddenRef.current) return;

    splashHiddenRef.current = true;
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  return (
    <View style={{ flex: 1 }} onLayout={handleRootLayout}>
      <QueryClientProvider client={queryClient}>
        <RootNavigation />
      </QueryClientProvider>
    </View>
  );
}

export default AppLayout;
