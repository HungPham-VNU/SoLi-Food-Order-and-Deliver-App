# NOTIFICATION_FCM_SETUP_REPORT.md

**Phase**: N-5 — Firebase Cloud Messaging Foundation  
**Date**: 2025-01  
**Status**: ✅ Complete — TypeScript: 0 errors | Unit: 89/89 | E2E: 62/62

---

## 1. Executive Summary

Phase N-5 wires Firebase Cloud Messaging (FCM) into the existing Notification Bounded Context.  
A new `FirebasePushProvider` replaces `StubPushProvider` in production (when a service-account
key is configured), a test endpoint lets developers send a push to a real browser token during
development, and a service worker + HTML test page complete the browser-side flow.

No existing behaviour changes: when `FIREBASE_SERVICE_ACCOUNT_PATH` is unset the system falls
back to `StubPushProvider` exactly as before.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      NotificationModule                          │
│                                                                  │
│  PUSH_PROVIDER factory                                           │
│  ┌─────────────────────────────────────────────┐                │
│  │ FIREBASE_SERVICE_ACCOUNT_PATH set?           │                │
│  │   YES → FirebasePushProvider (Admin SDK)     │                │
│  │   NO  → StubPushProvider (dev/test default)  │                │
│  └─────────────────────────────────────────────┘                │
│                           │                                      │
│           ┌───────────────┘                                      │
│           ▼                                                       │
│  IPushProvider.send({ tokens[], title, body, data? })            │
│           │                                                      │
│           ▼                                                       │
│  PushChannelService (unchanged — handles token lookup etc.)      │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
              Google FCM servers (HTTP v1 API)
                            │
                  ┌─────────┴─────────┐
                  ▼                   ▼
           Tab in foreground   Tab in background
                  │                   │
          onMessage() fires    Service Worker fires
        (fcm-test.html)       (firebase-messaging-sw.js)
      → logs in event panel   → showNotification()
```

---

## 3. Files Added

### `src/module/notification/channels/push/firebase-push.provider.ts`

Implements `IPushProvider`. Initialises Firebase Admin SDK in its constructor using a
singleton guard (`admin.apps.length === 0`). Calls `sendEachForMulticast()` for fan-out.

Key guarantees:
- **Never throws from `send()`** — all errors expressed as `PushSendResult`
- **Fail-fast on bad key file** — constructor throws with a descriptive message if the
  service account JSON is unreadable
- **Invalid-token detection** — classifies `messaging/registration-token-not-registered`
  and `messaging/invalid-registration-token` as invalid (for future token cleanup)

### `src/module/notification/dto/test-push.dto.ts`

`TestPushDto` — validated request body for the test endpoint.  
`TestPushResponseDto` — response: `{ successCount, failureCount, invalidTokens }`.

### `src/module/notification/services/test-push.service.ts`

Thin wrapper that injects `PUSH_PROVIDER` and delegates to `pushProvider.send()`.  
Kept separate from `NotificationService` to avoid polluting core notification logic with
test concerns. Should be removed (along with the test endpoint) before a public production
release.

### `apps/api/public/fcm-test.html`

Developer test page. Steps:
1. Requests `Notification.permission()` and registers the service worker
2. Calls Firebase JS SDK `getToken()` with the project VAPID key
3. POSTs token + title + body to `POST /api/notifications/test/push`
4. Logs foreground messages via `onMessage()`

### `apps/api/public/firebase-messaging-sw.js`

Firebase Messaging service worker. Served at `/firebase-messaging-sw.js` (origin root).  
Uses Firebase compat CDN scripts (`importScripts`) — required because service workers do
not support ES modules in all browsers.

Handles:
- `onBackgroundMessage` → `showNotification()` for background/closed tabs
- `notificationclick` → focuses existing window or opens new tab, supports `payload.data.url`
  for deep-linking

---

## 4. Files Modified

| File | Change |
|------|--------|
| `src/config/env.schema.ts` | Added optional `FIREBASE_SERVICE_ACCOUNT_PATH` Zod field |
| `apps/api/.env.example` | Added commented-out Firebase section |
| `apps/api/.gitignore` | Added patterns to exclude `*-FCM-key.json` and Firebase adminsdk keys |
| `src/module/notification/notification.module.ts` | Replaced `useClass: StubPushProvider` with factory; added `TestPushService` provider |
| `src/module/notification/controllers/notification.controller.ts` | Added `POST test/push` endpoint; guards against production use |
| `src/main.ts` | Added `express.static` middleware to serve `apps/api/public/` |

---

## 5. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Optional | — | Relative (to `process.cwd()`) or absolute path to the Firebase Admin SDK service account JSON file. When absent, `StubPushProvider` is used. |

### Local Development Setup

1. Download the service account key from:  
   Firebase Console → Project Settings → Service accounts → Generate new private key

2. Place it in `apps/api/` (already gitignored via `*-FCM-key.json`):  
   `apps/api/soli-food-delivery-FCM-key.json`

3. Add to `apps/api/.env`:
   ```
   FIREBASE_SERVICE_ACCOUNT_PATH=soli-food-delivery-FCM-key.json
   ```

4. Restart the API server — the startup log will show:
   ```
   [FirebasePushProvider] Firebase Admin SDK initialised
   ```

---

## 6. Push Notification Flow

### Sending a notification to a device token

```
EventBus.publish(PushNotificationEvent)
  → NotificationService.handlePushNotification()
    → PushChannelService.send()
      → DeviceTokenRepository.getTokensForUser(userId)
      → PUSH_PROVIDER.send({ tokens, title, body, data })
        → [FirebasePushProvider] admin.messaging().sendEachForMulticast(message)
          → Google FCM → Device(s)
