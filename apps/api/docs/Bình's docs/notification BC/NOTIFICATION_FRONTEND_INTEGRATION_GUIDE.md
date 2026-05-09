# Notification BC — Frontend Integration Guide

> **Document Type:** Engineering Handoff
> **Audience:** Mobile (React Native / Expo) and Web (Next.js / Vite React) Frontend Teams
> **Backend Contact:** API Team (Notification BC)
> **Base URL:** `https://<host>/api`
> **WebSocket Namespace:** `wss://<host>/notifications`
> **Auth System:** Better Auth — Bearer token in all requests
> **Last Verified Against:** Phases N-1 through N-5 (fully implemented)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Frontend Architecture Overview](#2-frontend-architecture-overview)
3. [WebSocket Integration](#3-websocket-integration)
4. [Push Notification Setup](#4-push-notification-setup)
5. [REST API Reference](#5-rest-api-reference)
6. [Notification Payload Contracts](#6-notification-payload-contracts)
7. [Unread Count & Badge Strategy](#7-unread-count--badge-strategy)
8. [Deep Linking from Notifications](#8-deep-linking-from-notifications)
9. [Offline & Reconnection Strategy](#9-offline--reconnection-strategy)
10. [Error Handling](#10-error-handling)
11. [Security Notes](#11-security-notes)
12. [Testing Checklist](#12-testing-checklist)
13. [UX Recommendations](#13-ux-recommendations)

---

## 1. Overview

The Notification BC delivers user-facing notifications through **three simultaneous channels**:

| Channel | Mechanism | When Used |
|---------|-----------|-----------|
| **In-app real-time** | Socket.IO WebSocket (`/notifications`) | User has the app open |
| **Push** | FCM (Android/iOS/Web) | User is not actively connected |
| **Email** | SMTP transactional | High-value events (delivered, payment, cancellation) |

**Critical FE contract:** The in-app WebSocket channel is an optimisation — the notification is **always** persisted in the DB. If the WebSocket event is missed (app backgrounded, offline, reconnecting), the notification will appear in the inbox when queried via REST. The frontend must implement both real-time (WS) and pull-based (REST) delivery to ensure zero missed notifications.

### 1.1 Per-Role Notifications

| Role | Notification Types |
|------|--------------------|
| **Customer** | order_placed, order_confirmed, order_preparing, order_ready_for_pickup, order_picked_up, order_delivering, order_delivered, order_cancelled, order_refunded, payment_confirmed, payment_failed, refund_initiated |
| **Restaurant Owner** | new_order_received, order_cancelled |
| **Admin** | system_announcement (future) |

---

## 2. Frontend Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│                  Frontend (React Native / Next.js)      │
│                                                        │
│  NotificationProvider (Context/Store)                  │
│  ├── useNotificationSocket()   ← WS real-time          │
│  ├── useNotificationInbox()    ← REST polling/pull     │
│  ├── usePushToken()            ← FCM token lifecycle   │
│  └── useUnreadCount()          ← badge state           │
│                                                        │
│  NotificationInbox screen/component                    │
│  NotificationBell (header badge)                       │
│  Toast / in-app banner component                       │
└────────────────────────────────────────────────────────┘
         │ Socket.IO             │ FCM SDK          │ REST HTTP
         ▼                       ▼                  ▼
    wss://<host>             Firebase SDK      https://<host>/api
    /notifications           (RN Firebase     /notifications/...
                              or JS SDK)
```

**State management recommendation:** Keep notifications in a single store (Redux, Zustand, or React Context). Both the WS handler and the REST fetch should write to the same store — this prevents UI duplication when a push notification opens the app while the WS also fires.

---

## 3. WebSocket Integration

### 3.1 Connection Setup

**Install:**
```bash
# Both RN and Next.js
npm install socket.io-client
# or
pnpm add socket.io-client
```

**Connect:**
```typescript
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectNotificationSocket(bearerToken: string): Socket {
  if (socket?.connected) return socket;

  socket = io('https://<host>/notifications', {
    // Send token in auth object — extracted by server in handshake.auth.token
    auth: { token: bearerToken },
    transports: ['websocket', 'polling'], // try WS first, fall back to polling
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,       // 2s initial delay
    reconnectionDelayMax: 30000,   // 30s max delay
    timeout: 10000,
  });

  return socket;
}

export function disconnectNotificationSocket(): void {
  socket?.disconnect();
  socket = null;
}
```

> **Do NOT send the token in the HTTP Authorization header for Socket.IO on React Native.** React Native's WebSocket implementation does not support custom HTTP headers in the upgrade request on Android. Use `auth: { token }` instead — this is placed in the Socket.IO handshake, not the HTTP header.

### 3.2 React Native — Complete Setup

```typescript
// hooks/useNotificationSocket.ts
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth.store';
import { useNotificationStore } from '@/stores/notification.store';
import { NotificationPayload } from '@/types/notification';

const WS_URL = process.env.EXPO_PUBLIC_API_URL!.replace('/api', '');

export function useNotificationSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { token } = useAuthStore();
  const { addNotification, markReadInStore, setUnreadCount } = useNotificationStore();

  useEffect(() => {
    if (!token) return;

    const socket = io(`${WS_URL}/notifications`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('[NotifSocket] Connected');
    });

    socket.on('connection:established', (data: { userId: string; room: string }) => {
      console.log('[NotifSocket] Authenticated as', data.userId);
    });

    // New notification — add to store + show in-app banner
    socket.on('notification.created', (payload: NotificationPayload) => {
      addNotification(payload);
      // Show in-app toast/banner
      showInAppBanner(payload);
    });

    // Read sync across devices/tabs
    socket.on('notification.read', (data: { id: string; readAt: string } | { all: true; readAt: string }) => {
      if ('all' in data) {
        markReadInStore({ all: true });
      } else {
        markReadInStore({ id: data.id });
      }
    });

    // Session expired — re-authenticate
    socket.on('auth:expired', () => {
      console.warn('[NotifSocket] Session expired — disconnecting');
      socket.disconnect();
      // Trigger auth refresh flow in your app
    });

    socket.on('disconnect', (reason) => {
      console.log('[NotifSocket] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('[NotifSocket] Connect error:', err.message);
    });

    // Heartbeat: send ping every 25s to keep presence TTL alive
    const pingInterval = setInterval(() => {
      if (socket.connected) socket.emit('notification:ping');
    }, 25_000);

    socketRef.current = socket;

    return () => {
      clearInterval(pingInterval);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  return socketRef;
}
```

### 3.3 Next.js (Web) — Complete Setup

```typescript
// lib/notification-socket.ts
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;

export function initNotificationSocket(token: string) {
  if (socket?.connected) return;

  socket = io(`${process.env.NEXT_PUBLIC_WS_URL}/notifications`, {
    // Web browsers support Authorization header in HTTP upgrade
    extraHeaders: { Authorization: `Bearer ${token}` },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  socket.on('connection:established', (data) => {
    console.log('[NotifSocket] Connected as', data.userId);
  });

  socket.on('notification.created', handleNewNotification);
  socket.on('notification.read', handleReadSync);
  socket.on('auth:expired', () => { cleanupSocket(); /* trigger re-auth */ });

  pingTimer = setInterval(() => {
    socket?.emit('notification:ping');
  }, 25_000);
}

export function cleanupSocket() {
  if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  socket?.disconnect();
  socket = null;
}

function handleNewNotification(payload: NotificationPayload) {
  // Dispatch to your state management store
}

function handleReadSync(data: { id: string; readAt: string } | { all: true; readAt: string }) {
  // Update read state in store
}
```

### 3.4 Heartbeat Contract

The server-side Redis presence key (`ws:connections:{userId}`) has a **90-second TTL**. If no heartbeat is sent within 90s, the server considers the user offline even while the socket is open.

| Side | Action | Interval |
|------|--------|---------|
| Client | Emit `notification:ping` | Every **25 seconds** |
| Server | Call `EXPIRE ws:connections:{userId} 90` | On each ping |

**Why client-side ping?** Socket.IO's built-in ping/pong checks TCP liveness. The application-level `notification:ping` refreshes the Redis presence TTL, which is used to suppress FCM push for online users. Without application-level pings, the user would start receiving duplicate push + WS notifications within 90 seconds of connecting.

### 3.5 Token Refresh Flow

When `auth:expired` is received:
1. Stop the ping timer immediately
2. Call your auth token refresh endpoint
3. Reconnect the socket with the new token: `socket.auth = { token: newToken }; socket.connect();`
4. Restart the ping timer

---

## 4. Push Notification Setup

### 4.1 React Native (Expo) — FCM Token Registration

```typescript
// hooks/usePushToken.ts
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import messaging from '@react-native-firebase/messaging';
import { apiClient } from '@/lib/api';

export function usePushToken() {
  useEffect(() => {
    registerPushToken();
  }, []);
}

async function registerPushToken() {
  // 1. Request permission
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  // 2. Get FCM token (requires @react-native-firebase/messaging or Expo's getExpoPushTokenAsync)
  const token = await messaging().getToken();
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';

  // 3. Register with backend
  await apiClient.post('/api/notifications/my/push-tokens', { token, platform });

  // 4. Listen for token refresh (FCM rotates tokens occasionally)
  const unsubscribe = messaging().onTokenRefresh(async (newToken) => {
    await apiClient.post('/api/notifications/my/push-tokens', { token: newToken, platform });
  });

  return unsubscribe;
}
```

**Deregister on logout:**
```typescript
async function onLogout(token: string) {
  try {
    await apiClient.delete('/api/notifications/my/push-tokens', { data: { token } });
  } catch { /* best-effort */ }
}
```

### 4.2 Web (Next.js) — FCM Web Push

```typescript
// lib/web-push.ts
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { initializeApp } from 'firebase/app';

const app = initializeApp({ /* your Firebase config */ });
const messaging = getMessaging(app);

export async function registerWebPushToken(vapidKey: string) {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const token = await getToken(messaging, { vapidKey });
  await fetch('/api/notifications/my/push-tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
    body: JSON.stringify({ token, platform: 'web' }),
  });

  // Handle foreground messages (app is open)
  onMessage(messaging, (payload) => {
    // Show a custom in-app notification — browser push is suppressed for online users
    // (server-side push suppression), but FCM web SDK still fires this callback
  });

  return token;
}
```

### 4.3 Push Notification Data Payload

FCM messages include a `data` object alongside the notification (title/body). Use `data` for deep linking:

```typescript
// Shape of FCM data payload
interface FcmDataPayload {
  notificationId: string;   // UUID — use to mark as read
  type: string;              // NotificationType
  orderId?: string;          // Present for order/payment events
  // ... other templateData fields
}
```

**React Native — handle background tap:**
```typescript
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  // This runs in the background service worker (Android)
  // Navigate on tap via the notification's data
});

// Foreground notification tap
messaging().onNotificationOpenedApp((remoteMessage) => {
  const data = remoteMessage.data as FcmDataPayload;
  navigateFromNotification(data.type, data.orderId);
});

// Cold start (app killed, opened via notification)
messaging().getInitialNotification().then((remoteMessage) => {
  if (remoteMessage) {
    const data = remoteMessage.data as FcmDataPayload;
    navigateFromNotification(data.type, data.orderId);
  }
});
```

### 4.4 Push Suppression Behaviour

The backend **does not send FCM push** when the user is connected via WebSocket (online). This means:
- If the app is **open**: the user sees the in-app WS notification only
- If the app is **backgrounded/closed**: the user sees the FCM push notification

**Frontend implication:** Do not assume a push tap always means the user missed the WS event. When the app opens from a push tap, the notification may already be in the store from the WS channel. Use `notificationId` from the FCM data payload to check if the item exists before fetching.

---

## 5. REST API Reference

**Base URL:** `https://<host>/api`
**Auth:** All endpoints require `Authorization: Bearer <token>` header.

### 5.1 GET /notifications/my

Fetch the notification inbox.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 20 | Items per page (1–100) |
| `offset` | number | 0 | Offset for pagination |
| `unreadOnly` | boolean | false | Return only unread notifications |
| `type` | string | — | Filter by NotificationType |

**Response `200`:**
```json
{
  "items": [
    {
      "id": "uuid",
      "type": "order_delivered",
      "title": "Giao hàng thành công 🎉",
      "body": "Đơn hàng #abc từ Phở Bà Châm đã được giao. Chúc ngon miệng!",
      "data": { "orderId": "ord-uuid", "restaurantName": "Phở Bà Châm" },
      "orderId": "ord-uuid",
      "isRead": false,
      "readAt": null,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 42,
  "unreadCount": 5,
  "offset": 0,
  "limit": 20,
  "hasMore": true
}
```

> **`unreadCount`** in the inbox response is the **total** unread count for the user (not just the current page). Use this value for the badge.

### 5.2 GET /notifications/my/unread-count

Lightweight endpoint for badge polling (no items returned).

**Response `200`:**
```json
{ "count": 5 }
```

### 5.3 PATCH /notifications/:id/read

Mark a single notification as read.

**Response `200`:**
```json
{ "success": true }
```

> **Note:** Returns `{ success: false }` (not 404) when the notification is not found or belongs to another user. This prevents notification ID enumeration by external parties.

**Side effects:** The backend emits `notification.read { id, readAt }` over WebSocket to `room:user:{userId}` — all other open tabs/devices will update their read state automatically.

### 5.4 PATCH /notifications/my/read-all

Mark all unread notifications as read.

**Response `200`:**
```json
{ "count": 5 }
```

**Side effects:** Backend emits `notification.read { all: true, readAt }` over WebSocket.

### 5.5 GET /notifications/my/preferences

**Response `200`:**
```json
{
  "pushEnabled": true,
  "inAppEnabled": true,
  "emailEnabled": true,
  "smsEnabled": false,
  "quietHoursStart": null,
  "quietHoursEnd": null,
  "mutedTypes": [],
  "email": "user@example.com",
  "timezone": "Asia/Ho_Chi_Minh"
}
```

### 5.6 PATCH /notifications/my/preferences

Partial update — only provided fields are changed.

**Request body (all optional):**
```json
{
  "pushEnabled": false,
  "quietHoursStart": 22,
  "quietHoursEnd": 7,
  "mutedTypes": ["order_preparing"],
  "timezone": "Asia/Ho_Chi_Minh"
}
```

**Response `200`:** Updated preferences object (same shape as GET).

### 5.7 GET /notifications/my/push-tokens

**Response `200`:**
```json
{
  "tokens": [
    {
      "id": "uuid",
      "platform": "ios",
      "tokenSuffix": "...abc12345",
      "isActive": true,
      "lastSeenAt": "2024-01-15T10:00:00Z",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

> Full token values are masked — only the last 8 characters are returned.

### 5.8 POST /notifications/my/push-tokens

Register a device token.

**Request body:**
```json
{
  "token": "<FCM registration token>",
  "platform": "ios"
}
```

**Response `201`:**
```json
{ "registered": true }
```

This endpoint is **idempotent** — safe to call every time the app starts.

### 5.9 DELETE /notifications/my/push-tokens

Deregister a device token (on logout or permission revocation).

**Request body:**
```json
{ "token": "<FCM registration token>" }
```

**Response `200`:**
```json
{ "removed": true }
```

---

## 6. Notification Payload Contracts

### 6.1 NotificationPayload (WebSocket `notification.created`)

```typescript
interface NotificationPayload {
  id: string;                          // UUID — use as unique key in lists
  type: NotificationType;              // Determines routing, icon, colour
  title: string;                       // Short display title (Vietnamese)
  body: string;                        // Full notification body (Vietnamese)
  data?: Record<string, string>;       // Template variables for deep-linking
  orderId?: string;                    // Present for order/payment events
  createdAt: string;                   // ISO 8601
  isRead: boolean;                     // Always false on initial delivery
  readAt?: string;                     // ISO 8601 or undefined
}
```

### 6.2 Full NotificationType Enum

```typescript
type NotificationType =
  // Customer — Order lifecycle
  | 'order_placed'
  | 'order_confirmed'
  | 'order_preparing'
  | 'order_ready_for_pickup'
  | 'order_picked_up'
  | 'order_delivering'
  | 'order_delivered'
  | 'order_cancelled'
  | 'order_refunded'
  // Customer — Payment
  | 'payment_confirmed'
  | 'payment_failed'
  // Customer — Refund
  | 'refund_initiated'
  | 'refund_completed'           // RESERVED — not yet triggered
  // Restaurant
  | 'new_order_received'
  // Shipper (RESERVED — Delivery BC not yet built)
  | 'pickup_request'
  // System
  | 'system_announcement';
```

### 6.3 Template Data Fields per Type

| NotificationType | data fields available |
|------------------|-----------------------|
| `order_placed` | `orderId`, `restaurantName` |
| `order_confirmed` | `orderId`, `restaurantName` |
| `order_preparing` | `orderId` |
| `order_ready_for_pickup` | `orderId` |
| `order_picked_up` | `orderId` |
| `order_delivering` | `orderId` |
| `order_delivered` | `orderId`, `restaurantName` |
| `order_cancelled` | `orderId`, `reason` (optional) |
| `order_refunded` | `orderId`, `paidAmount` |
| `payment_confirmed` | `orderId`, `paidAmount` |
| `payment_failed` | `orderId` |
| `refund_initiated` | `orderId`, `paidAmount` |
| `new_order_received` | `orderId` |

> All amounts (`paidAmount`) are formatted Vietnamese VND strings (e.g., `"125.000 ₫"`).

---

## 7. Unread Count & Badge Strategy

### 7.1 Where to Get the Count

| Scenario | Source |
|----------|--------|
| App opens / tab activates | `GET /notifications/my/unread-count` |
| New WS `notification.created` received | Increment local counter by 1 |
| WS `notification.read { id }` received | Decrement local counter by 1 |
| WS `notification.read { all: true }` | Set local counter to 0 |
| `PATCH /my/:id/read` called | Decrement local counter by 1 (also confirmed by WS event) |
| `PATCH /my/read-all` called | Set local counter to 0 (also confirmed by WS event) |

### 7.2 Implementation Pattern

```typescript
// Zustand store example
interface NotificationState {
  unreadCount: number;
  items: NotificationPayload[];
  // actions
  setUnreadCount: (n: number) => void;
  addNotification: (payload: NotificationPayload) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  items: [],
  setUnreadCount: (n) => set({ unreadCount: n }),
  addNotification: (payload) =>
    set((state) => ({
      items: [payload, ...state.items],
      unreadCount: state.unreadCount + 1,
    })),
  markRead: (id) =>
    set((state) => ({
      items: state.items.map((n) => n.id === id ? { ...n, isRead: true } : n),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),
  markAllRead: () =>
    set((state) => ({
      items: state.items.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    })),
}));
```

### 7.3 React Native App Badge (iOS)

```typescript
import * as Notifications from 'expo-notifications';

// Update the native app badge from the store
useEffect(() => {
  Notifications.setBadgeCountAsync(unreadCount);
}, [unreadCount]);
```

### 7.4 Polling Fallback

If the WebSocket is disconnected for any period, the unread count may be stale. Re-fetch on:
- App foreground (AppState → `active`)
- Socket reconnect
- Navigation to the notification inbox screen

```typescript
// React Native: refresh on foreground
useEffect(() => {
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      fetchUnreadCount();
    }
  });
  return sub.remove;
}, []);
```

---

## 8. Deep Linking from Notifications

### 8.1 Routing Map

Use `type` and `orderId` from the notification payload to determine the navigation target:

```typescript
function navigateFromNotification(type: NotificationType, data: Record<string, string>) {
  switch (type) {
    case 'order_placed':
    case 'order_confirmed':
    case 'order_preparing':
    case 'order_ready_for_pickup':
    case 'order_picked_up':
    case 'order_delivering':
    case 'order_delivered':
    case 'order_cancelled':
    case 'order_refunded':
    case 'payment_confirmed':
    case 'payment_failed':
    case 'refund_initiated':
      // Navigate to order detail
      router.push(`/orders/${data.orderId}`);
      break;

    case 'new_order_received':
      // Restaurant: navigate to incoming order
      router.push(`/restaurant/orders/${data.orderId}`);
      break;

    case 'system_announcement':
      // Navigate to announcements feed
      router.push('/announcements');
      break;

    default:
      // Fallback: notification inbox
      router.push('/notifications');
  }
}
```

### 8.2 Mark as Read on Navigation

Always mark the notification as read when the user taps it (regardless of whether they navigate):

```typescript
async function handleNotificationTap(notification: NotificationPayload) {
  navigateFromNotification(notification.type, notification.data ?? {});
  if (!notification.isRead) {
    // Optimistic update
    markReadInStore(notification.id);
    // Backend call (fire-and-forget)
    apiClient.patch(`/api/notifications/${notification.id}/read`).catch(() => {});
  }
}
```

### 8.3 URL Scheme for Push Notifications (React Native)

Configure your app's URL scheme for deep linking from FCM notification taps. The FCM data payload from the backend includes `type` and `orderId` — use these in your linking config rather than a pre-built URL, as the URL scheme may vary between app versions.

---

## 9. Offline & Reconnection Strategy

### 9.1 On Initial App Open

1. Connect the WebSocket (starts receiving real-time events)
2. Fetch the inbox (`GET /notifications/my?unreadOnly=false&limit=20`) to populate the list
3. The `unreadCount` in the inbox response gives the correct badge value

### 9.2 On Reconnect (Socket Reconnected After Disconnect)

The Socket.IO client automatically reconnects (up to 5 attempts with backoff). On reconnect:
1. The WebSocket may have missed events during the outage
2. Fetch missed notifications: `GET /notifications/my?limit=50&offset=0` (sort by `createdAt DESC`)
3. Diff against the current store and add missing items

```typescript
socket.on('reconnect', () => {
  // Re-fetch the top of the inbox to catch missed events
  fetchInbox({ limit: 50, offset: 0 }).then((response) => {
    // Merge server items with local store (deduplicate by id)
    mergeNotifications(response.items);
    setUnreadCount(response.unreadCount);
  });
});
```

### 9.3 On App Foreground (React Native AppState)

```typescript
AppState.addEventListener('change', (nextState) => {
  if (nextState === 'active') {
    // Reconnect socket if needed
    if (!socket?.connected && authToken) {
      connectNotificationSocket(authToken);
    }
    // Refresh unread count
    fetchUnreadCount();
  }
});
```

### 9.4 No Event Queuing

The server does NOT queue WebSocket events for offline clients. If the user is offline when an event fires, only:
- The DB row (always written) persists
- The FCM push (if device token registered) is attempted

The client is responsible for fetching missed events via REST on reconnect.

---

## 10. Error Handling

### 10.1 WebSocket Error Codes

| Event/Error | Cause | Client Action |
|-------------|-------|---------------|
| `connect_error` | Network failure, auth rejected | Exponential backoff reconnect (auto by Socket.IO) |
| `auth:expired` | Better Auth session expired | Refresh token, reconnect with new token |
| `disconnect(reason: 'io server disconnect')` | Server explicitly disconnected client (auth failed) | Do NOT auto-reconnect; re-authenticate |
| `disconnect(reason: 'transport close')` | Network drop | Auto-reconnect (Socket.IO handles this) |

```typescript
socket.on('disconnect', (reason) => {
  if (reason === 'io server disconnect') {
    // Server forcibly closed the connection — do not auto-reconnect
    // Trigger re-auth flow instead
    triggerReauth();
  }
  // 'transport close', 'transport error', 'ping timeout' — auto-reconnect
});
```

### 10.2 REST API Error Responses

All API errors follow this shape:
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

| Status | Cause | Client Action |
|--------|-------|---------------|
| 401 | Expired or missing Bearer token | Refresh token and retry |
| 403 | Insufficient role | Do not retry; show error |
| 422 | Invalid request body (token too long, invalid platform) | Fix request params |
| 500 | Server error | Retry with backoff (1–3 times) |

### 10.3 Push Token Registration Failures

If `POST /notifications/my/push-tokens` fails on app start, the user will not receive push notifications. Retry strategy:
- On 5xx: retry once after 5s
- On 401: re-authenticate, then retry
- On 422: log and skip (invalid token format — should not happen with real FCM SDK)

---

## 11. Security Notes

### 11.1 Never Hardcode FCM Config in Client Code

Store the Firebase config (apiKey, projectId, etc.) in `.env` files or your CI/CD secret management. Do not commit config files to version control.

### 11.2 Token Storage

Store the Better Auth session token securely:
- **React Native:** `expo-secure-store` or `react-native-keychain`
- **Web:** `HttpOnly` cookies (server-side rendering) or `localStorage` with appropriate CSP

### 11.3 FCM Token Hygiene

- Always call `DELETE /notifications/my/push-tokens` on logout to prevent push notifications to logged-out devices
- Call `POST /notifications/my/push-tokens` on every app start (idempotent) to keep the token fresh
- Listen for FCM token refresh events and re-register immediately

### 11.4 Connection Establishment Handshake

The socket `auth.token` value is transmitted in the WebSocket upgrade HTTP request. Use HTTPS/WSS (TLS) in all environments to prevent token interception.

---

## 12. Testing Checklist

### 12.1 WebSocket

- [ ] Connect with valid token → receive `connection:established`
- [ ] Connect with expired/invalid token → connection refused, no crash
- [ ] Receive `notification.created` after order placement (end-to-end)
- [ ] Open two browser tabs → both receive same `notification.created` event
- [ ] Close one tab → other tab continues receiving (multi-device presence INCR/DECR)
- [ ] Send `notification:ping` every 25s → verify no disconnect after 90s
- [ ] Session expires → `auth:expired` received, socket disconnects cleanly
- [ ] Reconnect after network drop → inbox sync catches missed notifications

### 12.2 Push Notifications (Manual)

- [ ] Register FCM token → token appears in `GET /notifications/my/push-tokens`
- [ ] Kill app → trigger order event → receive FCM push
- [ ] App open (socket connected) → trigger order event → receive WS event, NO FCM push (suppressed)
- [ ] Tap push notification → navigate to correct screen
- [ ] Logout → deregister token → no push notifications received

### 12.3 Inbox & Read State

- [ ] `GET /notifications/my` returns correct items
- [ ] Unread count matches badge
- [ ] `PATCH /:id/read` marks item read, WS event syncs other tabs
- [ ] `PATCH /my/read-all` marks all read, badge resets to 0
- [ ] Inbox persists across logout/login (per user, not device)

### 12.4 Preferences

- [ ] Disable `pushEnabled` → no FCM push received
- [ ] Add type to `mutedTypes` → no in-app or push for that type
- [ ] Set quiet hours → no push during those hours (in-app still persists)
- [ ] Change timezone → quiet hours respect new timezone

### 12.5 Dev Test Endpoints (Local Only)

```bash
# Test FCM push to a specific token
curl -X POST http://localhost:3000/api/notifications/test/push \
  -H "Content-Type: application/json" \
  -d '{"token":"<your-fcm-token>","title":"Test","body":"Test push"}'

# Test email
curl -X POST http://localhost:3000/api/notifications/test/email \
  -H "Content-Type: application/json" \
  -d '{"to":"you@example.com","subject":"Test","body":"Test email"}'
```

> These endpoints are `@AllowAnonymous` but are blocked in `NODE_ENV=production`.

---

## 13. UX Recommendations

### 13.1 In-App Banner (Toast)

Show a non-intrusive banner at the top of the screen when `notification.created` fires while the user is on a screen OTHER than the notification inbox. Auto-dismiss after 4 seconds. Include a tap action to navigate (see Section 8.1).

```typescript
function showInAppBanner(notification: NotificationPayload) {
  // Only show if user is not on the notifications screen
  if (getCurrentRoute() === '/notifications') return;

  toast.show({
    title: notification.title,
    description: notification.body,
    duration: 4000,
    onPress: () => handleNotificationTap(notification),
  });
}
```

### 13.2 Notification Badge

| Condition | Badge |
|-----------|-------|
| 0 unread | No badge (hidden) |
| 1–99 unread | Show count |
| 100+ unread | Show "99+" |

Never show a red badge with count 0 — it creates false urgency.

### 13.3 Notification Type Icons & Colors

| Type Group | Colour | Icon Suggestion |
|------------|--------|----------------|
| Order lifecycle (placed → delivered) | Brand orange | 🛵 / order icon |
| Order cancelled | Red warning | ✕ |
| Payment confirmed | Green | ✓ |
| Payment failed | Red | ! |
| Refund | Blue | ↩ |
| New order (restaurant) | Brand orange + urgent | 🔔 |

### 13.4 Empty State

When the inbox is empty, show a friendly message:
> "Chưa có thông báo nào. Đặt hàng ngay để nhận cập nhật!"
> *(No notifications yet. Place an order to get updates!)*

### 13.5 Notification Grouping

Group notifications by day (Today, Yesterday, Earlier). Within each group, sort by `createdAt` descending (newest first). Use the `createdAt` ISO string for both grouping and display (`dd/MM/yyyy` format for Vietnamese locale).

### 13.6 Swipe-to-Read (Mobile)

Implement swipe-left gesture on notification items to mark as read without opening. This reduces friction for users who want to clear the badge without navigating away.

### 13.7 Preference Defaults

The backend defaults are: push ✅, in-app ✅, email ✅, SMS ❌. The preferences screen should reflect these defaults for new users (no row in DB → defaults returned by API).

Show the preferences screen from the notification bell's context menu (long-press or gear icon). Consider prompting for push permission on first notification received — do not ask at app launch.
