# Notification Context — Architectural Proposal

> **Document Type:** Living Design Document (Code-Verified)
> **Author Role:** Senior Software Architect
> **Status:** Phases N-1 through N-5 ✅ Fully Implemented | Phase N-6 (Retry Worker) 🔲 Pending
> **Target Project:** `SoLi-Food-Order-and-Deliver-App` / `apps/api`
> **Depends On:** Phase 5 (Order Lifecycle), Phase 6 (Downstream Event Stubs), Phase 8 (Payment Context)
> **Last Full Audit:** May 2026 — all facts cross-checked against source files
> **Source of Truth:** Actual codebase, NOT this document

### Change Legend

- **[DECISION]** — Architectural decision made with explicit rationale
- **[TRADEOFF]** — Design tradeoff with alternatives considered
- **[RISK]** — Known risk with mitigation strategy
- **[FUTURE]** — Deferred to a later phase or microservice extraction

---

## Table of Contents

1. [Context Overview](#1-context-overview)
2. [Scope & Boundaries](#2-scope--boundaries)
3. [Supported Notification Channels](#3-supported-notification-channels)
4. [Real-time Architecture](#4-real-time-architecture)
5. [Push Notification Architecture](#5-push-notification-architecture)
6. [Domain Model](#6-domain-model)
7. [Event Integration Design](#7-event-integration-design)
8. [Delivery Strategies](#8-delivery-strategies)
9. [Redis Usage](#9-redis-usage)
10. [Notification Preferences](#10-notification-preferences)
11. [Security & Authorization](#11-security--authorization)
12. [Failure Handling](#12-failure-handling)
13. [Observability](#13-observability)
14. [Scalability & Future Microservice Extraction](#14-scalability--future-microservice-extraction)
15. [API Design](#15-api-design)
16. [Database Design](#16-database-design)
17. [Phase-by-Phase Roadmap](#17-phase-by-phase-roadmap)
18. [Production Concerns](#18-production-concerns)
19. [Tradeoff Analysis](#19-tradeoff-analysis)
20. [Final Recommendation](#20-final-recommendation)

---

## 1. Context Overview

### 1.1 Role of the Notification Context

The **Notification Context** is a **downstream context** of both the Ordering BC and the Payment BC. Its sole responsibility is the reliable delivery of user-facing notifications across multiple channels: **in-app real-time** (WebSocket), **push** (FCM/APNs), **email**, and future SMS.

The Notification Context does **not** own order state, payment state, or user accounts. It reacts to domain events from upstream contexts and translates them into delivery-ready notification payloads for the appropriate recipient(s). It is a pure **read-side + delivery side** context — it never mutates upstream state and never calls upstream services directly.

### 1.2 Position in the Overall Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SoLi Platform (Modular Monolith)                    │
│                                                                             │
│   ┌──────────────────────────┐                                             │
│   │         ORDERING         │ ──── OrderPlacedEvent ───────────────────► │
│   │       (Core Domain)      │ ──── OrderStatusChangedEvent ─────────────► │
│   │                          │ ──── OrderReadyForPickupEvent ─────────────►│
│   │                          │ ──── OrderCancelledAfterPaymentEvent ──────►│
│   └──────────────────────────┘                                  │          │
│                                                                  │          │
│   ┌──────────────────────────┐                                  ▼          │
│   │         PAYMENT          │ ──── PaymentConfirmedEvent ─────────────►  │
│   │       (Downstream)       │ ──── PaymentFailedEvent ─────────────────► │
│   └──────────────────────────┘                           ┌──────────────┐  │
│                                                           │ NOTIFICATION │  │
│                                                           │  (Downstream)│  │
│                                                           │              │  │
│                                                           │ EventHandlers│  │
│                                                           │ NotifService │  │
│                                                           │ WS Gateway   │  │
│                                                           │ PushService  │  │
│                                                           └──────┬───────┘  │
│                                                                  │          │
└──────────────────────────────────────────────────────────────────│──────────┘
                    ┌────────────────────┬─────────────────────────┘
                    ▼                    ▼                    ▼
             WebSocket             FCM / APNs               Email
           (in-app live)          (mobile push)          (transactional)
              Client                 Device               Inbox
```

### 1.3 Upstream / Downstream Relationships

| Direction | Mechanism | What Is Transferred |
|-----------|-----------|---------------------|
| Ordering → Notification | `EventBus.publish()` (in-process CQRS) | `OrderPlacedEvent`, `OrderStatusChangedEvent`, `OrderReadyForPickupEvent`, `OrderCancelledAfterPaymentEvent` |
| Payment → Notification | `EventBus.publish()` (in-process CQRS) | `PaymentConfirmedEvent`, `PaymentFailedEvent` |
| Notification → User | WebSocket (Socket.IO) | Real-time notification payloads |
| Notification → Device | FCM / APNs HTTP | Push notification payloads |
| Notification → User | SMTP | Transactional email |
| Notification ← Client | REST + WebSocket handshake | Device token registration, mark-as-read, inbox queries |

> **Critical rule:** Notification BC never calls `OrderingModule`, `PaymentModule`, `RestaurantCatalogModule`, or any other BC's services or repositories directly. The sole exception is `RestaurantUpdatedEvent` consumption via the CQRS EventBus for local ACL projection — this is equivalent to what the Ordering BC already does, and it is the correct DDD pattern. If the event payload lacks a required field, Notification logs a WARN and uses graceful fallback text. It does **not** back-fill from upstream DB tables.

### 1.4 Why Notification Should Be Isolated as Its Own BC

Three reasons justify isolation over embedding notification logic inside Ordering or Payment:

1. **Single Responsibility**: Ordering orchestrates the business process; Notification delivers status updates. These have different change frequencies, different failure semantics, and different scaling requirements. A failed push notification must never affect order placement.

2. **Multi-channel Fan-out**: A single `OrderStatusChangedEvent` may trigger WebSocket delivery, FCM push, and email simultaneously. This cross-cutting fan-out logic has no natural home inside Ordering or Payment — it would create cohesion violations.

3. **Independent Scaling**: In production, the WebSocket gateway and push delivery workers typically need separate scaling from the API server. Isolating into a distinct BC (and later a microservice) allows independent horizontal scaling.

---

## 2. Scope & Boundaries

### 2.1 What Is Inside the Notification Context

| Concern | Description |
|---------|-------------|
| `Notification` aggregate lifecycle | Create, deliver, mark-read, expire |
| In-app notification inbox | Persist + query read-side for each user's notification list |
| Real-time WebSocket delivery | NestJS WebSocket Gateway (Socket.IO) for connected clients |
| Push notification delivery | FCM (Android + Web) and APNs (iOS) via `firebase-admin` |
| Email delivery | Transactional emails via `nodemailer` (order confirmation, receipts) |
| Device token management | Register, invalidate, clean up expired device tokens |
| Notification preferences | Per-user channel opt-in/out, quiet hours, muted categories |
| Notification idempotency | Prevent duplicate notifications from event retries or replays |
| Notification cleanup cron | Archive / hard-delete notifications older than retention window |
| Delivery attempt logging | Track each delivery attempt per channel (success/failure/retry count) |

### 2.2 What Is Outside the Notification Context

| Concern | Belongs To | How Notification Interacts |
|---------|------------|---------------------------|
| Order state | Ordering BC | Via event payload (no DB queries) |
| Payment state | Payment BC | Via event payload (no DB queries) |
| User profile data (name, email) | IAM / User Service | Via notification preferences snapshot or event payload |
| Shipper assignment | Delivery BC | Delivery BC publishes events; Notification subscribes |
| Restaurant data | Restaurant Catalog BC | Sourced from event payloads only |
| Authentication / JWT issuance | IAM (Better Auth) | WebSocket uses JWT from HTTP header during handshake |
| SMS gateway | Future | [FUTURE] Stubbed with TODO; twilio/SNS integration in Phase N-7+ |

---

## 3. Supported Notification Channels

### 3.1 In-App Real-time Notifications (WebSocket)

**Description:** The primary real-time channel. When a user's browser or mobile app is connected to the WebSocket gateway, notifications are delivered immediately with zero latency. This is the most important channel for a food delivery app where users expect live order tracking.

**Characteristics:**
- Bidirectional (client can acknowledge, mark-read over socket)
- Connection state is ephemeral — if the user disconnects, queued in-app notifications are delivered on reconnect via REST inbox API
- Scoped per `userId` via Socket.IO rooms — one user may have multiple open tabs/devices, all receive the event

**Status:** Phase N-2

### 3.2 Push Notifications (FCM + APNs)

**Description:** Delivered to mobile devices and browser service workers when the user is not actively connected. Uses Firebase Cloud Messaging (FCM) for Android and Web; APNs for iOS (via Firebase's APNs bridge — same `firebase-admin` SDK handles both).

**Characteristics:**
- Asynchronous — no delivery guarantee at transport layer
- Firebase provides delivery receipts; invalid tokens returned synchronously in response
- High importance for `OrderPlaced` and `ready_for_pickup` events
- Device token stored per user-device pair; multiple devices per user

**Status:** Phase N-4

### 3.3 Email

**Description:** Transactional email for longer-form notifications: order confirmation with itemized receipt, refund confirmation, payment failure with retry instructions.

**Characteristics:**
- Low latency requirement (delivery within minutes acceptable)
- Rich HTML template capability
- User must have email in their profile; sourced from `notification_preferences`
- Use `nodemailer` with SMTP (SendGrid or AWS SES in production)

**Status:** Phase N-4

### 3.4 Notification Center / Inbox

**Description:** A persistent in-app inbox where all `in_app` channel notifications are stored and queryable via REST API. Persisted in the `notifications` table. Supports unread count, mark-as-read, pagination.

**Status:** Phase N-3

### 3.5 SMS [FUTURE]

**Description:** Reserved for critical alerts only (order cancellation after payment, delivery failure). Not in scope for initial phases due to cost and regulatory complexity in Vietnam.

**Status:** [FUTURE] — Twilio or Viettel SMS Gateway integration in a later phase

---

## 4. Real-time Architecture

This section analyses all viable approaches and makes an explicit recommendation for this project.

### 4.1 Option A — NestJS WebSocket Gateway (Socket.IO) (OK I CHOOSE THIS OPTION)

```
Client (browser/mobile)
  ↕ Socket.IO transport (WS upgrade from HTTP)
NestJS @WebSocketGateway()
  ↕ Socket.IO server instance
Redis Pub/Sub adapter (socket.io-redis / @socket.io/redis-adapter)
  ↕ ioredis
Other API server instances (when horizontally scaled)
```

**Pros:**
- First-class NestJS support (`@WebSocketGateway`, `@SubscribeMessage`, `@ConnectedSocket`)
- Socket.IO handles reconnection, namespace/room management, fallback transport (polling)
- Room-based delivery: `server.to(userId).emit(...)` delivers to all of a user's connected clients
- Redis adapter (`@socket.io/redis-adapter`) is a one-line drop-in for horizontal scaling
- Existing `ioredis` dependency already installed — no new infrastructure

**Cons:**
- Requires TCP upgrade (most proxies handle WS correctly, but some corporate firewalls block it)
- Socket.IO adds ~2KB JS overhead on the client
- More complex than SSE for unidirectional use cases

**Scalability:** Excellent — `@socket.io/redis-adapter` publishes events through Redis Pub/Sub so all nodes receive and forward to their local sockets. No sticky sessions required.

**Microservice migration:** When Notification becomes a microservice, the WebSocket gateway stays in that service. Only the Redis adapter configuration changes (same Redis cluster, different connection string).

**Operational complexity:** Medium. Requires understanding Socket.IO room lifecycle and proper cleanup on disconnect.

---

### 4.2 Option B — Server-Sent Events (SSE)

```
Client ← HTTP long-lived connection (EventSource)
NestJS @Sse() endpoint returns Observable<MessageEvent>
```

**Pros:**
- HTTP-native (no TCP upgrade) — works through all proxies and firewalls
- Simpler server code — `response.write()` on a long-lived HTTP connection
- Native reconnect support in browsers

**Cons:**
- Unidirectional only (server → client). Cannot receive acknowledgements or `mark-as-read` events over SSE
- Connection state is tied to the HTTP connection lifecycle — load balancers with connection timeouts require client-side heartbeat handling
- No built-in room / fan-out mechanism — must implement per-user connection registry manually
- **Critical problem for horizontal scaling:** SSE connections are inherently sticky. Without sticky sessions, a notification published on Node A cannot reach a client connected to Node B. Requires a Redis Pub/Sub bridge at the application level (duplicates what Socket.IO's Redis adapter does, but without the mature ecosystem)

**Scalability:** Poor without significant custom infrastructure.

**Microservice migration:** SSE endpoint must live in the same process as the WebSocket. Adding a Redis bridge manually negates the simplicity advantage.

**Operational complexity:** Medium-high for scaled deployment despite low initial complexity.

---

### 4.3 Option C — Native WebSocket (`ws` library)

```
Client ↔ ws.Server (raw WebSocket)
NestJS @WebSocketGateway({ ... }) with custom adapter
```

**Pros:**
- Minimal overhead (no Socket.IO protocol layer)
- Lower memory footprint per connection

**Cons:**
- No room management built-in — must implement manually
- No automatic reconnection on the client side
- No fallback transport
- No horizontal scaling adapter for raw `ws`
- NestJS WebSocket documentation and examples heavily favor Socket.IO

**Recommendation:** Reject. The `ws` library is appropriate for systems where every byte matters (e.g., high-frequency trading). For a food delivery notification system, Socket.IO's room management, reconnection, and Redis adapter are strictly superior at the cost of negligible overhead.

---

### 4.4 Option D — Polling

```
Client → GET /notifications/unread-count (every N seconds)
Client → GET /notifications (on count change)
```

**Pros:**
- Trivially simple to implement
- Stateless — works with any load balancer, no sticky sessions

**Cons:**
- High server load at scale (N requests/second × number of users)
- Latency = poll interval (unacceptable for "your order is on the way" use case)
- Battery drain on mobile

**Recommendation:** Reject for real-time channel. Retain REST inbox API as the recovery mechanism for missed WebSocket events (not as the primary channel).

---

### 4.5 Option E — Redis Pub/Sub as primary channel (no WebSocket)

```
Backend → PUBLISH notification:userId payload
Client (SSE/polling) → SUBSCRIBE or poll
```

**Pros:**
- Redis already available

**Cons:**
- Redis Pub/Sub has no persistence — messages published when no subscriber is listening are lost forever
- Requires an HTTP-level relay layer anyway (SSE or WebSocket) to reach the browser
- Does not replace the WebSocket gateway; it is a complement to it

**Recommendation:** Use Redis Pub/Sub as the **scaling adapter** for Socket.IO, not as the primary real-time channel.

---

### 4.6 Option F — External Message Broker (Kafka / RabbitMQ)

**Pros:**
- At-least-once delivery with persistence
- Excellent for high-throughput notification pipelines
- Natural fit for microservice extraction

**Cons:**
- Adds significant operational complexity (Kafka cluster, Zookeeper or KRaft mode)
- Overengineered for a modular monolith with a single API process
- In-process `EventBus` already provides reliable event delivery within the monolith
- The external broker becomes relevant when Notification is extracted as a microservice

**Recommendation:** [FUTURE] Design event handler interfaces so they can be replaced with Kafka consumers with minimal code changes, but do not introduce Kafka now.

---

### 4.7 Recommendation: Socket.IO with NestJS WebSocket Gateway (OK I AGREE)

**[DECISION]** Use `@nestjs/websockets` + `socket.io` as the real-time transport.

**Rationale:**
1. NestJS has first-class Socket.IO support matching the project's existing NestJS architecture
2. Room-based delivery (`server.to(userId).emit(...)`) maps perfectly to the multi-device notification fan-out requirement
3. `@socket.io/redis-adapter` (single dependency) converts the single-process gateway into a horizontally scalable one — critical for future extraction
4. The project already has `ioredis` — no new infrastructure for the scaling adapter
5. Socket.IO's reconnection and transport fallback eliminates a class of mobile network reliability bugs

**Required packages:**
```
# Core WebSocket support (decorators + abstractions)
@nestjs/websockets

# Socket.IO server implementation
socket.io

# Phase N-6 only: Redis adapter for horizontal scaling
@socket.io/redis-adapter
```

> **Important:** Do NOT install `@nestjs/platform-socket.io`. That package replaces the HTTP platform adapter (`@nestjs/platform-express`) and is unrelated to WebSocket support. The HTTP server continues to use `@nestjs/platform-express`. WebSocket support is layered on top via `@nestjs/websockets` + `socket.io`.

**Phase N-1: No Redis adapter.** Single process; in-process EventBus events directly reach the WebSocket gateway. Room mapping held in memory.

**Phase N-6+: Add Redis adapter.** When horizontal scaling is needed, add `@socket.io/redis-adapter` — the application code does not change; only the gateway setup changes.

```typescript
// Phase N-1 (single process)
@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN ?? '*' },
  namespace: '/notifications',
})
export class NotificationGateway { ... }

// Phase N-6+ (multi-process — two dedicated ioredis connections for adapter pub/sub)
// NOTE: pubClient and subClient must be DEDICATED connections (cannot share the
// application's main REDIS_CLIENT — pub/sub mode blocks regular commands).
const pubClient = new Redis(REDIS_URL);
const subClient = pubClient.duplicate();
this.server.adapter(createAdapter(pubClient, subClient));
```

---

## 5. Push Notification Architecture

### 5.1 FCM (Firebase Cloud Messaging)

FCM is the push delivery mechanism for:
- **Android** devices (native FCM)
- **Web** browsers (Web Push via FCM)

The FCM v1 API (HTTP v1, not the legacy API) is used exclusively. It uses OAuth2 `service account` credentials stored as a JSON file or environment variable.

**NestJS integration:** `firebase-admin` npm package. Initialized once in `NotificationModule` as a singleton provider.

```typescript
// In NotificationModule providers
{
  provide: FIREBASE_APP,
  useFactory: () =>
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
    }),
}
```

### 5.2 APNs (Apple Push Notification service)

For iOS devices, `firebase-admin` handles APNs delivery transparently via its **APNs bridge** — when an FCM token is registered from an iOS app that uses Firebase, FCM proxies the delivery to APNs. The application code does not need to call APNs directly.

> **Why this matters:** The application only needs one `firebase-admin` call regardless of platform. The `platform` field on `device_tokens` is still stored (`'ios' | 'android' | 'web'`) because:
> - Invalid token detection differs slightly per platform
> - iOS notification permissions require `sound` and `badge` fields in the APNs payload
> - If the team ever migrates iOS to direct APNs (not through Firebase), the `platform` field is already present

### 5.3 Device Token Lifecycle

```
Register device        → INSERT INTO device_tokens (user_id, token, platform)
                         ON CONFLICT (user_id, token) DO UPDATE SET last_seen_at = NOW(), is_active = true

Successful push        → UPDATE device_tokens SET last_seen_at = NOW()

FCM returns            → UPDATE device_tokens SET is_active = false
  INVALID_REGISTRATION   (token expired, app uninstalled)
  NOT_REGISTERED

Cleanup cron           → DELETE FROM device_tokens
  (Phase N-5)            WHERE is_active = false AND last_seen_at < NOW() - INTERVAL '30 days'
                         OR (is_active = true AND last_seen_at < NOW() - INTERVAL '90 days')
```

### 5.4 Multiple Devices Per User

One user may have multiple active device tokens (iPhone + Android tablet + web browser). The `PushService.sendToUser(userId, payload)` method:

1. Queries `device_tokens WHERE user_id = $1 AND is_active = true`
2. Fans out to all active tokens using `admin.messaging().sendEach([...messages])`
3. Inspects `BatchResponse.responses` — any `INVALID_REGISTRATION` or `NOT_REGISTERED` responses trigger immediate token deactivation

```typescript
// PushService.sendToUser — skeletal structure
async sendToUser(userId: string, notification: PushPayload): Promise<void> {
  const tokens = await this.deviceTokenRepo.findActiveByUserId(userId);
  if (tokens.length === 0) return;

  const messages: TokenMessage[] = tokens.map((t) => ({
    token: t.token,
    notification: { title: notification.title, body: notification.body },
    data: notification.data,
    android: { priority: 'high' },
    apns: { headers: { 'apns-priority': '10' } },
  }));

  const batchResponse = await this.firebaseApp.messaging().sendEach(messages);

  // Deactivate invalid tokens immediately
  const invalidTokens = tokens.filter(
    (_, i) =>
      batchResponse.responses[i].error?.code === 'messaging/invalid-registration-token' ||
      batchResponse.responses[i].error?.code === 'messaging/registration-token-not-registered',
  );
  if (invalidTokens.length > 0) {
    await this.deviceTokenRepo.deactivateMany(invalidTokens.map((t) => t.token));
  }
}
```

### 5.5 Notification Delivery Guarantees

| Channel | Guarantee | Mechanism |
|---------|-----------|-----------|
| WebSocket | At-most-once (connection required) | In-memory delivery; fallback via inbox REST API |
| FCM/APNs | At-least-once (with retry, provider-side) | FCM queues up to 4 weeks; our retry policy is 3 attempts |
| Email | At-least-once (with retry) | SMTP with retry on `ECONNRESET`; idempotency key prevents double-send |
| In-app inbox | Exactly-once (DB idempotency) | UNIQUE constraint on `idempotency_key` in `notifications` table |

**Critical principle:** WebSocket delivery failure is not an error condition. The in-app inbox is the ground truth; WebSocket is an optimization. If a notification row exists in the DB, the user can always retrieve it via REST API.

### 5.6 Retry Strategy

```
Attempt 1: immediate
Attempt 2: +30 seconds (exponential backoff base)
Attempt 3: +120 seconds
Giveup:    log at ERROR level, mark delivery_log status = 'permanently_failed'
```

In Phase N-1 through N-5, retries are handled synchronously within the event handler with `try/catch`. Phase N-6 introduces a proper retry queue using Redis SORTED SET (score = next attempt timestamp).

### 5.7 Rate Limiting

FCM has per-project quotas (1M messages/minute for most plans). For a food delivery app at early scale this is not a concern. However, the `PushService` should track message count via Redis `INCR` with a 60-second TTL window so rate limit errors trigger a circuit breaker rather than cascading retries.

---

## 6. Domain Model

### 6.1 NotificationType Enum

```typescript
export const NOTIFICATION_TYPES = [
  // Ordering events
  'order_placed',              // Customer: order successfully placed
  'order_confirmed',           // Customer: restaurant confirmed
  'order_preparing',           // Customer: restaurant started cooking
  'order_ready_for_pickup',    // (internal — Delivery BC, not customer)
  'order_picked_up',           // Customer: shipper collected
  'order_delivering',          // Customer: on the way
  'order_delivered',           // Customer: delivered
  'order_cancelled',           // Customer + Restaurant: order cancelled
  'order_refunded',            // Customer: refund processed (delivered→refunded)

  // Payment events
  'payment_confirmed',         // Customer: VNPay payment succeeded
  'payment_failed',            // Customer: VNPay payment failed

  // Refund events
  'refund_initiated',          // Customer: refund process started
  'refund_completed',          // Customer: money returned (future — when refund webhook available)

  // Restaurant-facing events
  'new_order_received',        // Restaurant: new order waiting for confirmation

  // Shipper-facing events (future — Delivery BC)
  'pickup_request',            // Shipper: order available for pickup [RESERVED: requires ShipperAssignedEvent from Delivery BC]

  // These types are present in the enum now so that event handlers can reference them
  // without a breaking enum change when the Delivery BC and full refund webhook are added.
  'order_ready_for_pickup',    // [RESERVED: for Delivery BC ShipperAssignedEvent — not yet triggered]
  'refund_completed',          // [RESERVED: for Payment BC refund webhook — VNPay does not currently send one]

  // System
  'system_announcement',       // Admin broadcast
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
```

### 6.2 NotificationChannel Enum

```typescript
export const NOTIFICATION_CHANNELS = ['in_app', 'push', 'email', 'sms'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
```

### 6.3 NotificationStatus Enum

```typescript
export const NOTIFICATION_STATUSES = [
  'pending',             // Created, not yet attempted
  'sent',                // Dispatched to channel provider (FCM ACKed, SMTP queued)
  'delivered',           // Provider confirmed delivery (FCM delivery receipt)
  'read',                // User opened / marked-as-read
  'failed',              // Delivery failed after all retries
  'permanently_failed',  // Exhausted retries; archived for audit
] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];
```

### 6.4 Notification Entity

```typescript
// domain/notification.schema.ts

export const notificationStatusEnum = pgEnum('notification_status', [
  'pending', 'sent', 'delivered', 'read', 'failed', 'permanently_failed',
]);

export const notificationChannelEnum = pgEnum('notification_channel', [
  'in_app', 'push', 'email', 'sms',
]);

export const notificationTypeEnum = pgEnum('notification_type', [
  /* ... all NotificationType values ... */
]);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // --- Recipient ---
    // Cross-context reference — no FK constraint (D-P7: microservice-readiness)
    recipientId: uuid('recipient_id').notNull(),
    recipientRole: text('recipient_role').notNull(), // 'customer' | 'restaurant' | 'shipper' | 'admin'

    // --- Classification ---
    type: notificationTypeEnum('type').notNull(),
    channel: notificationChannelEnum('channel').notNull(),

    // --- Content ---
    title: text('title').notNull(),
    body: text('body').notNull(),
    // Structured data for deep links / frontend routing
    // e.g. { orderId: 'abc', screen: 'OrderDetail' }
    data: jsonb('data').$type<Record<string, string>>(),

    // --- State ---
    status: notificationStatusEnum('status').notNull().default('pending'),
    isRead: boolean('is_read').notNull().default(false),
    readAt: timestamp('read_at', { withTimezone: true }),

    // --- Context reference (no FK) ---
    orderId: uuid('order_id'),      // Optional — sourced from triggering event

    // --- Idempotency ---
    // Format: `notif:{type}:{sourceId}:{recipientId}`
    // e.g., `notif:order_placed:order-uuid:customer-uuid`
    // UNIQUE constraint prevents duplicate rows even under event replay
    idempotencyKey: text('idempotency_key').unique(),

    // --- Delivery tracking ---
    deliveryAttempts: integer('delivery_attempts').notNull().default(0),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),

    // --- Timestamps ---
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }), // for cleanup cron
  },
  (t) => [
    // Fast lookup: all notifications for a recipient, newest first
    index('notif_recipient_created_idx').on(t.recipientId, t.createdAt),
    // Fast unread count query
    index('notif_recipient_unread_idx').on(t.recipientId, t.isRead).where(sql`is_read = false`),
    // Fast order-scoped notification lookup (admin/support tooling)
    index('notif_order_idx').on(t.orderId).where(sql`order_id IS NOT NULL`),
    // Cleanup cron: find expired notifications
    index('notif_expires_at_idx').on(t.expiresAt).where(sql`expires_at IS NOT NULL`),
    // Retry queue: find notifications due for retry
    index('notif_retry_idx').on(t.nextRetryAt).where(sql`status = 'failed' AND next_retry_at IS NOT NULL`),
  ],
);
```

### 6.5 DeviceToken Entity

```typescript
// domain/device-token.schema.ts

export const devicePlatformEnum = pgEnum('device_platform', ['ios', 'android', 'web']);

export const deviceTokens = pgTable(
  'device_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),               // No FK (D-P7)
    token: text('token').notNull(),                  // FCM registration token
    platform: devicePlatformEnum('platform').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('device_token_user_token_unique').on(t.userId, t.token),
    index('device_token_user_active_idx').on(t.userId, t.isActive),
  ],
);
```

### 6.6 NotificationPreference Entity

```typescript
// domain/notification-preference.schema.ts

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().unique(),        // One row per user

    // Per-channel opt-in
    pushEnabled: boolean('push_enabled').notNull().default(true),
    inAppEnabled: boolean('in_app_enabled').notNull().default(true),
    emailEnabled: boolean('email_enabled').notNull().default(true),
    smsEnabled: boolean('sms_enabled').notNull().default(false),

    // Quiet hours (24h format, inclusive range; null = no quiet hours)
    quietHoursStart: integer('quiet_hours_start'),  // 0-23
    quietHoursEnd: integer('quiet_hours_end'),      // 0-23

    // Muted notification types (JSONB array of NotificationType)
    mutedTypes: jsonb('muted_types').$type<NotificationType[]>().default([]),

    // User's email address — stored here to avoid querying IAM at notification time.
    // Kept in sync via UserProfileUpdatedEvent (future) or populated at registration.
    email: text('email'),

    // Timezone for quiet hours calculation (IANA tz string, e.g. 'Asia/Ho_Chi_Minh').
    // Without this field, quiet hours use UTC which is wrong for Vietnam (UTC+7).
    // Use 'Asia/Ho_Chi_Minh' as default — correct for the primary market.
    // Evaluated with dayjs.tz(new Date(), prefs.timezone).hour() in isQuietHours().
    timezone: text('timezone').notNull().default('Asia/Ho_Chi_Minh'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
);
```

### 6.7 NotificationTemplate (In-code, not DB)

Rather than storing templates in the database (which would require a CMS and migration for every copy change), notification templates are defined in a TypeScript template registry. This decision aligns with the existing codebase's preference for compile-time type safety over runtime configuration.

```typescript
// services/notification-template.service.ts

export interface NotificationTemplate {
  title: (data: Record<string, string>) => string;
  body:  (data: Record<string, string>) => string;
}

export const NOTIFICATION_TEMPLATES: Record<NotificationType, NotificationTemplate> = {
  order_placed: {
    title: () => 'Order Placed',
    body: (d) => `Your order from ${d.restaurantName} has been received. We're waiting for the restaurant to confirm.`,
  },
  order_confirmed: {
    title: () => 'Order Confirmed',
    body: (d) => `${d.restaurantName} confirmed your order and will start preparing it soon.`,
  },
  order_preparing: {
    title: () => 'Being Prepared',
    body: (d) => `${d.restaurantName} is now preparing your order.`,
  },
  order_picked_up: {
    title: () => 'Order Picked Up',
    body: () => `A shipper has picked up your order and is on the way.`,
  },
  order_delivering: {
    title: () => 'On the Way',
    body: () => `Your order is en route. Get ready!`,
  },
  order_delivered: {
    title: () => 'Delivered!',
    body: (d) => `Your order from ${d.restaurantName} has been delivered. Enjoy!`,
  },
  order_cancelled: {
    title: () => 'Order Cancelled',
    body: (d) => `Your order has been cancelled${d.note ? ': ' + d.note : '.'}`,
  },
  order_refunded: {
    title: () => 'Refund Processed',
    body: (d) => `A refund of ${d.amount} VND has been initiated for your order.`,
  },
  payment_confirmed: {
    title: () => 'Payment Successful',
    body: (d) => `Your payment of ${d.amount} VND was successful.`,
  },
  payment_failed: {
    title: () => 'Payment Failed',
    body: (d) => `Your payment failed: ${d.reason}. Please try placing a new order.`,
  },
  refund_initiated: {
    title: () => 'Refund Initiated',
    body: (d) => `A refund of ${d.amount} VND is being processed. Please allow 3-5 business days.`,
  },
  new_order_received: {
    title: () => 'New Order!',
    body: (d) => `You have a new order. Please confirm within ${d.deadlineMinutes ?? 5} minutes.`,
  },
  // ... remaining types
};
```

> **[TRADEOFF]** DB-backed templates vs. in-code templates: DB templates allow non-developer content changes but require a migration or admin UI. In-code templates are versioned with code and immediately testable. For a startup-phase app this is the correct choice; migrate to DB templates when a marketing team needs to A/B test copy.

### 6.8 NotificationDeliveryLog Entity

A separate `notification_delivery_logs` table records each delivery attempt. This is the **audit trail** — separate from the `notifications` table which holds the canonical notification state.

```typescript
// domain/notification-delivery-log.schema.ts

export const deliveryAttemptStatusEnum = pgEnum('delivery_attempt_status', [
  'success', 'failed', 'retrying',
]);

export const notificationDeliveryLogs = pgTable(
  'notification_delivery_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    notificationId: uuid('notification_id').notNull(), // Logical FK — no constraint (D-P7)
    channel: notificationChannelEnum('channel').notNull(),
    status: deliveryAttemptStatusEnum('status').notNull(),
    attemptNumber: integer('attempt_number').notNull(),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('delivery_log_notification_idx').on(t.notificationId),
  ],
);
```

---

## 7. Event Integration Design

### 7.1 Events Consumed by Notification BC

All events are received via NestJS CQRS EventBus (in-process). The Notification BC registers `@EventsHandler` classes that match the exact same pattern used by the Payment BC's `OrderCancelledAfterPaymentHandler` and the Ordering BC's `PaymentConfirmedEventHandler`.

**No new events need to be added to `shared/events/`.** All required events already exist.

### 7.2 Event-to-Notification Mapping

| Event | Source BC | Recipient(s) | NotificationType | Channels |
|-------|-----------|-------------|-----------------|----------|
| `OrderPlacedEvent` | Ordering | Customer (`customerId`) | `order_placed` | in_app, push |
| `OrderPlacedEvent` | Ordering | Restaurant (`restaurantId`) | `new_order_received` | in_app, push |
| `OrderStatusChangedEvent` (`pending→paid`) | Ordering | — | *(no notification — `PaymentConfirmedEvent` already notified the customer; order is not yet confirmed by restaurant)* | — |
| `OrderStatusChangedEvent` (`pending→confirmed`) | Ordering | Customer | `order_confirmed` | in_app, push |
| `OrderStatusChangedEvent` (`confirmed→preparing`) | Ordering | Customer | `order_preparing` | in_app, push |
| `OrderStatusChangedEvent` (`ready_for_pickup→picked_up`) | Ordering | Customer | `order_picked_up` | in_app, push |
| `OrderStatusChangedEvent` (`picked_up→delivering`) | Ordering | Customer | `order_delivering` | in_app, push |
| `OrderStatusChangedEvent` (`delivering→delivered`) | Ordering | Customer | `order_delivered` | in_app, push, email |
| `OrderStatusChangedEvent` (`*→cancelled`) | Ordering | Customer + Restaurant owner (via ACL snapshot) | `order_cancelled` | in_app, push, email |
| `OrderStatusChangedEvent` (`delivered→refunded`) | Ordering | Customer | `order_refunded` | in_app, push, email |
| `OrderStatusChangedEvent` (`paid→confirmed`) | Ordering | Customer | `order_confirmed` | in_app, push |
| `PaymentConfirmedEvent` | Payment | Customer | `payment_confirmed` | in_app, push |
| `PaymentFailedEvent` | Payment | Customer | `payment_failed` | in_app, push, email |
| `OrderCancelledAfterPaymentEvent` | Ordering | Customer | `refund_initiated` | in_app, push, email |
| `OrderReadyForPickupEvent` | Ordering | *(Delivery BC scope — no direct Notification action until Delivery BC assigns shipper)* | — | — |

> **Note on `OrderReadyForPickupEvent`:** This event signals that the food is ready and a shipper should be dispatched. In the current architecture (without a Delivery BC), no shipper ID is available at this point — the shipper self-assigns via T-09. Therefore, the Notification BC cannot notify a specific shipper from `OrderReadyForPickupEvent`. When the Delivery BC is implemented, it will publish a `ShipperAssignedEvent` containing the `shipperId`, which Notification BC will subscribe to.

> **Note on Restaurant status events:** `OrderStatusChangedEvent` events where `triggeredByRole === 'restaurant'` were initiated by the restaurant itself — no notification is needed back to the actor who triggered it. The mapping logic in `OrderStatusChangedHandler` must filter these cases.

### 7.5 Restaurant ACL Projection (Critical)

The Notification BC must maintain its own minimal ACL snapshot of restaurants to resolve `restaurantId → ownerId`. This mirrors the Ordering BC's `AclModule` pattern exactly.

```typescript
// acl/notification-restaurant-snapshot.schema.ts
export const notificationRestaurantSnapshots = pgTable(
  'notification_restaurant_snapshots',
  {
    restaurantId: uuid('restaurant_id').primaryKey(),
    ownerId: uuid('owner_id').notNull(),
    name: text('name').notNull(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }).notNull().defaultNow(),
  },
);
```

```typescript
// acl/restaurant-snapshot.projector.ts
@Injectable()
@EventsHandler(RestaurantUpdatedEvent)
export class NotificationRestaurantSnapshotProjector
  implements IEventHandler<RestaurantUpdatedEvent>
{
  async handle(event: RestaurantUpdatedEvent): Promise<void> {
    // Upsert: ON CONFLICT (restaurant_id) DO UPDATE
    await this.repo.upsert({
      restaurantId: event.restaurantId,
      ownerId: event.ownerId,
      name: event.name,
      lastSyncedAt: new Date(),
    });
  }
}
```

**Multiple handlers for `RestaurantUpdatedEvent`:** Both the Ordering BC's `RestaurantSnapshotProjector` and the Notification BC's `NotificationRestaurantSnapshotProjector` register `@EventsHandler(RestaurantUpdatedEvent)`. NestJS CQRS EventBus fans out to all registered handlers — both receive the event independently. This is correct and expected behavior.

**Missing snapshot race condition:** It is possible for an `OrderPlacedEvent` to arrive before the `RestaurantUpdatedEvent` for a newly created restaurant (if the restaurant was just approved). This is handled by the graceful fallback in `OrderPlacedNotificationHandler.buildRestaurantNotification()` — log WARN, skip notification, do not fail. The next order for that restaurant will succeed once the snapshot is synced.

**Additions to `NotificationModule`:**
- `notification_restaurant_snapshots` Drizzle table (new Drizzle migration in Phase N-1)
- `NotificationRestaurantAclRepository` provider
- `NotificationRestaurantSnapshotProjector` provider (registered as `@EventsHandler`)
- `CqrsModule` import already covers this

---

### 7.3 Handler Structure

Each event handler follows the **same pattern** as `OrderCancelledAfterPaymentHandler` in the Payment BC: `@EventsHandler`, `IEventHandler<T>`, never rethrow, always `try/catch`, log at ERROR on failure.

> **Critical architectural note on `restaurantId` vs restaurant owner `userId`:**
>
> `OrderPlacedEvent.restaurantId` is the restaurant **entity** ID, not the restaurant owner's **user** ID. The WebSocket gateway routes to rooms keyed by `userId` (`user:{userId}`). The Notification BC cannot query the Ordering BC's `ordering_restaurant_snapshots` table (cross-BC boundary violation).
>
> **Resolution (ACL Projection Pattern):** The Notification BC maintains its own minimal ACL snapshot (`notification_restaurant_snapshots`) by subscribing to `RestaurantUpdatedEvent` — the exact same pattern used by the Ordering BC in its `AclModule`. This snapshot stores only `restaurantId → ownerId` (and `restaurantName` for template data). See Section 7.5 for the full design.

```typescript
// events/order-placed.handler.ts

@Injectable()
@EventsHandler(OrderPlacedEvent)
export class OrderPlacedNotificationHandler implements IEventHandler<OrderPlacedEvent> {
  private readonly logger = new Logger(OrderPlacedNotificationHandler.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly restaurantAclRepo: NotificationRestaurantAclRepository,
  ) {}

  async handle(event: OrderPlacedEvent): Promise<void> {
    try {
      // Resolve restaurant owner's user ID from local ACL snapshot.
      // If the snapshot is missing (race condition: restaurant created but event
      // not yet synced), log WARN and skip restaurant notification.
      // The customer notification is always attempted regardless.
      const restaurantOwnerTask = this.buildRestaurantNotification(event);
      const customerTask = this.notificationService.sendFromEvent({
        type: 'order_placed',
        recipientId: event.customerId,
        recipientRole: 'customer',
        sourceId: event.orderId,
        templateData: { restaurantName: event.restaurantName },
        channels: ['in_app', 'push'],
        orderId: event.orderId,
      });

      const results = await Promise.allSettled([customerTask, restaurantOwnerTask]);

      // Log individual failures — allSettled guarantees both run to completion
      results.forEach((result, i) => {
        if (result.status === 'rejected') {
          this.logger.error(
            `OrderPlacedNotificationHandler fan-out[${i}] failed for order=${event.orderId}: ${result.reason}`,
          );
        }
      });
    } catch (err) {
      // Safety net for unexpected synchronous errors
      this.logger.error(
        `OrderPlacedNotificationHandler failed for order=${event.orderId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  private async buildRestaurantNotification(event: OrderPlacedEvent): Promise<void> {
    const snapshot = await this.restaurantAclRepo.findByRestaurantId(event.restaurantId);
    if (!snapshot) {
      this.logger.warn(
        `No ACL snapshot for restaurant ${event.restaurantId} — skipping new_order_received notification for order ${event.orderId}`,
      );
      return;
    }
    await this.notificationService.sendFromEvent({
      type: 'new_order_received',
      recipientId: snapshot.ownerId,   // ← actual user ID, not restaurantId
      recipientRole: 'restaurant',
      sourceId: event.orderId,
      templateData: { deadlineMinutes: '5' },
      channels: ['in_app', 'push'],
      orderId: event.orderId,
    });
  }
}
```

> **Why `Promise.allSettled` not `Promise.all`:** A push notification failure to the restaurant must not prevent the customer's in-app notification from being sent. `allSettled` ensures both attempts complete independently. Individual rejections are logged but do not abort sibling tasks.

### 7.4 OrderStatusChangedEvent Fan-out Logic

`OrderStatusChangedEvent` carries `fromStatus` and `toStatus` — the handler maps these to `NotificationType`:

```typescript
// Mapping table (implemented as a constant, not a switch-case)
const STATUS_TRANSITION_NOTIFICATION: Partial<
  Record<`${OrderStatus}→${OrderStatus}`, {
    type: NotificationType;
    notifyCustomer: boolean;
    notifyRestaurant: boolean;
    notifyShipper: boolean;
    channels: NotificationChannel[];
    excludeTriggeringRole?: boolean; // don't notify the actor who triggered the transition
  }>
> = {
  'pending→confirmed':           { type: 'order_confirmed',   notifyCustomer: true,  notifyRestaurant: false, notifyShipper: false, channels: ['in_app', 'push'], excludeTriggeringRole: false },
  'paid→confirmed':              { type: 'order_confirmed',   notifyCustomer: true,  notifyRestaurant: false, notifyShipper: false, channels: ['in_app', 'push'], excludeTriggeringRole: false },
  'confirmed→preparing':         { type: 'order_preparing',   notifyCustomer: true,  notifyRestaurant: false, notifyShipper: false, channels: ['in_app', 'push'], excludeTriggeringRole: false },
  'ready_for_pickup→picked_up':  { type: 'order_picked_up',   notifyCustomer: true,  notifyRestaurant: false, notifyShipper: false, channels: ['in_app', 'push'], excludeTriggeringRole: false },
  'picked_up→delivering':        { type: 'order_delivering',  notifyCustomer: true,  notifyRestaurant: false, notifyShipper: false, channels: ['in_app', 'push'], excludeTriggeringRole: false },
  'delivering→delivered':        { type: 'order_delivered',   notifyCustomer: true,  notifyRestaurant: false, notifyShipper: false, channels: ['in_app', 'push', 'email'], excludeTriggeringRole: false },
  'delivered→refunded':          { type: 'order_refunded',    notifyCustomer: true,  notifyRestaurant: false, notifyShipper: false, channels: ['in_app', 'push', 'email'], excludeTriggeringRole: false },
  // Cancellations — notify customer regardless of who triggered
  'pending→cancelled':           { type: 'order_cancelled',   notifyCustomer: true,  notifyRestaurant: true,  notifyShipper: false, channels: ['in_app', 'push', 'email'], excludeTriggeringRole: true },
  'paid→cancelled':              { type: 'order_cancelled',   notifyCustomer: true,  notifyRestaurant: true,  notifyShipper: false, channels: ['in_app', 'push', 'email'], excludeTriggeringRole: true },
  'confirmed→cancelled':         { type: 'order_cancelled',   notifyCustomer: true,  notifyRestaurant: true,  notifyShipper: false, channels: ['in_app', 'push', 'email'], excludeTriggeringRole: true },
  //
  // Intentionally omitted transitions (no customer-visible notification):
  //   'pending→paid'              — T-02 system transition; PaymentConfirmedEvent already notified customer
  //   'confirmed→preparing'       — wait, this IS in the map above (order_preparing). Remove this note.
  //   'preparing→ready_for_pickup' — T-08: food ready for shipper pickup. This is an internal
  //                                   kitchen/delivery signal, NOT a customer-visible state change.
  //                                   Customers do not need a "food ready" push; they care about
  //                                   "shipper picked up" (T-09 → order_picked_up, which IS mapped).
  //                                   When Delivery BC is implemented, it will publish ShipperAssignedEvent
  //                                   which Notification BC will consume for the shipper-facing 'pickup_request'.
};
```

`excludeTriggeringRole: true` means: suppress the notification to whichever party initiated the transition — they already know what they did. **Important: `admin` and `system` actors always notify all eligible parties**, regardless of `excludeTriggeringRole`.

```typescript
// In OrderStatusChangedHandler — applying the excludeTriggeringRole logic
function shouldNotify(
  recipient: 'customer' | 'restaurant',
  mapping: TransitionNotificationConfig,
  triggeredByRole: string,
): boolean {
  if (!mapping.excludeTriggeringRole) return true;
  // Admin and system transitions notify everyone — e.g., system auto-cancel
  // (T-03 timeout) should always notify both customer and restaurant.
  if (triggeredByRole === 'admin' || triggeredByRole === 'system') return true;
  // Suppress notification to the actor who triggered the transition.
  if (recipient === 'customer' && triggeredByRole === 'customer') return false;
  if (recipient === 'restaurant' && triggeredByRole === 'restaurant') return false;
  return true;
}
```

---

## 8. Delivery Strategies

### 8.1 Synchronous In-Process Delivery (Phase N-1 through N-5)

In the initial phases, notification delivery is **synchronous within the event handler**:

```
EventBus.publish(OrderPlacedEvent)
  → OrderPlacedNotificationHandler.handle()
    → NotificationService.sendFromEvent()
      → NotificationRepository.create() (DB write)
      → NotificationGateway.sendToUser() (WebSocket, fire-and-forget)
      → PushService.sendToUser() (FCM HTTP, awaited)
      → EmailService.sendEmail() (SMTP, awaited)
```

**Critical design rule:** The EventBus dispatches events asynchronously to all registered handlers. The caller (`TransitionOrderHandler`) does **not** await the entire handler chain — from the caller's perspective, `eventBus.publish()` is non-blocking. However, NestJS CQRS does invoke each registered handler's `handle()` method. An uncaught exception inside a handler can propagate through the CQRS dispatch loop. This is why the pattern `never rethrow from an event handler` is critical: wrapping the handler body in `try/catch` and logging at ERROR level is a hard requirement, not a style suggestion.

Consequences:

1. If the notification fails, the upstream order placement or lifecycle transition succeeds regardless
2. DB write failures in `NotificationRepository.create()` must be caught and logged; they must not propagate back to the EventBus
3. The `idempotency_key` unique constraint provides the ground truth for "was this notification sent?" — not whether `EventsHandler.handle()` completed

### 8.2 Idempotency Key Construction

```typescript
// Format: notif:{type}:{sourceId}:{recipientId}:{channel}
// Including channel allows re-sending to a new channel (e.g., push after in_app was delivered)
// but prevents sending the same channel twice.

function buildIdempotencyKey(
  type: NotificationType,
  sourceId: string,     // orderId or paymentTxnId
  recipientId: string,
  channel: NotificationChannel,
): string {
  return `notif:${type}:${sourceId}:${recipientId}:${channel}`;
}
```

On `NotificationRepository.create()`, the UNIQUE constraint on `idempotency_key` ensures that even if the event handler is called twice (e.g., from a replay or a double-publish bug), only one notification row is created per `(type, sourceId, recipient, channel)` combination.

The insert uses `ON CONFLICT (idempotency_key) DO NOTHING` to silently skip duplicates:

```typescript
await db.insert(notifications)
  .values(newNotification)
  .onConflictDoNothing()
  .returning();
```

### 8.3 Deduplication at Redis Level (Phase N-6)

For high-traffic scenarios, a Redis `SETNX` check before the DB write provides a fast-path deduplication that avoids a DB round-trip entirely:

```typescript
const dedupeKey = `notif:dedup:${idempotencyKey}`;
const isNew = await this.redisService.setNx(dedupeKey, '1', 3600); // 1-hour TTL
if (!isNew) {
  this.logger.debug(`Duplicate notification skipped: ${idempotencyKey}`);
  return;
}
// Proceed with DB write + delivery
```

> **Note:** `RedisService.setNx()` already exists in the codebase (used by cart checkout lock). No new Redis methods needed.

### 8.4 Eventual Consistency Handling

WebSocket delivery happens after the DB write. If the WebSocket server is unavailable (restart during deployment), the notification row still exists in the DB — the client will retrieve it on next connection via the inbox REST API.

This decoupling means:
- **Notification existence** (DB row) is the authoritative fact
- **WebSocket delivery** is a performance optimization
- **Push notification** is a reliability improvement for disconnected clients
- No notification data is lost when real-time delivery fails

---

## 9. Redis Usage

Redis usage in the Notification BC is scoped to **ephemeral/operational concerns only**. The authoritative notification state is always in PostgreSQL.

### 9.1 Deduplication Cache

```
Key:   notif:dedup:{idempotencyKey}
Value: "1"
TTL:   3600 seconds (1 hour)
Usage: Fast-path deduplication before DB write
```

Uses existing `RedisService.setNx()`.

### 9.2 Online User Presence Tracking — [IMPLEMENTED N-5]

When a user connects via WebSocket, their presence is recorded in Redis using a **reference-counted INCR/DECR pattern** that correctly handles multi-tab / multi-device users:

```
Key:   ws:connections:{userId}
Value: integer reference count (number of active sockets)
TTL:   90 seconds (refreshed by client heartbeat ping every ~25s)
Usage: ChannelDispatcherService checks presence before FCM push dispatch
```

**Protocol (atomic):**
```
connect    → INCR ws:connections:{userId}; EXPIRE ws:connections:{userId} 90
heartbeat  → EXPIRE ws:connections:{userId} 90  (refresh TTL, no value change)
disconnect → DECR ws:connections:{userId}; if result ≤ 0: DEL ws:connections:{userId}
push check → GET ws:connections:{userId} → online if value > 0
```

**Why INCR/DECR not SET/DEL:**
The old single-key `SET presence:{userId} = socketId; DEL on disconnect` pattern had a confirmed multi-tab race bug: disconnecting any tab deleted the key even while other tabs remained connected. INCR/DECR ensures the key only disappears when ALL sockets for a user are closed.

**TTL safety:** 90s TTL >> 25s heartbeat interval (3× safety margin). If the server crashes without calling `handleDisconnect`, the key naturally expires within 90s, preventing ghost-online state.

**Redis failure safety:** All `UserPresenceService` methods (`markOnline`, `markOffline`, `refreshTtl`, `isOnline`) absorb Redis errors internally. `isOnline()` returns `false` on error — safe default means push is delivered as fallback rather than silently suppressed.

> **[TRADEOFF]** Skipping push when online: Reduces device notification noise but has a sub-second race window where user disconnects between the `isOnline()` check and the WS `emit()`. Acceptable tradeoff: the in-app notification is already persisted in DB regardless of delivery; the user will see it in inbox on reconnect. This is consistent with all at-most-once WS delivery semantics.

### 9.3 Unread Count Cache — [IMPLEMENTED]

```
Key:   unread:{userId}
Value: integer string
TTL:   300 seconds (5 minutes) — set on cache population
Usage: Serve unread count without a COUNT(*) DB query on every inbox request
```

**Cache-aside (invalidate-on-change) strategy:**

```typescript
// On new in_app notification created or on mark-read: DEL the key
await this.redisService.del(`unread:${userId}`);
// The next GET /notifications/my/unread-count hits the DB COUNT,
// stores the result with a 5-minute TTL, and returns it.
```

**Why invalidation not INCR/DECR:** DEL-on-write + DB-on-miss is race-free and correct. The DB `COUNT` query (backed by `notif_recipient_unread_idx` partial index on `recipient_id WHERE is_read = false`) is fast. The 5-minute TTL also provides a safety net in case a cache-invalidation call is ever missed.

### 9.4 Socket Room Membership (Phase N-6 — Redis Adapter)

When `@socket.io/redis-adapter` is added, Socket.IO uses Redis Pub/Sub internally to broadcast room events across multiple server instances. The key format is managed by the adapter — no manual Redis keys needed for this.

### 9.5 Push Rate Limiting

```
Key:   push:ratelimit:{userId}
Value: INCR counter
TTL:   60 seconds
Usage: Prevent more than MAX_PUSH_PER_MINUTE (e.g., 5) push notifications to a single user within 60 seconds
```

This prevents a cascade scenario where an order produces multiple status changes in rapid succession (T-01 confirmed, T-06 preparing, etc.) and floods the user's device.

### 9.6 Retry Queue (Phase N-6)

```
Key:   notif:retry:queue
Type:  ZSET (sorted set)
Score: Unix timestamp of next retry attempt
Value: notificationId
Usage: Background retry worker polls ZRANGEBYSCORE for due retries
```

> **Implementation note:** The retry queue requires `zadd`, `zrangebyscore`, and `zrem` on `RedisService`. See Section 9.7 for the full list of required extensions.

### 9.7 Redis Key Summary

| Key Pattern | Type | TTL | Phase | Purpose |
|-------------|------|-----|-------|---------|
| `ws:connections:{userId}` | String (int) | 90s | N-5 ✅ | WebSocket presence ref count (INCR/DECR) |
| `unread:{userId}` | String (int) | 300s | N-3 ✅ | Unread notification count cache |
| `notif:retry:queue` | ZSET | — | N-6 🔲 | Retry worker sorted set (score = next attempt Unix ts) |

**RedisService extensions already implemented:**
- `incr(key)` — used by `UserPresenceService.markOnline()`
- `decr(key)` — used by `UserPresenceService.markOffline()`
- `expire(key, ttl)` — used by `UserPresenceService.refreshTtl()`
- `incrIfExists(key)` — available for future write-through unread count optimization

**Phase N-6 additions required:**
- `zadd(key, score, member)` — enqueue into retry SORTED SET
- `zrangebyscore(key, min, max, limit?)` — poll retry queue
- `zrem(key, ...members)` — remove processed entries

> **CRITICAL:** `REDIS_CLIENT` (raw ioredis Symbol) is NOT exported from `RedisModule` — only `RedisService` is. Do NOT inject `REDIS_CLIENT` directly into notification providers — add methods to `RedisService` instead.

---

## 10. Notification Preferences

### 10.1 Per-User Channel Opt-in/Opt-out

Users control notification delivery via the `notification_preferences` table. The `NotificationService.sendFromEvent()` method checks preferences before each channel delivery:

```typescript
// NotificationService.sendFromEvent() — preference gate

const prefs = await this.preferenceRepo.findByUserId(recipientId)
  ?? DEFAULT_PREFERENCES; // if no row exists, use permissive defaults

if (channel === 'push' && !prefs.pushEnabled) return;
if (channel === 'in_app' && !prefs.inAppEnabled) return;
if (channel === 'email' && !prefs.emailEnabled) return;
if (channel === 'sms' && !prefs.smsEnabled) return;

// Check muted types
if (prefs.mutedTypes.includes(type)) return;

// Check quiet hours
if (this.isQuietHours(prefs)) {
  if (channel === 'push') return; // suppress push during quiet hours
  // in_app and email still proceed (non-intrusive)
}
```

### 10.2 Default Preferences

When no preference row exists for a user (e.g., new registration), the system falls back to permissive defaults:

```typescript
const DEFAULT_PREFERENCES: Partial<NotificationPreference> = {
  pushEnabled: true,
  inAppEnabled: true,
  emailEnabled: true,
  smsEnabled: false,
  quietHoursStart: null,
  quietHoursEnd: null,
  mutedTypes: [],
};
```

Preference rows are created lazily (on first change), not at registration. This avoids creating empty rows for users who never interact with preferences.

### 10.3 Quiet Hours Implementation — [IMPLEMENTED N-5]

Quiet hours are evaluated by `QuietHoursService` using native `Intl.DateTimeFormat` — **no external timezone library required**.

```typescript
// services/quiet-hours.service.ts (actual implementation)
isQuietHours(prefs: NotificationPreference, now: Date = new Date()): boolean {
  if (prefs.quietHoursStart == null || prefs.quietHoursEnd == null) return false;

  const tz = prefs.timezone ?? 'Asia/Ho_Chi_Minh';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: tz,
    }).formatToParts(now);
    const hourPart = parts.find((p) => p.type === 'hour');
    if (!hourPart) return false;
    const nowHour = parseInt(hourPart.value, 10);

    const { quietHoursStart: start, quietHoursEnd: end } = prefs;
    // Handle overnight ranges (e.g., start=22, end=7 → quiet from 22:00 to 06:59)
    if (start > end) {
      return nowHour >= start || nowHour < end;
    }
    return nowHour >= start && nowHour < end;
  } catch {
    // Invalid IANA timezone string — log WARN and return false (not quiet)
    return false;
  }
}
```

**Key behaviours:**
- Invalid timezone strings silently return `false` (fail-open: notification proceeds rather than being suppressed due to config error)
- Zero-length windows (`start === end`) are treated as disabled
- Overnight ranges (start > end) correctly span midnight

### 10.4 Muted Notification Types

```typescript
// Example: restaurant mutes 'order_cancelled' (they see it in their dashboard anyway)
{
  userId: 'restaurant-owner-uuid',
  mutedTypes: ['order_cancelled'],
}
```

Muted types suppress delivery entirely — the notification row is still written to the DB (for audit), but `status` is set to `'sent'` with a special delivery log entry marking it as `suppressed_by_preference`.

### 10.5 Marketing vs Transactional

All current notification types are **transactional** (directly triggered by user actions). Future `system_announcement` type is the only candidate for **marketing**. 

The architecture supports this distinction via the `mutedTypes` array and a future `notificationCategory` field (`'transactional' | 'marketing'`). Regulatory requirement in Vietnam: users must be able to opt-out of marketing communications while transactional communications (order status) cannot be suppressed entirely.

---

## 11. Security & Authorization

### 11.1 WebSocket Authentication — [IMPLEMENTED]

Socket.IO connections authenticate using the **same Better Auth session** as the HTTP API (`@thallesp/nestjs-better-auth`). No JwtService from `@nestjs/jwt` is used.

**Token extraction order (handshake only — not per-message):**
1. `client.handshake.auth.token` (preferred: mobile SDK pattern)
2. `client.handshake.headers.authorization` stripped of `Bearer ` prefix (web SDK pattern)

**Connection lifecycle (actual implementation):**

```typescript
@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: process.env.CORS_ORIGIN ?? '*', credentials: true },
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Namespace;

  // Per-socket session expiry timers. Always cleared in handleDisconnect.
  private readonly sessionTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly notificationService: NotificationService,
    private readonly presenceService: UserPresenceService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      client.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) { client.disconnect(true); return; }

    let session: Awaited<ReturnType<typeof auth.api.getSession>>;
    try {
      session = await auth.api.getSession({
        headers: new Headers({ authorization: `Bearer ${token}` }),
      });
    } catch { client.disconnect(true); return; }

    const userId = session?.user?.id;
    if (!userId) { client.disconnect(true); return; }

    client.data.userId = userId;
    // Room format: room:user:{userId}  ← NOTE: NOT user:{userId}
    await client.join(`room:user:${userId}`);
    await this.presenceService.markOnline(userId);  // INCR ws:connections:{userId}, EXPIRE 90s

    // Session expiry enforcement — disconnect socket when Better Auth session expires
    const sessionExpiresAt = session?.session?.expiresAt;
    if (sessionExpiresAt) {
      const ttlMs = Math.min(
        new Date(sessionExpiresAt).getTime() - Date.now(),
        2_147_483_647,  // Node.js setTimeout max (2^31-1 ms ~24.8 days)
      );
      if (ttlMs > 0) {
        const timer = setTimeout(() => {
          this.sessionTimers.delete(client.id);
          client.emit('auth:expired');
          client.disconnect(true);
        }, ttlMs);
        this.sessionTimers.set(client.id, timer);
      }
    }

    client.emit('connection:established', { userId, room: `room:user:${userId}`, connectedAt: new Date().toISOString() });
  }

  async handleDisconnect(client: Socket): Promise<void> {
    // Always cancel session timer to prevent stale-socket calls
    const timer = this.sessionTimers.get(client.id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.sessionTimers.delete(client.id);
    }

    const userId = client.data.userId as string | undefined;
    if (userId) {
      // DECR ws:connections:{userId} — DEL if count ≤ 0
      // Multi-tab safe: other tabs keep the key alive via their own connect INCR
      await this.presenceService.markOffline(userId);
    }
  }

  @SubscribeMessage('notification:ping')
  async handlePing(client: Socket): Promise<void> {
    const userId = client.data.userId as string | undefined;
    if (userId) {
      // Refresh presence TTL without changing the counter value
      await this.presenceService.refreshTtl(userId);
    }
  }

  // Called by NotificationService after in_app channel delivery
  sendToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(`room:user:${userId}`).emit(event, payload);
  }

  // System announcements to ALL connected clients in /notifications namespace
  broadcastToAll(event: string, payload: unknown): void {
    // server.emit() broadcasts to all clients in THIS namespace.
    // Do NOT use server.to('/notifications').emit() — treats the namespace
    // name as a room name and delivers to nobody.
    this.server.emit(event, payload);
  }

  // Connection count metric (logged every 60s)
  @Interval(60_000)
  logConnectionMetrics(): void {
    this.logger.log({ event: 'websocket.connections', count: this.server.sockets.size });
  }
}
```

> **Room name:** `room:user:{userId}` — the `room:` prefix prevents accidental collision between room names and other Socket.IO internal identifiers.

> **`UserPresenceService`** encapsulates all Redis presence operations. Inject it instead of calling `RedisService` directly from the gateway. This keeps the gateway testable (mock `UserPresenceService` in unit tests).

### 11.2 Token Expiration During Active Connection

When a user's Better Auth session expires while a Socket.IO connection is open:
- The existing socket remains connected (WebSocket does not re-validate tokens on every message)
- The client should handle `401` HTTP responses on REST API calls and trigger re-authentication
- On re-auth, the client should reconnect the socket with the new token
- **Server-side enforcement:** The gateway sets a `setTimeout` in `handleConnection` (keyed by `client.id` in `sessionTimers`) that emits `auth:expired` and disconnects when the session TTL elapses. This timer is **always cleared** in `handleDisconnect` to prevent it from firing on a stale socket (see Section 11.1).

**Client-side contract:**
```typescript
// Client handles auth:expired and re-establishes the connection
socket.on('auth:expired', () => {
  socket.disconnect();
  // Trigger token refresh via HTTP (Better Auth refreshToken endpoint)
  // Then reconnect: socket.auth = { token: newToken }; socket.connect();
});
```

> **Why no `extractTokenExpiry(token)` helper:** This project does not use `@nestjs/jwt` — there is no JWT parsing available. Session expiry comes from `auth.api.getSession()` which is called once in `handleConnection`. The session expiry is extracted directly from the `session?.session?.expiresAt` field.

### 11.3 User Isolation

**Room-based isolation guarantees user data segregation:**
- Each user is placed in room `room:user:{userId}` on connect
- `NotificationGateway.sendToUser(userId, payload)` calls `this.server.to('room:user:' + userId).emit(...)`
- A malicious actor cannot receive another user's notifications because they cannot join a room they don't own
- Never use `client.broadcast.emit()` (sends to all connected clients) for notification data

### 11.4 Multi-Device Session Handling

Multiple sockets from the same user (mobile + web) both join `room:user:{userId}`. When `server.to('room:user:userId').emit(...)` is called, Socket.IO delivers to **all sockets in that room** — both devices receive the notification simultaneously. This is the correct behavior for a food delivery app (notification appears on all the user's devices).

### 11.5 Preventing Notification Spoofing

Notifications are created server-side from domain events only. There is no HTTP endpoint that accepts `recipientId` and creates a notification without a corresponding domain event. The `POST /notifications/internal/send` endpoint (if it exists) must be guarded with an admin role check.

### 11.6 Device Token Registration Security

`POST /notifications/device-tokens` must:
1. Require a valid authenticated session (`@UseGuards(AuthGuard)`)
2. Only create tokens for `req.user.id` — never accept `userId` from the request body
3. Validate token format (FCM tokens are 152-character alphanumeric strings)
4. Rate-limit to 5 registrations per user per minute to prevent token flooding

---

## 12. Failure Handling

### 12.1 Event Handler Failures

Following the pattern established in `OrderCancelledAfterPaymentHandler` and `PaymentConfirmedEventHandler`:

```typescript
async handle(event: SomeDomainEvent): Promise<void> {
  try {
    await this.processNotification(event);
  } catch (err) {
    // NEVER rethrow — would propagate through EventBus and disrupt other handlers
    this.logger.error(
      `NotificationHandler failed for event type=${event.constructor.name}: ${(err as Error).message}`,
      (err as Error).stack,
    );
  }
}
```

### 12.2 DB Write Failure

If `NotificationRepository.create()` fails (e.g., DB connection lost), the entire notification for that recipient is aborted. No partial state is written. The `idempotency_key` ensures that when the event is eventually replayed (or manually retried by an operator), the duplicate DB write is rejected cleanly.

### 12.3 WebSocket Delivery Failure

WebSocket delivery via `server.to(room).emit()` is fire-and-forget at the Socket.IO layer. If the user is not connected, the event is silently dropped by Socket.IO (rooms with zero sockets receive nothing). This is not an error — the notification is already persisted in the DB and retrievable via the inbox REST API.

**Mitigation:** On Socket.IO reconnect, the client should call `GET /notifications/inbox?since=lastConnectedAt` to fetch missed notifications. The server timestamp on `notifications.createdAt` enables this pattern.

### 12.4 Push Delivery Failure

FCM HTTP calls may fail transiently (network timeout, 5xx from Firebase). The retry strategy (Section 5.6) handles this with exponential backoff. After 3 failed attempts, the delivery log records `permanently_failed` and an alert is sent to the monitoring system (no infinite retry loops).

**FCM-specific failures:**
- `QUOTA_EXCEEDED` → back off for 60 seconds, then retry
- `INVALID_REGISTRATION` / `NOT_REGISTERED` → deactivate token immediately, do not retry
- `INTERNAL` (500) → retry with backoff
- `UNAVAILABLE` (503) → retry with backoff

### 12.5 Redis Failure

If Redis is unavailable:
- **Presence tracking:** degrades gracefully — all users are treated as offline; all notifications go through push path (safe but noisier)
- **Deduplication cache:** falls through to DB UNIQUE constraint (correct but slightly slower)
- **Unread count cache:** falls through to DB `COUNT` query (correct but slightly slower)
- **Rate limiting:** falls through to no rate limiting (acceptable for short outages; add circuit breaker in Phase N-6)

Redis failure must never prevent notification delivery. All Redis operations in notification handlers are wrapped in `try/catch` with silent fallback.

### 12.6 Email Delivery Failure

SMTP failures (connection refused, rate limit, invalid email) are retried up to 3 times with 30-second intervals. After that, the delivery log records the failure. Email delivery failure does not affect in-app or push delivery.

### 12.7 Fallback Channel Strategy

```
Primary: WebSocket (in_app)
  ↓ if user offline (Redis presence check)
Fallback: Push (FCM/APNs)
  ↓ if no device tokens registered
Secondary: Email
  ↓ if email not available in preferences
Termination: in_app notification persisted in DB only (retrievable via REST)
```

This waterfall is implemented in `NotificationService.deliverNotification()` and is configurable per notification type. High-urgency types (e.g., `new_order_received` for restaurants) always attempt all channels regardless of online status.

---

## 13. Observability

### 13.1 Structured Logging

All notification events use structured logging (NestJS `Logger`) with a consistent field set:

```typescript
this.logger.log({
  event: 'notification.sent',
  notificationId: notification.id,
  type: notification.type,
  channel: notification.channel,
  recipientId: notification.recipientId,
  recipientRole: notification.recipientRole,
  orderId: notification.orderId,
  durationMs: Date.now() - startTime,
});
```

Error logs include `errorCode`, `attemptNumber`, and `notificationId` for correlated log queries.

### 13.2 Key Metrics to Track

| Metric | How Measured | Alert Threshold |
|--------|-------------|-----------------|
| Notification delivery success rate | `sent / (sent + permanently_failed)` from `notification_delivery_logs` | < 95% in 5-minute window |
| Push delivery latency p99 | Histogram: `sentAt - createdAt` for push channel | > 5s |
| WebSocket connection count | Gauge via `server.engine.clientsCount` | Alert on sudden drop |
| Active device tokens per user | Gauge from DB | Alert if avg > 10 (potential token accumulation bug) |
| Unread notification backlog | Gauge: `COUNT(*) WHERE is_read = false AND created_at < NOW() - 1h` | Alert if > 1000 per user |
| Event handler processing time | Histogram: duration of `handle()` execution | > 500ms p95 |

### 13.3 Distributed Tracing

When OpenTelemetry is introduced (future), the `notificationId` and source event correlation ID should be carried as trace context. For now, logging the `orderId` on every notification record allows log-based correlation across BC boundaries.

### 13.4 WebSocket Connection Metrics

```typescript
// In NotificationGateway
// Use @Interval (from @nestjs/schedule) for a simple fixed-interval metric log.
// @Interval(60_000) fires every 60s — appropriate frequency for a connection count log.
// Do NOT use @Cron('*/30 * * * * *') which fires every 30 SECONDS — too aggressive.
@Interval(60_000)
logConnectionMetrics(): void {
  // this.server is the Socket.IO Namespace object scoped to /notifications.
  // .sockets.size = number of connected clients in THIS namespace only.
  // Do NOT use this.server.engine.clientsCount — that counts ALL transport
  // connections across every namespace (not namespace-specific).
  const count = this.server.sockets.size;
  this.logger.log({ event: 'websocket.connections', namespace: '/notifications', count });
}
```

---

## 14. Scalability & Future Microservice Extraction

### 14.1 Current Monolith Constraints

In the current monolith, the in-process EventBus ensures zero-latency event delivery. The WebSocket gateway runs in the same process as the API, so no inter-process communication is needed. This is the correct architecture for Phase N-1 through N-5.

### 14.2 Horizontal Scaling Without Extraction

Before Notification becomes its own microservice, horizontal API scaling (2+ instances) requires:

1. **Socket.IO Redis adapter** — broadcasts WebSocket events across all instances:
   ```typescript
   import { createAdapter } from '@socket.io/redis-adapter';
   const pubClient = new Redis(REDIS_URL);
   const subClient = pubClient.duplicate();
   this.server.adapter(createAdapter(pubClient, subClient));
   ```

2. **Stateless notification handlers** — all state in PostgreSQL or Redis. ✅ (already designed this way)

3. **Redis-backed presence tracking** — already designed in Section 9.2 ✅

No application code changes for horizontal scaling — only the gateway setup changes.

### 14.3 Microservice Extraction

When Notification is extracted as a standalone service:

| Current | After Extraction | Change Required |
|---------|-----------------|-----------------|
| `@EventsHandler(OrderPlacedEvent)` | Kafka/RabbitMQ consumer for `order.placed` topic | Replace `@EventsHandler` with message broker consumer |
| `EventBus.publish()` in Ordering BC | Ordering BC publishes to Kafka `order.placed` topic | Add Kafka producer in Ordering event publishers |
| In-process NestJS DI | HTTP/gRPC client for cross-service calls | Only `IPaymentInitiationPort` pattern; Notification has no incoming sync calls |
| Single DB connection | Dedicated `notifications_db` | Change `DATABASE_URL` env var; no schema change |
| Redis shared with API | Dedicated Redis for Notification or shared (pub/sub channel isolation via key prefixes) | Key prefix convention already in place |

**[DECISION]** The `shared/events/` TypeScript classes serve as the **event contract** between BCs. When migrating to a message broker, these classes become the Avro/JSON schema definitions. Maintaining them in `shared/events/` now means the migration is a mechanical substitution, not a redesign.

### 14.4 Transport Replacement Strategy

The event handler pattern is designed for transport-layer substitution:

```typescript
// Today (monolith — in-process EventBus)
@EventsHandler(OrderPlacedEvent)
export class OrderPlacedNotificationHandler implements IEventHandler<OrderPlacedEvent> {
  async handle(event: OrderPlacedEvent): Promise<void> { ... }
}

// Tomorrow (microservice — Kafka consumer)
@MessagePattern('order.placed')
async handleOrderPlaced(@Payload() event: OrderPlacedEvent): Promise<void> { ... }
```

The business logic inside `handle()` / `handleOrderPlaced()` is identical. The decorator and injection are the only changes. This is why the event handler bodies are kept thin (delegate to `NotificationService`) and never import EventBus directly.

---

## 15. API Design

### 15.1 REST Endpoints — [IMPLEMENTED]

All routes are under `/api/notifications`. Require Bearer token auth (Better Auth session) except `test/*` which are `@AllowAnonymous` (dev/staging only).

```
# Notification Inbox
GET    /api/notifications/my
         Query: unreadOnly?: boolean, type?: NotificationType, limit?: 1-100, offset?: 0+
         Response: { items, total, unreadCount, offset, limit, hasMore }

GET    /api/notifications/my/unread-count
         Response: { count: number }

PATCH  /api/notifications/:id/read
         Response: { success: boolean }  — success=false if not found or wrong user (no 404)

PATCH  /api/notifications/my/read-all
         Response: { count: number }  — number of rows updated

# Preferences
GET    /api/notifications/my/preferences
PATCH  /api/notifications/my/preferences   — partial update (all fields optional)

# Device Token Management
GET    /api/notifications/my/push-tokens
         Response: { tokens: PushTokenItemDto[] }  — token values masked to last 8 chars

POST   /api/notifications/my/push-tokens
         Body: { token: string (max 500 chars), platform: 'ios' | 'android' | 'web' }
         Response: { registered: boolean }  — always true (idempotent upsert)

DELETE /api/notifications/my/push-tokens
         Body: { token: string }
         Response: { removed: boolean }  — always true (idempotent soft-delete)

# Dev-only test endpoints [AllowAnonymous, blocked in NODE_ENV=production]
POST   /api/notifications/test/push    { token, title?, body? }
POST   /api/notifications/test/email   { to, subject?, body? }
```

### 15.2 WebSocket Events — [IMPLEMENTED]

```typescript
// Server → Client events
interface ServerToClientEvents {
  'connection:established': (payload: { userId: string; room: string; connectedAt: string }) => void;
  'notification.created': (payload: NotificationPayload) => void;
  'notification.read': (payload: { id: string; readAt: string } | { all: true; readAt: string }) => void;
  'auth:expired': () => void;
}

// Client → Server events
interface ClientToServerEvents {
  'notification:ping': () => void;  // heartbeat — refreshes presence TTL
}

interface NotificationPayload {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;   // template data for deep links
  orderId?: string;
  createdAt: string;               // ISO 8601
  isRead: boolean;                 // always false on first delivery
  readAt?: string;                 // ISO 8601 — undefined on first delivery
}
```

> **Note:** `notification.read` has two payload shapes: single `{ id, readAt }` (from `PATCH /my/:id/read`) and bulk `{ all: true, readAt }` (from `PATCH /my/read-all`). Clients must handle both.

### 15.3 Notification Inbox API Response — [IMPLEMENTED]

```typescript
// GET /api/notifications/my
// Query: limit?: number (1-100, default 20), offset?: number (default 0),
//        unreadOnly?: boolean, type?: NotificationType

interface NotificationInboxResponse {
  items: NotificationItemDto[];
  total: number;         // total matching rows (for pagination controls)
  unreadCount: number;   // total unread for this user (badge value, not just current page)
  offset: number;
  limit: number;
  hasMore: boolean;
}

interface NotificationItemDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  orderId?: string;
  isRead: boolean;
  readAt?: string;       // ISO 8601 — undefined when unread
  createdAt: string;     // ISO 8601
}
```

### 15.4 Device Token Registration

```typescript
// POST /notifications/device-tokens
// Body:
interface RegisterDeviceTokenDto {
  token: string;             // FCM registration token
  platform: 'ios' | 'android' | 'web';
}

// Response: 201 Created with { id: string }
```

### 15.5 Preferences Patch

```typescript
// PATCH /notifications/preferences
// Partial update — only provided fields are updated
interface UpdatePreferencesDto {
  pushEnabled?: boolean;
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  quietHoursStart?: number | null;  // 0-23, null to disable
  quietHoursEnd?: number | null;
  mutedTypes?: NotificationType[];
}
```

---

## 16. Database Design

### 16.1 Tables Summary

| Table | Primary Key | Estimated Row Count | Write Pattern | Read Pattern |
|-------|-------------|--------------------|--------------|--------------------|
| `notifications` | UUID PK | High (millions) | Insert on event, Update on read | By recipientId, by orderId |
| `device_tokens` | UUID PK | Medium (10K-100K) | Upsert on register | By userId + isActive |
| `notification_preferences` | UUID PK, UNIQUE(userId) | Medium (= user count) | Insert on first preference change | By userId |
| `notification_delivery_logs` | UUID PK | Very high (2-5× notifications) | Insert per attempt | By notificationId |

### 16.2 Retention Strategy

```
notifications:
  - Soft delete: set expires_at = created_at + 90 DAYS on creation
  - Hard delete cron (Phase N-5): DELETE WHERE expires_at < NOW() AND is_read = true
  - Unread notifications: never hard-deleted (user may return after 90 days)
  - MAX_UNREAD_PER_USER = 1000 (enforced by cleanup cron with a LIMIT)

notification_delivery_logs:
  - Hard delete after 30 days (audit only; no user-facing data)
  - Cron: DELETE WHERE attempted_at < NOW() - INTERVAL '30 days'

device_tokens:
  - Hard delete: WHERE is_active = false AND last_seen_at < NOW() - INTERVAL '30 days'
  - Hard delete: WHERE is_active = true AND last_seen_at < NOW() - INTERVAL '90 days'
```

### 16.3 Index Design (Drizzle ORM)

```typescript
// Critical indexes explained:

// 1. Primary read path: user's inbox, newest first
index('notif_recipient_created_idx').on(t.recipientId, t.createdAt.desc())

// 2. Unread count: partial index (only unread rows) — dramatically reduces index size
index('notif_recipient_unread_idx').on(t.recipientId).where(sql`is_read = false`)

// 3. Order-scoped lookup (admin/support)
index('notif_order_idx').on(t.orderId).where(sql`order_id IS NOT NULL`)

// 4. Cleanup cron: find rows due for deletion
index('notif_expires_at_idx').on(t.expiresAt).where(sql`expires_at IS NOT NULL`)

// 5. Retry worker: find notifications due for retry (Phase N-6)
index('notif_retry_idx').on(t.nextRetryAt)
  .where(sql`status = 'failed' AND next_retry_at IS NOT NULL`)

// 6. Device tokens: user's active tokens
index('device_token_user_active_idx').on(t.userId, t.isActive)
  .where(sql`is_active = true`)
```

### 16.4 No PostgreSQL FK Constraints (D-P7)

Following the existing pattern in `payment_transactions` schema (see Phase 8 implementation), no PostgreSQL `REFERENCES` constraints are created for cross-BC IDs (`recipientId`, `orderId`). This preserves future microservice extractability.

---

## 17. Phase-by-Phase Roadmap

### Actual Folder Structure — [IMPLEMENTED N-5]

```
src/module/notification/
  notification.module.ts            # Dynamic EMAIL_PROVIDER + PUSH_PROVIDER factories
  acl/
    notification-restaurant-snapshot.schema.ts
    notification-restaurant-snapshot.projector.ts  # @EventsHandler(RestaurantUpdatedEvent)
    notification-restaurant-acl.repository.ts
  channels/
    channel.interface.ts            # INotificationChannel, DeliveryContext, DeliveryResult
    email/
      email-provider.interface.ts   # EMAIL_PROVIDER DI token
      email-template.service.ts
      email.channel.service.ts      # INotificationChannel impl
      nodemailer-email.provider.ts  # Active when SMTP_HOST is set
      noop-email.provider.ts        # Safe no-op for dev/CI
    in-app/
      in-app.channel.service.ts     # Redis DEL + WS emit
    push/
      firebase-push.provider.ts     # Active when FIREBASE_SERVICE_ACCOUNT_PATH is set
      push-provider.interface.ts    # PUSH_PROVIDER DI token
      push.channel.service.ts       # Fan-out to all device tokens
      stub-push.provider.ts         # No-op for dev/CI
  controllers/
    notification.controller.ts      # All 10 routes under /notifications
  domain/
    device-token.schema.ts
    notification-delivery-log.schema.ts
    notification-preference.schema.ts
    notification.schema.ts
  dto/
    device-token.dto.ts
    notification.dto.ts
    preference.dto.ts
    test-email.dto.ts
    test-push.dto.ts
  events/
    order-cancelled-after-payment.handler.ts
    order-placed.handler.ts
    order-status-changed.handler.ts
    payment-confirmed.handler.ts
    payment-failed.handler.ts
  gateway/
    notification-payload.dto.ts     # Event name constants + NotificationPayload interface
    notification.gateway.ts         # Socket.IO /notifications namespace
  repositories/
    device-token.repository.ts
    notification-delivery-log.repository.ts
    notification-preference.repository.ts
    notification.repository.ts
    user-email.repository.ts        # Reads user.email from Better Auth tables
  services/
    channel-dispatcher.service.ts   # Routes to INotificationChannel adapters
    notification-template.service.ts
    notification.service.ts         # Core business logic (sendFromEvent, etc.)
    quiet-hours.service.ts
    test-email.service.ts
    test-push.service.ts
    user-presence.service.ts        # Redis INCR/DECR presence
  tasks/
    device-token-cleanup.task.ts    # @Cron 03:00 Asia/Ho_Chi_Minh daily
```

> **Key differences from original proposal:**
> - `PushService` and `EmailService` are split into `channels/push/` and `channels/email/` directories
> - Provider pattern: `PUSH_PROVIDER` and `EMAIL_PROVIDER` DI tokens with dynamic factory binding
> - `ChannelDispatcherService` replaces the `deliverNotification()` method on `NotificationService`
> - `UserPresenceService` is a dedicated service (not inline in gateway)
> - All routes consolidated in one `notification.controller.ts`

---

### Phase N-1: Foundation — Event Stubs + Module Skeleton ✅ Implemented

**Goal:** Create the Notification BC module, wire it into `AppModule`, and register stub event handlers for all 6 upstream events. Verify that domain events flow correctly from Ordering and Payment into Notification handlers.

> **Implementation note (completed):** All deliverables below are implemented. TypeScript compilation passes with 0 errors (`tsc --noEmit`). The 5-table migration is in `src/drizzle/out/0012_notification_bc.sql`. Seed data added for `notification_preferences` (3 rows) and `notification_restaurant_snapshots` (5 rows). `CORS_ORIGIN` env var added to `env.schema.ts`. `NotificationModule` registered in `AppModule`.

> **Relationship to Phase 6:** `PHASE_6_DOWNSTREAM_EVENTS_PROPOSAL.md` describes stub handlers for Notification, Delivery, and Payment BCs. If Phase 6 was already implemented, the stub `@EventsHandler` classes in Notification BC already exist. Phase N-1 **replaces** those stubs with the full module skeleton. The Phase 6 stubs are scaffolding only — they are superseded by this implementation.

**Scope:**
- Create `src/module/notification/` directory structure (or expand Phase 6 skeleton if it exists)
- Define `NotificationModule` with `CqrsModule` + `DatabaseModule` imports
- Implement stub `@EventsHandler` classes (log receipt, no delivery)
- Register `NotificationModule` in `AppModule`
- Drizzle migration: create `notifications`, `device_tokens`, `notification_preferences`, `notification_delivery_logs`, `notification_restaurant_snapshots` tables
- Implement `NotificationRepository`, `DeviceTokenRepository`, `NotificationPreferenceRepository`, `NotificationRestaurantAclRepository`
- Implement `NotificationRestaurantSnapshotProjector` (subscribes to `RestaurantUpdatedEvent`)
- Implement `NotificationTemplateService` with all templates

**Deliverables:**
- `notification.module.ts`
- `domain/notification.schema.ts`
- `domain/device-token.schema.ts`
- `domain/notification-preference.schema.ts`
- `domain/notification-delivery-log.schema.ts`
- `acl/notification-restaurant-snapshot.schema.ts`
- `acl/notification-restaurant-snapshot.projector.ts`
- `acl/notification-restaurant-acl.repository.ts`
- `events/order-placed.handler.ts` (stub)
- `events/order-status-changed.handler.ts` (stub)
- `events/payment-confirmed.handler.ts` (stub)
- `events/payment-failed.handler.ts` (stub)
- `events/order-cancelled-after-payment.handler.ts` (stub)
- `repositories/*.repository.ts`
- `services/notification-template.service.ts`
- Drizzle migration file (includes `notification_restaurant_snapshots` table)

**Architecture Decisions:**
- `NotificationModule` is NOT `@Global()` — it has no port that other BCs need to inject
- `CqrsModule` import registers `@EventsHandler` decorators within the module scope

**Testing Strategy:**
- Unit tests: verify each stub handler logs receipt and does not throw
- Integration: trigger a real `OrderPlacedEvent` via E2E checkout flow, verify stub handler fires

**Risks:**
- CQRS EventBus module scoping issue: if `CqrsModule` is not imported in `NotificationModule`, handlers will not be registered and events will be silently dropped. Mitigation: add an E2E smoke test that verifies handler invocation count.

---

### Phase N-2: Real-time WebSocket Gateway ✅ Implemented

**Goal:** Implement the Socket.IO WebSocket gateway. Users can connect, authenticate, and receive real-time notifications when domain events fire.

> **Implementation note (completed):** All deliverables below are implemented. TypeScript compilation passes with 0 errors (`tsc --noEmit`). The gateway is registered as a provider in `NotificationModule`. `NotificationService` dispatches `notification:new` WebSocket events to connected users after DB persistence. `RedisService` has been extended with `incr()`, `decr()`, and `expire()` methods.

> **Architecture note:** The `@WebSocketServer()` decorated property is typed as `Namespace` (not `Server`) because NestJS injects the namespace-scoped object for namespaced gateways. This allows `server.sockets.size` to resolve correctly as the Map's `.size` property.

**Scope:**
- Install `@nestjs/websockets` and `socket.io` (see Section 4.7 for exact packages — do NOT install `@nestjs/platform-socket.io`)
- Implement `NotificationGateway` with Better Auth session validation on connect/disconnect
- Integrate Better Auth session validation in gateway handshake
- Implement `sendToUser(userId, payload)` method on gateway
- Upgrade stub event handlers to call `gateway.sendToUser()`
- Implement Redis presence tracking (`presence:{userId}`)
- Implement heartbeat mechanism (client pings every 25s; server sets TTL 30s)

**Deliverables:**
- `gateway/notification.gateway.ts`
- `gateway/notification-payload.dto.ts`
- Updated `services/notification.service.ts` (dispatches WebSocket after DB persistence)
- Updated `notification.module.ts` (includes `NotificationGateway`)
- Extended `src/lib/redis/redis.service.ts` (`incr`, `decr`, `expire` methods)

**Architecture Decisions:**
- `NotificationGateway` is a provider inside `NotificationModule`, NOT a separate module
- `NotificationGateway` injects `RedisService` (already global) for presence tracking
- `@WebSocketServer()` property typed as `Namespace` (namespace-scoped object, not root `Server`)
- `NotificationService` injects `NotificationGateway` with `@Optional()` for unit-test safety
- WebSocket delivery is fire-and-forget with `try/catch` — never propagates to persistence
- Multi-device presence limitation documented in code comment (not fixed in N-2)

**Risks:**
- Better Auth session validation in WS context: the `auth.api.getSession()` method expects HTTP headers, which are available in the Socket.IO handshake. Test carefully with the actual session format.

---

### Phase N-3: Notification Persistence + In-App Inbox

**Goal:** Persist every notification to the `notifications` table and expose the REST inbox API. WebSocket delivery is now backed by persistent records.

**Scope:**
- `NotificationService.sendFromEvent()` — full implementation with DB write, idempotency, preference check
- `NotificationController` — REST inbox, unread count, mark-as-read endpoints
- Redis unread count cache
- Notification cleanup cron task (expire old notifications)
- `OrderStatusChangedHandler` — full implementation of the transition→type mapping table

**Deliverables:**
- `services/notification.service.ts` (full implementation)
- `controllers/notification.controller.ts`
- `tasks/notification-cleanup.task.ts`
- Full `events/order-status-changed.handler.ts`

**Testing Strategy:**
- Unit test: verify idempotency key prevents duplicate rows (call `sendFromEvent` twice with same args, assert single DB row)
- Unit test: verify preference gate suppresses delivery for muted types
- E2E test: complete order flow → verify notifications appear in inbox API response
- E2E test: mark-as-read → verify `isRead = true` in DB and unread count decrements

---

### Phase N-4: Push Notifications + Email

**Goal:** Deliver push notifications via FCM to registered mobile and web clients, and send transactional emails for high-value events (delivered, cancelled, refund).

**Scope:**
- Install `firebase-admin`
- `PushService` — FCM fan-out to all user device tokens
- `DeviceTokenController` — register/deregister endpoints
- Invalid token cleanup in `PushService.sendToUser()`
- `EmailService` — nodemailer SMTP integration
- HTML email templates for `order_delivered`, `order_cancelled`, `payment_failed`
- Integrate `PushService` and `EmailService` into `NotificationService.deliverNotification()`
- Presence-gated push: skip FCM if WebSocket is connected

**Deliverables:**
- `services/push.service.ts`
- `services/email.service.ts`
- `controllers/device-token.controller.ts`
- Email HTML templates (in-code or `/templates` folder)
- `FIREBASE_SERVICE_ACCOUNT_JSON` added to `env.schema.ts` with validation
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` added to `env.schema.ts`

**Architecture Decisions:**
- Firebase Admin initialized once as a singleton NestJS provider (token: `FIREBASE_APP`)
- Email templates are TypeScript functions (not DB rows) for compile-time type safety
- `EmailService` is designed as an interface (`IEmailService`) so it can be mocked in tests or swapped (SendGrid, AWS SES) without changing `NotificationService`

**Testing Strategy:**
- Unit test: `PushService.sendToUser()` — mock `firebase-admin`, verify `sendEach()` called with correct tokens; verify invalid tokens are deactivated
- Unit test: `EmailService.sendEmail()` — mock nodemailer transport, verify template rendered
- E2E test: register a test FCM token, trigger payment_confirmed event, verify `firebase-admin.messaging.sendEach` was called (spy in test environment)

**Risks:**
- `firebase-admin` in test environment: use `emulatorMode` or stub the messaging client in Jest setup. Failing to mock Firebase in tests causes real FCM calls or failures.

---

### Phase N-5: Preferences + Device Token Cleanup ✅ Implemented

**Goal:** Full user preference management. Users can control which notification types and channels they receive. Quiet hours are enforced. Device token cleanup cron runs.

**Scope:**
- `NotificationPreferenceController` — GET + PATCH preferences
- `NotificationService.sendFromEvent()` — full preference gate with quiet hours
- Device token cleanup cron (`@Cron`)
- Redis push rate limiting per user
- Unread count cache invalidation on preference change

**Deliverables:**
- `controllers/notification-preference.controller.ts` ✅
- Updated `NotificationService` with preference gate ✅
- `tasks/device-token-cleanup.task.ts` ✅
- `services/quiet-hours.service.ts` ✅ (new — `Intl`-based, no external dependency)
- Redis `zadd`, `zrangebyscore`, `zrem`, `incrIfExists` added to `RedisService` ✅

**Implementation Notes:**
- Quiet hours enforced at `isChannelEnabled()` level (pre-persistence gate), push channel only
- `in_app` channel always persists — user inbox is never suppressed
- Critical types (`system_announcement`, `new_order_received`) bypass all preference gates
- Device token cleanup: inactive 30d + active-but-stale 90d, independent try/catch per pass
- `isQuietHours()` uses `Intl.DateTimeFormat` — no dayjs/luxon dependency needed (removes risk noted below)
- 185 unit tests passing. See `NOTIFICATION_PHASE_N5_IMPLEMENTATION_REPORT.md` for full details.

> ~~**[RISK]** Timezone handling: The `timezone` field is now in the `notification_preferences` schema (default `'Asia/Ho_Chi_Minh'`). The `isQuietHours()` implementation uses `dayjs-plugin-timezone`. Add `dayjs` to the project dependencies in Phase N-5.~~
> **[RESOLVED]** Implementation uses native `Intl.DateTimeFormat` — no extra dependency required.

**Testing Strategy:**
- Unit test: quiet hours edge cases (midnight crossing, same-hour start/end) ✅ (24 tests)
- Unit test: `mutedTypes` gate suppresses delivery but writes DB row with `suppressed_by_preference` log ✅
- E2E: create preference with `pushEnabled = false`, trigger event, verify no FCM call but in_app notification persisted

---

### Phase N-6: Retry Queue + Redis Adapter

**Goal:** Add fault tolerance. Failed push/email deliveries are retried via a Redis SORTED SET queue. Socket.IO Redis adapter is added for horizontal scaling readiness.

**Scope:**
- Redis SORTED SET retry queue implementation
- `NotificationRetryTask` — polls ZRANGEBYSCORE on `@Interval(10000)` (every 10 seconds)
- Exponential backoff logic (3 attempts: immediate, +30s, +120s)
- `@socket.io/redis-adapter` integration — add to `NotificationGateway.afterInit()`
- `NotificationDeliveryLog` writes for every attempt
- Dead-letter handling: `permanently_failed` status after max retries

**Deliverables:**
- `tasks/notification-retry.task.ts`
- Updated `NotificationGateway` with Redis adapter

**Architecture Decisions:**
- The Redis adapter requires two **dedicated** ioredis connections (`pubClient`/`subClient`) that are separate from the application's main Redis connection. pub/sub mode blocks regular Redis commands, so the main connection (used by `RedisService`) MUST NOT be put into pub/sub mode. Use `new Redis(REDIS_URL)` for the dedicated pub/sub pair, and continue using the injected `RedisService` for all regular Redis operations in the application.

```typescript
// Phase N-6: afterInit() in NotificationGateway
async afterInit(server: Server): Promise<void> {
  const redisUrl = `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`;
  // Dedicated connections for pub/sub — NEVER share with the app's main REDIS_CLIENT
  const pubClient = new Redis(redisUrl);
  const subClient = pubClient.duplicate();
  server.adapter(createAdapter(pubClient, subClient));
  this.logger.log('Socket.IO Redis adapter initialized');
}
```

**Testing Strategy:**
- Unit test: retry task advances retry count and updates `nextRetryAt` correctly
- Integration test: simulate FCM failure, verify retry queue entry, advance cron, verify retry attempt

---

### Phase N-7: Observability + E2E Coverage

**Goal:** Production-ready observability. Complete E2E test suite covering the full event-to-delivery pipeline.

**Scope:**
- Structured log fields on all notification operations (Section 13.1)
- Admin stats endpoint (delivery rates, queue depth)
- WebSocket connection count metric cron log
- Full E2E test: checkout → order placed → payment confirmed → order status transitions → notifications verified at each step
- Performance test: 100 concurrent order placements → verify no duplicate notifications

**Deliverables:**
- Updated logging across all handlers and services
- `controllers/admin-notification.controller.ts` (admin role guard)
- `test/e2e/notification.e2e-spec.ts`

---

## 18. Production Concerns

### 18.1 Duplicate Notifications (Race Conditions)

**Scenario:** EventBus delivers `OrderPlacedEvent` to `OrderPlacedNotificationHandler`. The handler starts processing, the process restarts (deployment), the event is replayed.

**Mitigation:** `idempotency_key` UNIQUE constraint + `ON CONFLICT DO NOTHING`. The second invocation inserts nothing and returns cleanly. The WebSocket was already delivered on the first invocation; the push retry queue (if any) will find no `pending` row.

### 18.2 Retry Storms

**Scenario:** FCM is down for 10 minutes. 5000 push notifications accumulate in the retry queue. When FCM recovers, all 5000 retry simultaneously, overwhelming FCM's rate limit.

**Mitigation:** 
1. Exponential backoff with jitter: `nextRetryAt = now + baseDelay * 2^attemptNumber + random(0, 1000)ms`
2. Redis rate limiter: `notif:push:ratelimit` INCR counter with 60-second TTL, cap at 200/minute
3. Retry task processes maximum 50 items per invocation (ZRANGEBYSCORE with LIMIT)

### 18.3 WebSocket Memory Leaks

**Scenario:** A client disconnects without triggering the `disconnect` event (network cut). The socket remains in memory and in the Redis presence key.

**Mitigation:**
1. Enable Socket.IO `pingTimeout` / `pingInterval`: server disconnects clients that miss 2 consecutive pings
2. Presence TTL of 30 seconds means presence auto-expires even without a clean disconnect
3. `handleDisconnect()` removes the presence key on clean disconnect

### 18.4 Socket Authentication Edge Cases

**Scenario:** A user's JWT expires at second 500 after connecting. They're still receiving notifications (socket is open) but their HTTP requests return 401.

**Mitigation:** Server-side disconnect timer (Section 11.2) emits `auth:expired` event and disconnects the socket. Client SDK must handle this event by refreshing token and reconnecting.

**Scenario:** Two browser tabs from the same user both connect. Both join `room:user:{userId}` room. Notification is delivered to both. User marks as read on tab 1. Tab 2 still shows unread.

**Mitigation:** When `PATCH /notifications/:id/read` is called, emit `notification.read` event to `room:user:{userId}` room — both tabs receive the read state update.

### 18.5 Notification Fanout Scalability

**Scenario:** A system announcement is sent to all 50,000 users simultaneously.

**Analysis:** `POST /notifications/admin/broadcast` inserts 50,000 rows in a DB transaction and calls `server.to(room).emit()` for each user. This is too slow.

**Mitigation (Phase N-7+):**
1. DB: Batch insert with Drizzle `.values([...rows])` in chunks of ~1,000 rows (PostgreSQL has a ~65,535 parameter limit; with multiple columns per row, 1,000 rows per batch is safe)
2. WebSocket: Use `server.emit(event, payload)` for namespace-level broadcast to all connected clients. Do **NOT** use `server.to('/notifications').emit()` — that treats `'/notifications'` as a **room name**, not the namespace, and delivers to nobody. The gateway's `server` object is already scoped to the `/notifications` namespace by `@WebSocketGateway({ namespace: '/notifications' })`, so `server.emit()` is the correct broadcast API.
3. Push: Queue all FCM messages in the retry SORTED SET and let the retry worker fan out at a controlled rate

For the current scale (food delivery app), per-order notifications fan out to at most 2-3 recipients (customer + restaurant + potential shipper). The fanout concern only applies to `system_announcement` which is not in the critical path.

### 18.6 Provider Rate Limits

| Provider | Limit | Mitigation |
|---------|-------|-----------|
| FCM | 1M messages/min (project default) | Rate limiter at 200/min initially; increase quota when needed |
| SendGrid / SMTP | 100 emails/day (free tier) | Use production tier for launch; `emailEnabled` defaults to true only for high-value events |
| Redis (ioredis) | ~100K ops/sec (single node) | Current Redis usage is far below this; add Redis Cluster when needed |

---

## 19. Tradeoff Analysis

### 19.1 WebSocket (Socket.IO) vs SSE

**Decision:** Socket.IO

| Factor | Socket.IO | SSE |
|--------|-----------|-----|
| Bidirectional | ✅ | ❌ |
| Horizontal scaling | ✅ (Redis adapter) | ⚠️ (requires custom Redis bridge) |
| NestJS support | ✅ First-class | ⚠️ Manual Observable |
| Client library | Socket.IO client (2KB gzip) | Native EventSource (0KB) |
| Firewall compatibility | ⚠️ Fallback to polling | ✅ Pure HTTP |
| Room management | ✅ Built-in | ❌ Manual implementation |
| Recommendation for this project | ✅ Chosen | ❌ |

**Why SSE was rejected:** The bidirectional requirement (client acknowledges notifications, mark-as-read over socket) and the horizontal scaling concern make SSE strictly inferior to Socket.IO for this use case. The marginal complexity of Socket.IO over SSE is justified.

### 19.2 In-code Templates vs DB-backed Templates

| Factor | In-code | DB-backed |
|--------|---------|-----------|
| Type safety | ✅ Compile-time | ❌ Runtime only |
| Non-dev content changes | ❌ Requires deploy | ✅ Admin UI |
| Testability | ✅ Unit tests | ⚠️ Requires seeded DB |
| Versioning | ✅ Git history | ⚠️ Requires migration |
| Localization (i18n) | ⚠️ Manual | ✅ Column per locale |
| Recommendation | ✅ Phase N-1 to N-5 | Migrate when i18n needed |

### 19.3 Synchronous Event Handler vs Async Queue

| Factor | Sync (in-handler) | Async Queue (Redis SORTED SET) |
|--------|-------------------|---------------------------------|
| Complexity | ✅ Simple | ⚠️ Worker + queue management |
| Delivery guarantee | ⚠️ At-most-once (no persistence if process crashes mid-send) | ✅ Persisted in Redis |
| Latency | ✅ Immediate | ⚠️ Up to poll interval (10s) |
| Retry | ⚠️ Best-effort only | ✅ Structured retry |
| Recommendation | Phases N-1 to N-5 | Phase N-6+ |

**Rationale for phased approach:** Starting synchronous reduces initial complexity while the architecture solidifies. Phase N-6 adds the Redis retry queue specifically for the push and email channels, which benefit most from reliability guarantees. WebSocket delivery remains synchronous (fire-and-forget) in all phases — its semantics are inherently at-most-once.

### 19.4 Presence Check: Skip Push When Online vs Always Push

| Factor | Skip Push if Online | Always Push |
|--------|--------------------|----|
| User experience | ✅ Less noisy | ⚠️ Duplicate alerts |
| Reliability | ⚠️ Race condition on disconnect | ✅ Guaranteed push |
| Implementation | ⚠️ Redis presence check | ✅ Simple |
| Recommendation | ✅ For transactional notifications | Only for critical/urgent types |

**Special case:** `new_order_received` (restaurant) and `payment_failed` (customer) should **always** trigger push, regardless of online status. These are time-sensitive and high-consequence.

### 19.5 Firebase Admin (FCM v1 + APNs bridge) vs Direct APNs

| Factor | Firebase Admin | Direct APNs |
|--------|---------------|-------------|
| Dependencies | 1 SDK for all platforms | 2 SDKs (firebase-admin + node-apn) |
| Token format | FCM registration token (unified) | APNs device token (different format) |
| Vendor lock-in | Firebase dependent | Independent |
| Reliability | High (Google infrastructure) | High (Apple infrastructure) |
| Recommendation | ✅ Phase N-4 | [FUTURE] if Firebase removed |

### 19.6 Notification Templates: Per-Type vs Single Generic Template

**Rejected option:** A single `{title: "Order update", body: "Your order #{orderId} status changed to #{status}"}` generic template.

**Why rejected:** Produces low-quality user experience. "Your order status changed to delivered" is far inferior to "Your order from Phở Bà Châm has been delivered. Enjoy!" — which is trivially achievable with typed template functions and the data already present in the event payload.

---

## 20. Final Recommendation

### 20.1 Recommended Architecture Summary

```
┌─────────────────────────── NotificationModule ───────────────────────────────┐
│                                                                               │
│  Event Handlers (6)                                                          │
│  ├── OrderPlacedNotificationHandler         → customer + restaurant          │
│  ├── OrderStatusChangedHandler              → transition→type mapping        │
│  ├── PaymentConfirmedNotificationHandler    → customer                       │
│  ├── PaymentFailedNotificationHandler       → customer                       │
│  └── OrderCancelledAfterPaymentHandler      → customer                       │
│         ↓ all delegate to                                                    │
│  NotificationService                                                         │
│  ├── sendFromEvent()  → preference gate → idempotency → DB write → deliver  │
│  └── deliverNotification()  → fan-out to channels                           │
│         ↓ per channel                                                        │
│  ├── NotificationGateway (Socket.IO)   → server.to(user:id).emit()          │
│  ├── PushService (firebase-admin)       → sendEach() with token fan-out     │
│  └── EmailService (nodemailer)          → sendMail()                        │
│                                                                               │
│  Repositories: Notification + DeviceToken + Preference + DeliveryLog        │
│  Tasks: NotificationCleanupTask + NotificationRetryTask (Phase N-6)         │
│  Controllers: NotificationInbox + DeviceToken + Preferences + Admin         │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 20.2 Why This Architecture Best Fits This Project

1. **Consistent with existing patterns:** Event handlers follow the exact pattern of `OrderCancelledAfterPaymentHandler`. Module structure follows the exact pattern of `PaymentModule`. No new architectural paradigms introduced.

2. **Zero tight coupling:** Notification BC has no imports from Ordering or Payment module files. It depends only on `shared/events/` TypeScript classes — the same boundary used by all other BCs.

3. **Progressive complexity:** Phase N-1 to N-3 deliver immediate user value (real-time notifications) with minimal infrastructure. Phase N-4 to N-7 layer in push, email, retries, and observability incrementally.

4. **Microservice-ready by design:** The `@EventsHandler` → message broker substitution is mechanical. The Redis adapter upgrade is one line. The DB has no cross-BC FK constraints. Event payloads are self-contained.

5. **Operationally realistic:** The failure handling strategy accepts that WebSocket delivery is best-effort (consistent with the nature of long-polling/WS in mobile networks). The in-app inbox REST API provides the reliability backstop. Push notifications provide the reach backstop. Together they cover all connectivity scenarios.

### 20.3 What Should Be Avoided

1. **Avoid querying Ordering/Payment DB tables** from Notification event handlers. All data must come from event payloads. If the payload is missing a field, use graceful fallback text — never back-fill from upstream tables.

2. **Avoid making Notification synchronously required** for order placement. `OrderPlacedEvent` → `OrderPlacedNotificationHandler` is fire-and-forget. If notification delivery fails, the order is still valid.

3. **Avoid DB templates** in early phases. In-code templates are correct for this phase; migrate only when i18n or non-developer copy changes are actually needed.

4. **Avoid Kafka/RabbitMQ** until Notification is extracted as a microservice. The in-process EventBus is sufficient and operationally simpler for the current monolith architecture.

5. **Avoid per-notification email for every status change.** Email is reserved for high-value events (`order_delivered`, `order_cancelled`, `payment_failed`, `refund_initiated`) — otherwise email fatigue will lead users to unsubscribe from all notifications.

6. **Avoid `@Global()` on NotificationModule.** Unlike `RedisModule` and `PaymentModule`, the Notification BC has no port/token that other BCs need to inject. Making it global would be an architectural red flag.

### 20.4 Migration Path Toward Microservices

```
Phase 1 (now):    Monolith — in-process EventBus — single Redis — single PostgreSQL
Phase 2 (scale):  Monolith — Socket.IO Redis adapter — shared Redis cluster
Phase 3 (extract): Notification microservice — Kafka consumer replaces @EventsHandler
                   — dedicated notification_db — isolated Redis namespace
                   — WebSocket gateway in Notification service only
```

The critical gate for Phase 3 is the introduction of a message broker. Until then, the in-process EventBus is both simpler and more reliable than an external broker for a single-process deployment. The code is already structured to make Phase 3 a mechanical substitution rather than an architectural redesign.