```

### Test flow (developer tool)

```
Browser → GET /fcm-test.html
  → User clicks "Get Token"
    → Notification.requestPermission()
    → navigator.serviceWorker.register('/firebase-messaging-sw.js')
    → getToken(messaging, { vapidKey, serviceWorkerRegistration })
      → FCM returns registration token
  → User clicks "Send via Backend"
    → POST /api/notifications/test/push { token, title, body }
      → TestPushService.send()
        → PUSH_PROVIDER.send({ tokens: [token], title, body })
          → FCM → Browser
            → Tab foreground: onMessage() in fcm-test.html logs it
            → Tab background: SW shows native notification
```

---

## 7. API Endpoint

### `POST /api/notifications/test/push`

**Purpose**: Developer/QA tool — sends a direct push to a single browser FCM token.  
**Blocked in production**: Returns `403 Forbidden` when `NODE_ENV=production`.

**Request body**:
```json
{
  "token": "<FCM registration token>",
  "title": "Test Push",
  "body":  "Hello from Notification BC"
}
```

**Response** (`200 OK`):
```json
{
  "successCount": 1,
  "failureCount": 0,
  "invalidTokens": []
}
```

---

## 8. Service Worker Notes

- **Must be at `/firebase-messaging-sw.js`** — FCM hard-codes this path by default.  
  `app.setGlobalPrefix('api')` only applies to NestJS routes; the `express.static`
  middleware runs before NestJS routing, so the SW is served at the root without the
  `/api` prefix. ✓

- **Static file serving**: `main.ts` adds `app.use(express.static(join(__dirname, '..', 'public')))`.  
  `__dirname` resolves to `src/` in development (ts-node) and `dist/` in production (compiled JS),
  so `join(__dirname, '..', 'public')` always points to `apps/api/public/`. ✓

- **HTTPS requirement**: Service workers require HTTPS in production. On `localhost` plain HTTP
  works during development. Configure your reverse proxy (Nginx/Traefik) to terminate TLS before
  deploying to staging/production.

---

## 9. VAPID Key

The VAPID (Voluntary Application Server Identification) public key links push subscriptions to
this Firebase project. It is **not a secret** and can be safely embedded in client-side code.

```
BOyGe_nS6JdjOEINj-DDgKCxzZ4cHMe4oVs83__84VXT3Z9h0wtIvAGb-1wEdZMFMBW9sfYOTIl3iBbyBgqQKfs
```

Source: Firebase Console → Project Settings → Cloud Messaging → Web Push Certificates

---

## 10. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Service account key exposure | `*-FCM-key.json` in `.gitignore`; loaded from filesystem at runtime, never embedded in code |
| Test endpoint in production | `NODE_ENV === 'production'` guard returns `403 Forbidden` |
| FCM registration token in transit | Always transmitted over HTTPS in production; token is short-lived and can be rotated |
| Invalid token accumulation | `invalidTokens` field returned — callers should remove these from storage (hook to add in `PushChannelService`) |

---

## 11. Future Extensibility

| Feature | Where to add |
|---------|-------------|
| Automatic invalid token cleanup | `PushChannelService.send()` — check `result.invalidTokens`, remove from `device_tokens` table |
| FCM data payload (deep links) | `PushChannelService.send()` → pass `data` in `PushPayload`; SW `notificationclick` already reads `payload.data.url` |
| Topic-based push (broadcast) | New method on `IPushProvider`; `FirebasePushProvider.sendToTopic()` |
| Mobile (Android/iOS) token registration | New `POST /api/notifications/device-tokens` endpoint; `DeviceTokenRepository` already handles this |
| Web app manifest + install prompt | Add `manifest.json` to `apps/api/public/`; out of scope for N-5 |
| Analytics / delivery tracking | Firebase Messaging reporting in Firebase Console; no code changes needed |

---

## 12. Testing Guide

### Step-by-step manual test

1. Start the API: `pnpm dev` (inside `apps/api`)
2. Confirm startup log: `[FirebasePushProvider] Firebase Admin SDK initialised`
3. Navigate to: `http://localhost:3000/fcm-test.html`
4. Click **"Request Permission & Get Token"** — grant the permission prompt
5. Verify SW status shows **"registered ✓"** and a long FCM token appears
6. Click **"Send via Backend"** with default title/body
7. Expected response: `{ "successCount": 1, "failureCount": 0, "invalidTokens": [] }`
8. Since the tab is in the foreground, the event log shows the message. To test background delivery: switch to another tab before clicking Send — a native notification should appear.

### Automated tests

```powershell
# Unit tests (89 tests)
cd apps/api
node node_modules/jest/bin/jest.js --testPathPatterns="notification" --runInBand --no-coverage

# E2E tests (62 tests)
node --experimental-vm-modules node_modules/jest/bin/jest.js --config test/jest-e2e.json --testPathPatterns="notification" --runInBand
```

---

## 13. Files Checklist

```
apps/api/
├── .env.example                         ✅ FIREBASE_SERVICE_ACCOUNT_PATH added
├── .gitignore                           ✅ *-FCM-key.json excluded
├── public/
│   ├── fcm-test.html                    ✅ NEW
│   └── firebase-messaging-sw.js         ✅ NEW
└── src/
    ├── main.ts                          ✅ express.static added
    ├── config/env.schema.ts             ✅ FIREBASE_SERVICE_ACCOUNT_PATH Zod field
    └── module/notification/
        ├── channels/push/
        │   └── firebase-push.provider.ts ✅ NEW
        ├── controllers/
        │   └── notification.controller.ts ✅ POST test/push added
        ├── dto/
        │   └── test-push.dto.ts          ✅ NEW
        ├── notification.module.ts        ✅ PUSH_PROVIDER factory + TestPushService
        └── services/
            └── test-push.service.ts      ✅ NEW
```
