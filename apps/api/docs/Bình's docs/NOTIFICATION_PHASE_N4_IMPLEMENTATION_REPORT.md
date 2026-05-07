# Notification Phase N-4 — Multi-Channel Delivery Implementation Report

**Phase:** N-4  
**Status:** ✅ Complete  
**E2E Tests:** 23/23 passing (N-4) · 39/39 passing (N-3, regression clean)  
**TypeScript:** 0 errors (`tsc --noEmit`)

---

## 1. Overview

Phase N-4 extends the notification system from a single-channel in-app inbox (N-3) to a
production-grade **multi-channel delivery pipeline** supporting:

| Channel | Provider | Status in test env |
|---------|----------|--------------------|
| `in_app` | `InAppChannelService` (WebSocket + Redis cache bust) | Always succeeds |
| `push` | `StubPushProvider` (no FCM) | Always succeeds (logs only) |
| `email` | `NoopEmailProvider` (no SMTP configured) | Always fails → `SMTP_NOT_CONFIGURED` |

Every delivery attempt is recorded in `notification_delivery_logs` regardless of outcome.

---

## 2. New Files Created

### Channel Abstraction

| File | Purpose |
|------|---------|
| `src/module/notification/channels/channel.interface.ts` | `INotificationChannel`, `DeliveryResult`, `DeliveryContext` interfaces |

### In-App Channel

| File | Purpose |
|------|---------|
| `src/module/notification/channels/in-app/in-app.channel.service.ts` | Busts Redis unread cache + emits via WebSocket gateway; always returns `{ success: true }` |

### Email Channel (3 files + 1 interface)

| File | Purpose |
|------|---------|
| `src/module/notification/channels/email/email-provider.interface.ts` | `IEmailProvider` + `EMAIL_PROVIDER` token |
| `src/module/notification/channels/email/email-template.service.ts` | Renders branded HTML email from notification data |
| `src/module/notification/channels/email/nodemailer-email.provider.ts` | Real SMTP via nodemailer; activated when `SMTP_HOST` env var is set |
| `src/module/notification/channels/email/noop-email.provider.ts` | Throws `SMTP_NOT_CONFIGURED`; used in test/dev when no SMTP configured |
| `src/module/notification/channels/email/email.channel.service.ts` | Guards on `context.email`; calls provider; maps result |

### Push Channel (1 interface + 2 files)

| File | Purpose |
|------|---------|
| `src/module/notification/channels/push/push-provider.interface.ts` | `IPushProvider` + `PUSH_PROVIDER` token |
| `src/module/notification/channels/push/stub-push.provider.ts` | Always returns success for all tokens; logs to console |
| `src/module/notification/channels/push/push.channel.service.ts` | Fetches all active device tokens for user; deactivates invalid tokens on failure |

### Dispatcher

| File | Purpose |
|------|---------|
| `src/module/notification/services/channel-dispatcher.service.ts` | Fire-and-forget orchestrator; routes each channel, writes delivery log, calls `updateStatus`; never throws |

### DTOs

| File | Purpose |
|------|---------|
| `src/module/notification/dto/device-token.dto.ts` | `RegisterPushTokenDto`, `RemovePushTokenDto`, response DTOs |
| `src/module/notification/dto/preference.dto.ts` | `UpdateNotificationPreferenceDto`, `NotificationPreferenceResponseDto` |

### E2E Test

| File | Purpose |
|------|---------|
| `test/e2e/notification-n4.e2e-spec.ts` | 23 tests across 6 describe blocks |

---

## 3. Modified Files

### `notification.service.ts`
Added four new public methods:
- `registerPushToken(userId, dto)` — upsert with conflict on `(userId, token)`; refreshes `lastSeenAt`
- `removePushToken(userId, dto)` — soft-deactivate (`isActive = false`) scoped to owner
- `getPreferences(userId)` — returns row or `DEFAULT_PREFERENCES` merged response
- `updatePreferences(userId, dto)` — upsert preference row; supports `email: null` to clear

Added `private toPreferenceDto(row)` mapper. Constructor updated to inject `DeviceTokenRepository` and `ChannelDispatcherService`. `sendFromEvent()` updated to fire-and-forget dispatch.

### `notification.controller.ts`
Four new routes added **before** `/:id/read` to avoid route shadowing:
- `GET /notifications/my/preferences`
- `PATCH /notifications/my/preferences` (200)
- `POST /notifications/my/push-tokens` (200)
- `DELETE /notifications/my/push-tokens` (200)

### Event Handlers (3 files)
Added `'email'` to channels array:
- `payment-confirmed.handler.ts` — `['in_app', 'push', 'email']`
- `order-cancelled-after-payment.handler.ts` — `['in_app', 'push', 'email']`
- `order-status-changed.handler.ts` — delivering→delivered, *→cancelled transitions

### `notification.module.ts`
Added providers:
- `EMAIL_PROVIDER` factory: `NodemailerEmailProvider` when `SMTP_HOST` is set, else `NoopEmailProvider`
- `PUSH_PROVIDER`: `useClass: StubPushProvider`
- `InAppChannelService`, `EmailTemplateService`, `EmailChannelService`, `PushChannelService`, `ChannelDispatcherService`
- `ConfigModule` import for SMTP env access

### `env.schema.ts`
Added optional SMTP environment variables:
- `SMTP_HOST?`, `SMTP_PORT` (default 587), `SMTP_SECURE` (default false)
- `SMTP_USER?`, `SMTP_PASS?`, `SMTP_FROM` (default `noreply@soli.dev`)

