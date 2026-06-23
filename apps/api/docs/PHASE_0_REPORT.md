# Phase 0 — Baseline, Security Fixes, and ADRs (Implementation Report)

**Status:** Security & correctness fixes implemented and verified. Baseline metrics, ADRs, and OpenAPI gate are outstanding (owner actions).
**Scope:** `apps/api`
**Date:** 2026-06-23
**Relates to:** [MICROSERVICES_MIGRATION_PLAN.md](./MICROSERVICES_MIGRATION_PLAN.md) §2.4, §15 (items 1–3), Phase 0 exit criteria

---

## 1. Objective

Make the monolith safe to migrate before any topology changes. Three release blockers from the migration plan were addressed:

1. Restrict `DevTestUserMiddleware` so `x-test-user-id` cannot mint privileged users in production.
2. Disable `/api/notifications/test/*` (push/email) in production.
3. Resolve the VNPay refund production TODO.

Guiding principle: **fail-closed**. A single source of truth for environment gating, so no scattered `process.env.NODE_ENV` check can drift. Dev/test-only behaviour is enabled **only** for the explicit allowlist `{development, test}`; any other value (production, staging, unset, or a typo) disables it.

---

## 2. Changes by file

| File | Type | Change |
| --- | --- | --- |
| `src/lib/environment.ts` | **new** | `isProductionEnv()`, `isDevOrTestEnv()` — fail-closed allowlist helpers; single source of truth |
| `src/lib/guards/dev-only.guard.ts` | **new** | `DevOnlyGuard` — blocks protected routes outside dev/test, returns **404** (no existence leak) |
| `src/lib/dev-test-user.middleware.ts` | edit | Injects `ConfigService`; self-guards and no-ops outside dev/test; warns when enabled |
| `src/app.module.ts` | edit | Registers the middleware **only** in dev/test; never wired into the pipeline in production |
| `src/module/notification/controllers/notification.controller.ts` | edit | `test/push` + `test/email` now use `@UseGuards(DevOnlyGuard)` + `@ApiExcludeEndpoint()`; removed inline `process.env` throws and unused `ForbiddenException` |
| `src/config/env.schema.ts` | edit | Added `VNPAY_REFUND_ENABLED`, `VNPAY_API_URL`, `VNPAY_REFUND_MAX_RETRIES` |
| `src/config/vnpay.config.ts` | edit | Exposed `refundEnabled`, `apiUrl`, `refundMaxRetries` |
| `src/module/payment/services/vnpay.service.ts` | edit | New `requestRefund()` — real signed VNPay Merchant Web API call, flag-gated; simulated success when disabled |
| `src/module/payment/events/order-cancelled-after-payment.handler.ts` | edit | Replaced stub with `requestRefund()`; failure increments `refundRetryCount` and parks in `refund_pending` instead of mismarking `refunded` |
| `src/module/payment/events/order-cancelled-after-payment.handler.spec.ts` | edit | Updated for new constructor (VNPayService + config mocks) |

---

## 3. Fix details

### 3.1 `DevTestUserMiddleware` production exposure (critical auth bypass)

**Before:** `AppModule.configure()` applied the middleware to `forRoutes('*')` with no environment guard, and the middleware unconditionally set `req.user = { roles: ['admin','restaurant'] }` from the `x-test-user-id` header. In production this was a full authentication bypass.

**After — two independent layers (defense-in-depth):**

- **Not registered in production.** `AppModule.configure()` only calls `consumer.apply(DevTestUserMiddleware)` when `isDevOrTestEnv(NODE_ENV)` is true. In any other environment it is never added to the request pipeline, so the header has no effect.
- **Self-guarding.** The middleware resolves `enabled` once at construction from `NODE_ENV`. When disabled it calls `next()` without ever setting `req.user`. It logs a warning when enabled.

Both layers use the same fail-closed allowlist, so an unset/unknown `NODE_ENV` disables the bypass.

### 3.2 Notification test endpoints

**Before:** `POST /notifications/test/push` and `/test/email` were `@AllowAnonymous()` with a scattered inline `if (process.env.NODE_ENV === 'production') throw new ForbiddenException(...)`. The routes still registered and appeared in OpenAPI in production, and a 403 advertised their existence.

**After:**

- Both protected by `@UseGuards(DevOnlyGuard)`, which returns **404 (NotFoundException)** outside dev/test — no existence leak.
- Both annotated `@ApiExcludeEndpoint()` so they never enter the public OpenAPI document (keeps the Phase 0 OpenAPI baseline clean).
- Inline `process.env` checks and the now-unused `ForbiddenException` import removed; gating is centralized in `DevOnlyGuard`.

