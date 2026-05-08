# Event-Triggered Email Delivery — Root Cause Analysis & Fix Report

**Phase:** N-7 — Email Orchestration Fix  
**Date:** 2025  
**Status:** ✅ Complete — all 142 notification tests pass, 0 TypeScript errors

---

## Problem Statement

After fixing SMTP infrastructure (N-6 Phase 1 — SMTP host, credentials, `z.coerce.boolean` bug, and `transporter.verify()` startup check), the direct test endpoint `POST /api/notifications/test/email` successfully delivered real emails to the inbox.

**However, business events (payment confirmed/failed, order cancelled, refund) still did NOT trigger any email delivery.**

User confirmed: the recipient's email (`luubinh.chuyenlongan@gmail.com`) existed in the `user` table, so the issue was NOT missing data — it was orchestration and logic bugs.

---

## Root Cause Analysis

### Root Cause #1 — CRITICAL: `context.email` Always `null`

**File:** `src/module/notification/services/notification.service.ts`

**Why it broke:** `sendFromEvent()` built the `DeliveryContext` as:

```typescript
// BEFORE (broken)
const deliveryContext = {
  recipientId,
  email: prefRow?.email ?? null,  // ← ALWAYS null for new users
};
```

The `notification_preferences.email` column is **nullable** and denormalised. A user who has never called `PATCH /notifications/my/preferences` with an explicit email address has `null` in this column.

The Better Auth `user` table holds the **canonical email address** (set at registration), but `sendFromEvent()` never consulted it.

**Result:** `EmailChannelService.deliver()` received `context.email = null`, logged `NO_RECIPIENT_EMAIL`, and returned `{ success: false, errorCode: 'NO_RECIPIENT_EMAIL' }`. **No email was ever sent.**

**Fix:** Created `UserEmailRepository` with a safe `findEmailByUserId()` fallback, then replaced the 1-line `deliveryContext` build with a comprehensive resolution block:

```typescript
// AFTER (fixed)
let resolvedEmail: string | null = prefRow?.email ?? null;

if (!resolvedEmail && enabledChannels.includes('email')) {
  const authEmail = await this.userEmailRepo.findEmailByUserId(recipientId);
  if (authEmail) {
    resolvedEmail = authEmail;
    // Fire-and-forget backfill into notification_preferences
    void this.preferenceRepo.upsert({ userId: recipientId, email: authEmail, ...defaults })
      .catch((err) => logger.warn(...));
  }
}

const deliveryContext = { recipientId, email: resolvedEmail };
```

The backfill ensures that the next event delivery for the same user skips the user table lookup (fast path), converging to the denormalised model over time.

---

### Root Cause #2: `payment_failed` Missing Email Channel

**File:** `src/module/notification/events/payment-failed.handler.ts`

```typescript
// BEFORE
channels: ['in_app', 'push']

// AFTER
channels: ['in_app', 'push', 'email']
```

Users were never notified by email when their payment failed, even though this is a high-priority transactional event.

---

### Root Cause #3: `refund_initiated` Missing Email Channel

**File:** `src/module/notification/events/order-cancelled-after-payment.handler.ts`

```typescript
// BEFORE
channels: ['in_app']   // refund_initiated notification

// AFTER
channels: ['in_app', 'email']
```

When an order was cancelled after payment (triggering a refund), the `refund_initiated` notification only went to in-app. No email confirmation of the refund was sent.

---

### Root Cause #4: `order_refunded` Missing Email Channel

**File:** `src/module/notification/events/order-status-changed.handler.ts`

```typescript
// BEFORE (delivered→refunded transition)
channels: ['in_app']

// AFTER
channels: ['in_app', 'email']
```

When an order's status changed from `delivered` to `refunded`, only an in-app notification was sent. No email.

---

## Files Changed

| File | Change |
|---|---|
| `src/module/notification/events/payment-failed.handler.ts` | Added `'email'` to channels |
| `src/module/notification/events/order-cancelled-after-payment.handler.ts` | Added `'email'` to `refund_initiated` channels |
| `src/module/notification/events/order-status-changed.handler.ts` | Added `'email'` to `delivered→refunded` channels |
| `src/module/notification/repositories/user-email.repository.ts` | **NEW** — Safe lookup of `user.email` via Better Auth table |
| `src/module/notification/services/notification.service.ts` | Added `UserEmailRepository` injection + email fallback resolution in `sendFromEvent()` |
| `src/module/notification/notification.module.ts` | Registered `UserEmailRepository` as provider |
| `src/module/notification/services/notification.service.spec.ts` | Added `UserEmailRepository` mock; fixed `upsert` mock to return a Promise; added 4 new test cases for fallback email resolution |