### `drizzle/seeds/seed.ts`
Added `deleteDeviceTokens()` and `seedDeviceTokens()`:
- Customer: iOS token + Android token
- Owner: iOS token

### `test/helpers/db.ts`
Added two query helpers:
- `getDeviceTokensForUser(userId)`
- `getDeliveryLogsForNotification(notificationId)`

---

## 4. Architecture

```
EventBus.publish(SomeDomainEvent)
         │
         ▼
   [EventHandler]  (e.g. OrderPlacedNotificationHandler)
         │  creates Notification rows (one per channel)
         │  calls NotificationService.sendFromEvent()
         ▼
   NotificationService.sendFromEvent()
         │  void (fire-and-forget)
         ▼
   ChannelDispatcherService.dispatch(notification, context)
         │
         ├─► InAppChannelService.deliver()
         │     ├── bust Redis unread cache
         │     └── emit via NotificationGateway (WS namespace /notifications)
         │
         ├─► PushChannelService.deliver()
         │     ├── DeviceTokenRepository.getActiveTokensForUser()
         │     └── IPushProvider.sendToTokens()   [StubPushProvider in all envs]
         │
         └─► EmailChannelService.deliver()
               ├── guard: context.email must be set
               ├── EmailTemplateService.render()
               └── IEmailProvider.send()          [NodemailerEmailProvider | NoopEmailProvider]

         Each channel result → NotificationDeliveryLogRepository.create()
                             → NotificationRepository.updateStatus()
```

---

## 5. Key Design Decisions

### Provider Strategy Pattern
`EMAIL_PROVIDER` and `PUSH_PROVIDER` are string injection tokens. The module factory
decides the concrete implementation at startup. Adding a real FCM provider later only
requires implementing `IPushProvider` and updating the factory — no other code changes.

### Fire-and-Forget Dispatch
`sendFromEvent()` uses `void this.channelDispatcher.dispatch(...)`. The notification row is
already persisted before dispatch begins; channel failures update `status` to `failed` but
never surface to the event handler. This prevents delivery failures from blocking the
order-placement flow.

### Idempotency via DB Constraint
`notification_delivery_logs` has a unique constraint on `(notificationId, channel)`.
Re-dispatching the same notification to the same channel is a no-op at the DB level.

### NoopEmailProvider
In test/dev environments (no `SMTP_HOST`), the Noop provider throws
`new Error('SMTP_NOT_CONFIGURED')`. The dispatcher catches this, writes a delivery log with
`errorCode: 'SMTP_NOT_CONFIGURED'`, and sets the notification status to `failed`. This is
**intentional behaviour verified by tests** — email channel failing gracefully does not
prevent in_app or push channels from succeeding.

### Token Deactivation
`PushChannelService` calls `DeviceTokenRepository.deactivateToken(token)` when the push
provider reports an invalid/expired token. The `StubPushProvider` never reports failures,
so deactivation is exercised only in production with a real FCM provider.

---

## 6. API Surface (new endpoints)

```
GET    /api/notifications/my/preferences
PATCH  /api/notifications/my/preferences    body: { pushEnabled?, email? }
POST   /api/notifications/my/push-tokens    body: { token, platform }
DELETE /api/notifications/my/push-tokens    body: { token }
```

All endpoints require `Authorization: Bearer <token>` header. Sessions resolved via
`@thallesp/nestjs-better-auth`.

---

## 7. Environment Variables (new)

| Variable | Default | Description |
|----------|---------|-------------|
| `SMTP_HOST` | — | If absent, `NoopEmailProvider` is used |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_SECURE` | `false` | Use TLS |
| `SMTP_USER` | — | SMTP auth username |
| `SMTP_PASS` | — | SMTP auth password |
| `SMTP_FROM` | `noreply@soli.dev` | From address |

---

## 8. Test Suite Summary

### `test/e2e/notification-n4.e2e-spec.ts` — 23 tests

| Section | Tests | What is verified |
|---------|-------|-----------------|
| §1 Push Token CRUD | 8 | Register, idempotent re-register, deactivate, ownership isolation, validation, auth |
| §2 Preferences | 5 | Default response, upsert, persistence, null-clear email, auth |
| §3 Multi-Channel (in_app + push) | 5 | `OrderPlacedEvent` → customer in_app + push, owner in_app + push, delivery logs |
| §4 Email Channel | 3 | `PaymentConfirmedEvent` → email fails with `SMTP_NOT_CONFIGURED`, delivery log, in_app + push also dispatched |
| §5 Push Disabled | 1 | `pushEnabled=false` preference → no push row persisted |
| §6 Multi-Device Fan-Out | 1 | 2 active tokens → single notification row, `StubPushProvider` fans out internally |

### `test/e2e/notification-inbox.e2e-spec.ts` — 39 tests (N-3, regression)
All 39 passing — N-4 changes did not break N-3 behaviour.

---

## 9. What's Not Implemented (intentional scope limits)

- **Firebase Admin SDK**: `firebase-admin` not installed. Use `StubPushProvider` in all environments until FCM credentials are available. To add real push: implement `IPushProvider` → inject with `PUSH_PROVIDER` token.
- **SMS channel**: `notificationChannelEnum` includes `sms` but no handler is wired. Reserved for a future phase.
- **Email retry / backoff**: Failed email deliveries are logged as `failed` with no retry. A scheduled retry job could consume `permanently_failed` rows.
- **Per-notification-type channel preference**: Current preferences are global (`pushEnabled`, `email`). Per-type opt-out is a future enhancement.
