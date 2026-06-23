# Phase 0 — Baseline, Security Fixes, and ADRs (Implementation Report)

**Status:** Security & correctness fixes, security-regression tests, ADR set, and the OpenAPI/CI gate tooling are implemented and verified. Remaining: capture the 7-day baseline metrics, freeze + commit the OpenAPI baseline, and pin the oasdiff action SHA (owner actions).
**Scope:** `apps/api`, `docs/adr/`, `.github/workflows/ci-validate.yml`
**Date:** 2026-06-23
**Relates to:** [MICROSERVICES_MIGRATION_PLAN.md](./MICROSERVICES_MIGRATION_PLAN.md) §2.4, §15 (items 1–6), Phase 0 exit criteria

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
| `test/e2e/security-phase0.e2e-spec.ts` | **new** | HTTP E2E: DevOnlyGuard 404 in prod / reachable in test; `x-test-user-id` inert on session-guarded routes |
| `src/lib/dev-test-user.middleware.spec.ts` | **new** | Fail-closed gate across every `NODE_ENV` (cases 3a/3c) |
| `src/lib/guards/dev-only.guard.spec.ts` | **new** | Guard allows dev/test, 404s everywhere else |
| `src/module/payment/events/order-cancelled-after-payment.refund-states.spec.ts` | **new** | Refund states (cases 3d/3e): simulated-success path and failure→retry-count path |
| `scripts/export-openapi.ts` | **new** | Generates the merged public OpenAPI doc (mirrors `main.ts`) without a listener |
| `package.json` | edit | Added `openapi:export` and `openapi:check` scripts |
| `docs/adr/` (root) | **new** | ADR index, template, and ADRs 0001–0004 |
| `.github/workflows/ci-validate.yml` | edit | Added OpenAPI export + oasdiff breaking-change gate after E2E |

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

## 3b. Security-regression tests

Four test files cover the Phase 0 exit cases 3a–3e:

| File | Cases | Type |
| --- | --- | --- |
| `test/e2e/security-phase0.e2e-spec.ts` | 3b (DevOnlyGuard 404), 3a (header inert over HTTP) | HTTP E2E |
| `src/lib/dev-test-user.middleware.spec.ts` | 3a / 3c (fail-closed gate) | Integration |
| `src/lib/guards/dev-only.guard.spec.ts` | 3b (every `NODE_ENV`) | Unit |
| `src/module/payment/events/order-cancelled-after-payment.refund-states.spec.ts` | 3d / 3e (refund states) | Integration |

**Design note (3a/3c):** the `x-test-user-id` fail-closed gate is verified at the
**middleware level**, not purely as a black-box HTTP request. The notification
routes use Better Auth's `@Session()` guard, which validates the Bearer token
independently of `req.user`, so an HTTP probe returns 401 with or without the
header in every environment and cannot isolate the middleware's effect. The
middleware spec constructs `DevTestUserMiddleware` with a stubbed `ConfigService`
across `{development, test, production, staging, '', undefined}` and asserts
`req.user` is set only in dev/test. The E2E `§B` adds the HTTP regression that the
header never elevates on a session-guarded route in production.

The E2E boots a real production-env app in-process by toggling `NODE_ENV` around
`Test.createTestingModule().compile()` (`ConfigModule` captures `NODE_ENV` at
compile time). Run it with:

```bash
pnpm --filter api run test:e2e -- security-phase0
```

## 3c. ADR set (`docs/adr/`)

ADRs live at the repository root in `docs/adr/`. Index + conventions in
`docs/adr/README.md`, starter in `0000-template.md`. Four ADRs drafted at
**Proposed** (need phase-gate sign-off to move to Accepted):

| ADR | Title |
| --- | --- |
| 0001 | Migration boundaries & strangler strategy |
| 0002 | Edge gateway as the only public ingress |
| 0003 | Database-per-service isolation |
| 0004 | Sync (Nest TCP RPC) vs async (RabbitMQ) strategy |