---

## Architecture: Email Resolution Flow

```
sendFromEvent()
  │
  ├── prefRow = preferenceRepo.findByUserId(recipientId)
  │
  ├── enabledChannels = channels.filter(isChannelEnabled(prefs))
  │
  ├── resolvedEmail = prefRow?.email ?? null
  │
  ├── if (!resolvedEmail && enabledChannels.includes('email'))
  │     ├── authEmail = userEmailRepo.findEmailByUserId(recipientId)
  │     │     └── SELECT email FROM user WHERE id = :recipientId   [Better Auth table]
  │     │
  │     ├── if (authEmail)
  │     │     ├── resolvedEmail = authEmail
  │     │     └── void preferenceRepo.upsert({ email: authEmail, ...defaults })  ← backfill
  │     │
  │     └── else → warn "No email found, email channel will be skipped"
  │
  ├── deliveryContext = { recipientId, email: resolvedEmail }
  │
  └── for each enabledChannel:
        row = notificationRepo.insertIfNotExists(...)
        void channelDispatcher.dispatch(row, deliveryContext)
              └── EmailChannelService.deliver(row, context)
                    └── context.email → nodemailerProvider.sendMail(...)
```

---

## UserEmailRepository

```typescript
@Injectable()
export class UserEmailRepository {
  async findEmailByUserId(userId: string): Promise<string | null> {
    // SELECT email FROM user WHERE id = :userId LIMIT 1
    // Returns null on any error (safe fallback — never throws)
  }
}
```

Key design decisions:
- Queries the **Better Auth `user` table** (not `notification_preferences`) which always has a valid email
- Returns `null` on any DB error (safe — email delivery failure is logged but non-blocking)
- Absorbed into `sendFromEvent()`'s outer try/catch — cannot break order processing

---

## Final Channel Map (After Fix)

| Event / Transition | Type | Channels |
|---|---|---|
| Order placed | `order_placed` | in_app, push |
| Payment confirmed | `payment_confirmed` | **in_app, push, email** ✓ |
| Payment failed | `payment_failed` | **in_app, push, email** ✓ (was: no email) |
| pending→confirmed | `order_confirmed` | in_app, push |
| confirmed→preparing | `order_preparing` | in_app, push |
| preparing→ready_for_pickup | `order_ready` | in_app, push |
| ready_for_pickup→picked_up | `order_picked_up` | in_app, push |
| picked_up→delivering | `order_delivering` | in_app, push |
| delivering→delivered | `order_delivered` | **in_app, push, email** ✓ |
| pending/paid/confirmed→cancelled | `order_cancelled` | **in_app, push, email** ✓ |
| Cancelled after payment | `refund_initiated` | **in_app, email** ✓ (was: no email) |
| delivered→refunded | `order_refunded` | **in_app, email** ✓ (was: no email) |

---

## Test Results

```
Test Suites: 7 passed, 7 total
Tests:       142 passed, 142 total  (+3 new: fallback, backfill, no-duplicate-lookup)
TypeScript:  0 errors
```

New test cases added:
1. `passes null email in context when no preference row exists and user table also has no email`
2. `resolves email from user table when preference row has no email`
3. `backfills email into notification_preferences after resolving from user table`
4. `does NOT call userEmailRepo when preference row already has an email`

---

## Validation

To validate end-to-end:

```bash
# 1. Trigger a payment confirmation event (creates a real order + payment flow)
# 2. Check delivery logs:
SELECT channel, status, error_code, attempted_at
FROM notification_delivery_logs
WHERE channel = 'email'
ORDER BY attempted_at DESC
LIMIT 10;

# 3. Check inbox for luubinh.chuyenlongan@gmail.com
```

Expected: `status = 'delivered'`, `error_code = null` in delivery log, and email in inbox.

---

## Prior Related Fix (N-6 Phase 1)

See `EMAIL_DELIVERY_DEBUG_AND_FIX_REPORT.md` for SMTP infrastructure fixes that preceded this orchestration fix:
- `SMTP_HOST` placeholder → `smtp.gmail.com`
- `SMTP_FROM` wrong domain → `23520156@gm.uit.edu.vn`
- `z.coerce.boolean('false')` → `true` Zod bug fixed
- `transporter.verify()` on module init added
