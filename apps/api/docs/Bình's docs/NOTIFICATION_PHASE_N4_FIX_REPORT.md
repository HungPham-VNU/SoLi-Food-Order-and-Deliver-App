# Notification Phase N-4 — Deep Review, Fix & Test Report

## Executive Summary

A full architectural audit of the Phase N-4 (Multi-Channel Notification Delivery) implementation was performed. **No critical architectural issues were found.** All implementation files are production-grade and correctly follow the modular monolith conventions. The primary work delivered was the creation of a comprehensive unit test suite covering all notification services and channel adapters.

---

## 1. Scope Reviewed

All 26+ Phase N-4 implementation files were inspected:

| Area | Files |
|------|-------|
| Channel adapters | `in-app.channel.service.ts`, `email.channel.service.ts`, `push.channel.service.ts` |
| Channel providers | `nodemailer-email.provider.ts`, `noop-email.provider.ts`, `stub-push.provider.ts` |
| Provider interfaces | `channel.interface.ts`, `email-provider.interface.ts`, `push-provider.interface.ts` |
| Core services | `notification.service.ts`, `channel-dispatcher.service.ts`, `notification-template.service.ts` |
| Repositories | `notification.repository.ts`, `notification-preference.repository.ts`, `device-token.repository.ts`, `notification-delivery-log.repository.ts` |
| Gateway | `notification.gateway.ts` |
| Controllers | `notification.controller.ts` |
| DTOs | `preference.dto.ts`, `device-token.dto.ts` |
| Event handlers | `payment-confirmed.handler.ts`, `order-placed.handler.ts`, `payment-failed.handler.ts`, `order-cancelled-after-payment.handler.ts`, `order-status-changed.handler.ts` |
| Module | `notification.module.ts` |
| Domain schemas | `notification.schema.ts`, `notification-preference.schema.ts`, `device-token.schema.ts`, `notification-delivery-log.schema.ts` |

---

## 2. Architectural Audit Findings

All items reviewed and confirmed correct:

| Concern | Finding | Verdict |
|---------|---------|---------|
| `updateStatus(notificationId, status, { sentAt: undefined })` | Drizzle ORM treats `undefined` fields as "don't update" — no spurious SQL column set | ✅ Correct |
| `deliveryContext.email` sourced from `prefRow?.email ?? null` | Email fetched from preference row at dispatch time, never stale | ✅ Correct |
| `attemptNumber = notification.deliveryAttempts + 1` | Correct first-attempt value (DB starts at 0) | ✅ Correct |
| No UNIQUE on `(notificationId, channel)` in delivery log | Intentional — delivery log is append-only audit trail for retries | ✅ By design |
| Route ordering: `my/...` before `/:id/...` | Static routes correctly registered before parameterized routes | ✅ Correct |
| `NoopEmailProvider` throws instead of returning failure | Allows `EmailChannelService` to classify and record the exact error code | ✅ By design |
| `@Optional() private readonly gateway: NotificationGateway` | Uses concrete class type, not union — correct for NestJS DI | ✅ Correct |
| `void this.channelDispatcher.dispatch(...)` | Fire-and-forget — dispatch never blocks the response | ✅ Correct |
| `idempotencyKey: notif:{type}:{sourceId}:{recipientId}:{channel}` | Unique per event × user × channel — prevents duplicate delivery | ✅ Correct |
| `system_announcement` / `new_order_received` bypass mutedTypes | Critical and operational notifications always delivered | ✅ Correct |
| `in_app` channel gets 90-day `expiresAt`, others get `null` | Inbox items expire; transient channels don't need expiry | ✅ Correct |

---

## 3. Configuration Fix

### Issue
Unit tests were failing to resolve:
1. `better-auth` (ESM-only package) transitively imported by `NotificationGateway` → `auth.ts`
2. `.js` file extensions in imports (e.g., `./redis.constants.js`) not resolved by Jest's CommonJS mode

### Fix Applied
**`apps/api/package.json`** — added to jest unit test config:

```json
"moduleNameMapper": {
  "^@/(.*)$": "<rootDir>/$1",
  "^(\\.{1,2}/.*)\\.js$": "$1"
}
```

Plus added `jest.mock('../gateway/notification.gateway')` at the top of test files that transitively import it, preventing the `better-auth` ESM parse error.

---

## 4. Unit Tests Created

### Files Created

| File | Tests | Coverage Focus |
|------|-------|----------------|
| `src/module/notification/services/channel-dispatcher.service.spec.ts` | 13 | Channel routing, delivery log writes, status updates, exception isolation, resilience |
| `src/module/notification/channels/in-app/in-app.channel.service.spec.ts` | 12 | Redis DEL key, WS emission payload, always success, graceful Redis/WS failure, optional gateway |
| `src/module/notification/channels/email/email.channel.service.spec.ts` | 12 | NO_RECIPIENT_EMAIL guard, template params, sendMail args, SMTP_NOT_CONFIGURED, SMTP_SEND_ERROR, never throws |
| `src/module/notification/channels/push/push.channel.service.spec.ts` | 14 | NO_ACTIVE_TOKENS, token fan-out, data coercion, partial success, invalid token deactivation, non-fatal failures |
| `src/module/notification/services/notification.service.spec.ts` | 38 | sendFromEvent (row count, dispatch, idempotency, expiresAt), isChannelEnabled (all flags + bypasses), getPreferences, updatePreferences, push token CRUD, markRead/markAllRead/getUnreadCount |

**Total: 89 unit tests**

### Test Results

```
Test Suites: 5 passed, 5 total
Tests:       89 passed, 89 total
Exit code:   0
```

---

## 5. E2E Regression Results

Both notification E2E test suites ran clean after unit test work:

```
Test Suites: 2 passed, 2 total
Tests:       62 passed, 62 total
  • notification-inbox.e2e-spec.ts    — 39 tests (Phase N-3 inbox)
  • notification-n4.e2e-spec.ts       — 23 tests (Phase N-4 channels)
```

---

## 6. Key Architecture Notes for Future Reference

- **Better Auth** is ESM-only — any unit test file that transitively imports it (via `NotificationGateway` → `auth.ts`) must use `jest.mock('../gateway/notification.gateway')` at the top.
- **Drizzle `undefined` fields**: passing `undefined` values in `updateStatus()` partial updates is the correct way to conditionally set fields — Drizzle excludes them from the SQL SET clause.
- **Fire-and-forget dispatch**: `void this.channelDispatcher.dispatch(...)` — `sendFromEvent()` returns after all rows are persisted, dispatch happens asynchronously. E2E tests use `await delay(300ms)` after `EventBus.publish()` to allow this to complete.
- **`NoopEmailProvider`** is used when `SMTP_HOST` is not configured. It throws `'SMTP_NOT_CONFIGURED'` so the EmailChannelService can log it as a classified failure rather than a silent no-op.
- **Push tokens**: `StubPushProvider` always succeeds — real FCM integration is a future Phase N-5 task.
- **Redis unread cache key**: `unread:{userId}`, TTL 300s. Invalidated on `markRead`, `markAllRead`.
- **Idempotency key format**: `notif:{type}:{sourceId}:{recipientId}:{channel}` — unique per business event, user, and delivery channel.
