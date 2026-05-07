# FCM Browser Token Debug & Validation Report

**Date**: 2026-05-07  
**Scope**: `apps/api/public/fcm-test.html` · `apps/api/public/firebase-messaging-sw.js`  
**Status**: ✅ All static files verified — **server must be running at port 3000**

---

## Root-Cause Analysis

### Bug: `A bad HTTP response code (404) was received when fetching the script.`

| | |
|---|---|
| **Symptom** | Browser cannot register service worker; FCM token never generated |
| **Root cause** | The HTML page was opened from **Live Server (port 5500)** or `file://` instead of the NestJS server (port 3000) |
| **Why it matters** | `navigator.serviceWorker.register('/firebase-messaging-sw.js')` resolves `/` against the **current origin**. From port 5500, the browser fetches `http://localhost:5500/firebase-messaging-sw.js` — that path does not exist on Live Server, so it returns 404 |
| **Correct URL** | `http://localhost:3000/fcm-test.html` (NestJS serves the file via `express.static`) |

---

## Static File Serving — Verified ✅

Both files are served by `express.static` middleware registered in `main.ts`:

```typescript
// apps/api/src/main.ts  (line ~29)
app.use(expressStatic.static(join(__dirname, '..', 'public')));
// __dirname = apps/api/dist/  →  join resolves to apps/api/public/
```

| URL | HTTP | Content-Type |
|-----|------|-------------|
| `http://localhost:3000/fcm-test.html` | 200 | `text/html; charset=utf-8` |
| `http://localhost:3000/firebase-messaging-sw.js` | 200 | `text/javascript; charset=utf-8` |

The `express.static` middleware is registered **before** NestJS route handlers and **without a path prefix**, so the service worker is reachable at the origin root — as required by FCM.

---

## Fixes Applied

### 1. Origin Guard in `fcm-test.html`

Added a **synchronous** `<script>` block (not a module — runs immediately, before deferred modules) that:
- Checks `window.location.origin !== 'http://localhost:3000'`
- If wrong origin: inserts a red fixed banner at the top of the page with the correct URL and a **"Go now →"** redirect button
- `document.documentElement.style.paddingTop = '70px'` prevents content being hidden under the banner

Also added a second safety-check inside the `<script type="module">` block that emits a `console.error` describing the problem and the fix.

### 2. Improved SW Registration Error Message

The `catch` block in `registerServiceWorker()` now detects 404-style errors specifically:

```javascript
const is404 = err.message?.includes('404') || err.message?.includes('bad HTTP');
if (is404) {
  log('SW registration failed (404): firebase-messaging-sw.js not found at this origin.', 'err');
  log('→ You must open this page from http://localhost:3000/fcm-test.html ...', 'err');
}
```

### 3. Subtitle Updated

The page subtitle now explicitly states the required URL and explains that Live Server / `file://` are unsupported.

---

## Complete FCM Token Generation Flow

Once you open `http://localhost:3000/fcm-test.html` in Chrome/Edge:

```
Browser                            NestJS (port 3000)             Firebase / Google
  │                                      │                               │
  │  GET /fcm-test.html                  │                               │
  │─────────────────────────────────────>│                               │
  │  200 text/html                       │                               │
  │<─────────────────────────────────────│                               │
  │                                      │                               │
  │  GET /firebase-messaging-sw.js       │                               │
  │─────────────────────────────────────>│                               │
  │  200 text/javascript                 │                               │
  │<─────────────────────────────────────│                               │
  │                                      │                               │
  │  SW registered & ready               │                               │
  │  User grants Notification permission │                               │
  │                                      │                               │
  │  getToken(messaging, { vapidKey })   │                               │
  │  ──creates PushSubscription─────────────────────────────────────────>│
  │  ──returns FCM registration token───────────────────────────────────<│
  │                                      │                               │
  │  (token displayed in UI)             │                               │
  │                                      │                               │
  │  POST /api/notifications/test/push   │                               │
  │─────────────────────────────────────>│                               │
  │                                      │  sendEachForMulticast(token)  │
  │                                      │──────────────────────────────>│
  │                                      │  { successCount: 1 }          │
  │                                      │<──────────────────────────────│
  │  200 { successCount: 1 }             │                               │
  │<─────────────────────────────────────│                               │
  │                                      │                               │
  │  onMessage() fires (if tab focused)  │                               │
  │  OR SW shows notification (bg)       │                               │
```

---

## Step-by-Step: How to Get a Real FCM Token

