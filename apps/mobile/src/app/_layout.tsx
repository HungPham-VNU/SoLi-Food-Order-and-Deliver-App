import 'react-native-reanimated';
import '../global.css';
import { AppState, Platform } from 'react-native';
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  onlineManager,
} from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';

export default function AppLayout() {
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
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
