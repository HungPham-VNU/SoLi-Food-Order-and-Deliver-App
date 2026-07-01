import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { useSession, authClient } from '@/src/lib/auth-client';
import { useNotificationStore } from '@/src/store/notification-store';
import { NotificationPayload } from '../types';
import { BASE_URL } from '@/src/lib/api-client';
import Toast from 'react-native-toast-message';
const getWsUrl = (baseUrl: string) => {
  try {
    const url = new URL(baseUrl);
    if (url.pathname.startsWith('/api')) {
      url.pathname = url.pathname.slice(4);
    }
    return url.toString().replace(/\/$/, '');
  } catch (err) {
    console.error('[NotifSocket] Error occurred while parsing WS URL:', err);
    return baseUrl.replace('/api', '');
  }
};

const WS_URL = getWsUrl(BASE_URL);

export function useNotificationSocket() {
  const socketRef = useRef<Socket | null>(null);
  // Tracks whether we disconnected the socket because the app went to the
  // background. Used to ensure we only reconnect when AppState caused the
  // disconnect, not after auth failures or session expiry.
  const pausedByAppStateRef = useRef(false);
  const { data: session } = useSession();
  const { addNotification, markReadInStore, markAllReadInStore } =
    useNotificationStore();

  useEffect(() => {
    // We don't have a direct token in better-auth-expo, it uses cookies.
    // However, Socket.IO handshake on Android doesn't support custom headers easily.
    // The backend guide says: "Do NOT send the token in the HTTP Authorization header for Socket.IO on React Native... Use auth: { token } instead"
    // We need to get the "token" which is likely the session ID or similar.
    // Looking at api-client.ts, it uses authClient.getCookie().
    // If the backend is configured to accept the cookie in handshake, we're good.
    // But the guide explicitly says auth: { token }.
    // Let's assume the session object or a cookie value can be used as the token.

    if (!session?.session) return;

    // Better Auth Expo stores the session token in SecureStore headers instead of exposing it to the UI by default.
    // If session.session.token is undefined, we fall back to extracting it from the generated cookie string.
    const cookieStr = authClient.getCookie() || '';
    const rawToken =
      (session.session as any).token ||
      cookieStr.replace('uitfood.session_token=', '').split(';')[0];

    // Connect to the /notifications namespace
    const socket = io(`${WS_URL}/notifications`, {
      auth: { token: rawToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('[NotifSocket] Connected');
    });

    socket.on('notification.created', (payload: NotificationPayload) => {
      addNotification(payload);

      // Show in-app banner
      Toast.show({
        type: 'success',
        text1: payload.title,
        text2: payload.body,
        onPress: () => {
          // Handle tap logic later
          Toast.hide();
        },
      });
    });

    socket.on(
      'notification.read',
      (
        data: { id: string; readAt: string } | { all: true; readAt: string },
      ) => {
        if ('all' in data) {
          markAllReadInStore();
        } else {
          markReadInStore(data.id);
        }
      },
    );

    socket.on('auth:expired', () => {
      console.warn('[NotifSocket] Session expired — disconnecting');
      socket.disconnect();
    });

    socket.on('disconnect', (reason) => {
      console.log('[NotifSocket] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('[NotifSocket] Connect error:', err.message);
    });

    // Heartbeat: send ping every 25s to keep presence TTL alive
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('notification:ping');
      }
    }, 25_000);

    socketRef.current = socket;

    return () => {
      clearInterval(pingInterval);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [session, addNotification, markReadInStore, markAllReadInStore]);

  // Disconnect the socket when the app is backgrounded so the server's
  // UserPresenceService marks the user offline. This allows push notifications
  // to be delivered instead of being suppressed (the server suppresses push
  // when it sees an active WebSocket connection, assuming in-app delivery
  // suffices — but the app is not visible in the background).
  // Reconnect when the app returns to the foreground to restore real-time events.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const socket = socketRef.current;
      if (!socket) return;

      if (nextAppState === 'background') {
        socket.disconnect();
        pausedByAppStateRef.current = true;
      } else if (nextAppState === 'active' && pausedByAppStateRef.current) {
        pausedByAppStateRef.current = false;
        if (!socket.connected) {
          socket.connect();
        }
      }
    });

    return () => subscription.remove();
  }, []);

  return socketRef;
}