### 3.3 VNPay refund TODO — resolved (not merely stubbed)

**Before:** `OrderCancelledAfterPaymentHandler` logged a `[STUB]` line and immediately transitioned the transaction to `refunded`, with a TODO to call the real API. The failure path did not exist — a refund was "successful" even if no money moved.

**After:**

- **`VNPayService.requestRefund()`** builds the VNPay Merchant Web API refund request (`vnp_Command='refund'`, full-refund type `02`), signs it with the documented pipe-joined HMAC-SHA512 field order, and POSTs to `VNPAY_API_URL`. Transport/provider failures are returned as `{ success: false }` rather than thrown.
- **Flag-gated.** When `VNPAY_REFUND_ENABLED=false` (default; the sandbox cannot refund) no HTTP call is made and a deterministic **simulated** success is returned — explicitly labelled, so the state machine still advances in dev/test/CI without pretending the sandbox refunded.
- **Correct failure handling.** On a failed refund the handler increments `refundRetryCount` and leaves the row in `refund_pending` (recoverable by a future retry task), instead of the old behaviour of marking `refunded` regardless. `VNPAY_REFUND_MAX_RETRIES` (default 5) determines when a row is parked for manual intervention.

**Decision flagged to owner:** the real refund is gated behind a flag defaulting **off** because `VNPAY_URL` points at sandbox. Set `VNPAY_REFUND_ENABLED=true` only against a production merchant account.

---

## 4. New configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `VNPAY_REFUND_ENABLED` | `false` | Gates the real refund HTTP call; `false` ⇒ simulated success |
| `VNPAY_API_URL` | `https://sandbox.vnpayment.vn/merchant_webapi/api/transaction` | VNPay Merchant Web API endpoint |
| `VNPAY_REFUND_MAX_RETRIES` | `5` | Max auto-retries before a refund is parked for manual action |

`.env.example` should be updated with these keys (owner action).

---

## 5. Verification performed

| Check | Result |
| --- | --- |
| `pnpm --filter api run typecheck` (`tsc --noEmit`, TS 6) | ✅ Pass (exit 0) |
| `order-cancelled-after-payment.handler.spec.ts` | ✅ 11/11 pass |

---

## 6. Outstanding Phase 0 work (owner actions)

These are required to satisfy the migration plan's Phase 0 exit criteria; they cannot be synthesized from code alone:

- [ ] **Security-regression E2E** certifying the fixes:
  - (a) `NODE_ENV=production` + `x-test-user-id` on a protected route → 401/403, not privileged access
  - (b) `NODE_ENV=production` `POST /api/notifications/test/{push,email}` → 404
  - (c) `NODE_ENV=test` → both still work (dev ergonomics preserved)
  - (d) Refund (`VNPAY_REFUND_ENABLED=false`): cancel-after-paid drives `completed → refund_pending → refunded`
  - (e) Refund failure (flag on, mocked 5xx): stays `refund_pending`, `refundRetryCount` increments
- [ ] **Baseline performance/reliability report** — ≥7 representative production days: traffic, p50/p95/p99 per route, 4xx/5xx, DB connections/slow queries, Redis latency/evictions, scheduled-job durations, and per-event-type `EventBus` handler counts/failures (the "what could be lost" inventory for the Phase 2 outbox).
- [ ] **OpenAPI baseline** committed (`/api-spec.json`) + CI breaking-change check.
- [ ] **ADRs** for boundaries, gateway, Nest TCP vs RabbitMQ, DB isolation, auth propagation, saga strategy, deployment topology.
- [ ] **Service ownership + data-classification matrices.**
- [ ] Run all baseline suites twice from a clean checkout.
- [ ] Update `.env.example` with the three new VNPay keys.

---

## 7. Exit-criteria status

| Criterion | Status |
| --- | --- |
| No production request can use the dev identity bypass | ✅ Implemented (2 layers) — pending E2E (a)/(c) |
| Notification test endpoints disabled in production | ✅ Implemented (404 + excluded from spec) |
| VNPay refund behaviour complete with correct failure semantics | ✅ Implemented — pending E2E (d)/(e) |
| Baseline suites pass twice from clean checkout | ⏳ Owner |
| Agreed cutover SLOs / RTO / RPO / rollback authority | ⏳ Owner |
| Approved ADRs + ownership map | ⏳ Owner |