### Prerequisites
1. NestJS server is running: `cd apps/api && npx nest start`
2. Server log shows: `Nest application successfully started`
3. `FIREBASE_SERVICE_ACCOUNT_PATH=soli-food-delivery-FCM-key.json` in `apps/api/.env`

### Steps
1. Open Chrome/Edge (not Firefox — FCM has limited Firefox support)
2. Navigate to **`http://localhost:3000/fcm-test.html`** (copy-paste this URL)
3. Confirm the page title is "SoLi FCM Push Test Page" with no red warning banner
4. Click **"Request Permission & Get Token"**
5. Allow notifications when the browser prompts
6. Wait ~2 seconds — the event log should show:
   ```
   ✓ Service worker registered and ready.
   ✓ Notification permission granted.
   ✓ FCM token obtained (163 chars).
   ```
7. The token appears in the textarea — copy it

### If `getToken()` Fails

| Error message | Cause | Fix |
|--------------|-------|-----|
| `SW registration failed (404)` | Wrong origin | Open from `http://localhost:3000/fcm-test.html` |
| `Failed to execute 'subscribe' on 'PushManager': The provided applicationServerKey is not valid` | VAPID key mismatch | Update `VAPID_KEY` in the HTML to match Firebase Console → Project Settings → Cloud Messaging → Web Push Certificates |
| `messaging/invalid-argument` | VAPID key wrong format | Same as above |
| `Messaging: We are unable to register the default service worker` | SW scope issue | The SW scope must be `/` — verify `register('/firebase-messaging-sw.js', { scope: '/' })` |

---

## Server-Side Push — Known Blockers

After getting a browser token, clicking **"Send via Backend"** calls `POST /api/notifications/test/push`.  
This may fail with:

```
messaging/mismatched-credential: Permission 'cloudmessaging.messages.create' denied
```

### Fix: Enable Firebase Cloud Messaging API

This is a GCP Console action — **you must do this manually**:

1. Go to: [Google Cloud Console → APIs & Services → Library](https://console.cloud.google.com/apis/library?project=soli-food-delivery)
2. Search for **"Firebase Cloud Messaging API"** → Enable it
3. Go to: [IAM → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts?project=soli-food-delivery)
4. Find `soli-food@soli-food-delivery.iam.gserviceaccount.com`
5. Grant role: **Firebase Cloud Messaging Admin** (`roles/firebasecloudmessaging.admin`)
   — or at minimum **Cloud Messaging Sender** scope

> **Note**: The browser generating a token does NOT require the service account permissions. Only sending a push (`POST /api/notifications/test/push`) requires them.

---

## ⚠️ Security Notice

The Firebase service account private key (`soli-food-delivery-FCM-key.json`) was briefly exposed in the development session.

**Action required:**
1. Open [GCP Console → IAM → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts?project=soli-food-delivery)
2. Find `soli-food@soli-food-delivery.iam.gserviceaccount.com`
3. Click "Keys" tab → delete key ID `7265c522fdc828ab4d273dffe35944aa3ffb8444`
4. Create a new key (JSON) → download → replace `apps/api/soli-food-delivery-FCM-key.json`
5. Verify `apps/api/.gitignore` contains `*-FCM-key.json` (✅ already done)

---

## File Reference

| File | Purpose |
|------|---------|
| [apps/api/public/fcm-test.html](../../public/fcm-test.html) | Browser test page — get FCM token, send test push |
| [apps/api/public/firebase-messaging-sw.js](../../public/firebase-messaging-sw.js) | FCM service worker (background message handling) |
| [apps/api/src/main.ts](../../src/main.ts) | `express.static` middleware serving `/public/` |
| [apps/api/src/module/notification/](../../src/module/notification/) | Notification BC — push channels, controller, service |

---

## Validation Checklist

- [x] `http://localhost:3000/firebase-messaging-sw.js` → HTTP 200 `text/javascript`
- [x] `http://localhost:3000/fcm-test.html` → HTTP 200 `text/html`
- [x] Origin guard shows red banner if opened from Live Server or `file://`
- [x] Origin guard shows "Go now" redirect button
- [x] SW registration error correctly identifies 404 as wrong-origin issue
- [x] `nest start` starts cleanly (89 unit tests, 62 E2E notification tests passing)
- [ ] Open `http://localhost:3000/fcm-test.html` in browser → no red banner
- [ ] Click "Request Permission" → SW registers → token generated
- [ ] (After GCP API enabled) Click "Send via Backend" → successCount: 1