Still to draft (per migration plan §14): authentication propagation (internal
JWT), saga/orchestration strategy, deployment topology.

## 3d. OpenAPI baseline & CI breaking-change gate

`scripts/export-openapi.ts` regenerates the merged public OpenAPI document
(NestJS controllers + Better Auth paths) exactly as `main.ts` assembles it, with
no HTTP listener. Two npm scripts:

```bash
pnpm --filter api run openapi:export   # → apps/api/openapi/api-spec.baseline.json (freeze + commit)
pnpm --filter api run openapi:check     # → apps/api/openapi/api-spec.current.json (CI)
```

The export boots `NestFactory`, which connects via `DATABASE_URL`; run it after
the DB is reachable (CI: after the existing "Setup Database (Migrate)" step).

`ci-validate.yml` gains two steps after the E2E run: export the current spec,
then run **oasdiff** breaking-change detection with `fail-on: ERR`.

**Two owner actions before the gate is live:**

1. **Pin the action SHA.** The workflow currently has
   `oasdiff/oasdiff-action/breaking@<PIN_TO_REAL_SHA>` — pin to a real release
   commit (this repo pins all third-party actions by SHA). A Docker alternative
   needing no pin is in the YAML comment.
2. **Freeze + commit** `apps/api/openapi/api-spec.baseline.json`, and add
   `apps/api/openapi/api-spec.current.json` to `.gitignore`.

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
| New Phase 0 unit/integration specs (middleware, guard, refund-states) | ✅ 18/18 pass |
| Combined run (4 suites) | ✅ 29/29 pass |
| `security-phase0.e2e-spec.ts` | ⏳ run under e2e config with a live DB (`test:e2e -- security-phase0`) |

---

## 6. Outstanding Phase 0 work (owner actions)

These are required to satisfy the migration plan's Phase 0 exit criteria; they cannot be synthesized from code alone:

- [x] **Security-regression tests** written and green (cases 3a–3e) — see §3b. _Run `security-phase0.e2e-spec.ts` once against a live e2e DB to certify the HTTP layer._
- [x] **ADRs** 0001–0004 drafted (boundaries, gateway, DB isolation, TCP vs RabbitMQ) — §3c. _Still need: auth propagation, saga strategy, deployment topology; and phase-gate sign-off to mark Accepted._
- [x] **OpenAPI baseline tooling + CI gate** implemented — §3d. _Owner: pin the oasdiff SHA, then freeze + commit `api-spec.baseline.json`._
- [ ] **Baseline performance/reliability report** — ≥7 representative production days: traffic, p50/p95/p99 per route, 4xx/5xx, DB connections/slow queries, Redis latency/evictions, scheduled-job durations, and per-event-type `EventBus` handler counts/failures (the "what could be lost" inventory for the Phase 2 outbox).
- [ ] **Service ownership + data-classification matrices.**
- [ ] Run all baseline suites twice from a clean checkout.
- [ ] Update `.env.example` with the three new VNPay keys.
- [ ] Pin the oasdiff action SHA and freeze + commit the OpenAPI baseline (`.gitignore` the `*current.json`).

---

## 7. Exit-criteria status

| Criterion | Status |
| --- | --- |
| No production request can use the dev identity bypass | ✅ Implemented (2 layers) + tests green |
| Notification test endpoints disabled in production | ✅ Implemented (404 + excluded from spec) + tests green |
| VNPay refund behaviour complete with correct failure semantics | ✅ Implemented + tests green (3d/3e) |
| Security-regression suite green | ✅ Unit/integration 18/18; ⏳ E2E run vs live DB |
| OpenAPI baseline + breaking-change gate | ✅ Tooling + CI step; ⏳ pin SHA + commit baseline |
| ADRs drafted | ✅ 0001–0004; ⏳ 3 more + Accepted sign-off |
| Baseline suites pass twice from clean checkout | ⏳ Owner |
| Agreed cutover SLOs / RTO / RPO / rollback authority | ⏳ Owner |
| 7-day baseline metrics + ownership/data-classification map | ⏳ Owner |
