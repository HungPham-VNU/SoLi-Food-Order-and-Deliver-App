# Architecturally Significant Requirements (ASR)

## SoLi Food Delivery Platform

---

| Field              | Detail                                                                               |
|--------------------|--------------------------------------------------------------------------------------|
| **Document Title** | Architecturally Significant Requirements — SoLi Food Delivery                        |
| **Version**        | 2.0                                                                                  |
| **Status**         | Revised — UC-aligned restructuring of §4; all functional rows mapped to SRS use cases |
| **Date**           | 2026-05-18                                                                           |
| **Authors**        | Architecture Team                                                                    |
| **Scope**          | NestJS Backend (`apps/api`), Web (`apps/web`), Mobile (`apps/mobile`)                |
| **Method**         | Reverse-engineered from implementation; aligned with SRS, BRD, Vision & Scope, BR    |
| **Reference QA Taxonomy** | 14 Quality Attributes (course taxonomy)                                       |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Architectural Drivers](#2-architectural-drivers)
3. [Quality Attribute Scenarios](#3-quality-attribute-scenarios)
   - 3.1 [Performance](#31-performance)
   - 3.2 [Availability](#32-availability)
   - 3.3 [Reliability](#33-reliability)
   - 3.4 [Security](#34-security)
   - 3.5 [Scalability](#35-scalability)
   - 3.6 [Modifiability](#36-modifiability)
   - 3.7 [Interoperability](#37-interoperability)
   - 3.8 [Supportability](#38-supportability)
   - 3.9 [Maintainability](#39-maintainability)
   - 3.10 [Testability](#310-testability)
   - 3.11 [Usability](#311-usability)
   - 3.12 [Conceptual Integrity](#312-conceptual-integrity)
4. [Architecturally Significant Functional Areas](#4-architecturally-significant-functional-areas)
   - 4.1 [Authentication & Account Management (UC-1)](#41-authentication--account-management-uc-1)
   - 4.2 [Foundation & Customer Ordering Core (UC-2 – UC-10)](#42-foundation--customer-ordering-core-uc-2--uc-10)
   - 4.3 [Restaurant & Delivery Operations (UC-11 – UC-19)](#43-restaurant--delivery-operations-uc-11--uc-19)
   - 4.4 [Customer Interaction, Promotion & Notification (UC-20 – UC-26)](#44-customer-interaction-promotion--notification-uc-20--uc-26)
   - 4.5 [Administration & Governance (UC-27 – UC-35)](#45-administration--governance-uc-27--uc-35)
5. [Architectural Constraints](#5-architectural-constraints)
6. [Cross-Cutting Concerns](#6-cross-cutting-concerns)
7. [Traceability to Architecture](#7-traceability-to-architecture)

---

# 1. Introduction

## 1.1 Purpose

This document captures the **Architecturally Significant Requirements (ASRs)** of the SoLi Food Delivery Platform. ASRs are the subset of requirements — both functional and non-functional — that exert direct, measurable influence on architectural decisions. They drive choices in module structure, runtime topology, data ownership, integration style, and quality-attribute tactics.

Unlike the [SRS](../SRS_FoodDelivery.md) (which exhaustively enumerates functional requirements) or the [BRD](../BRD.md) (which describes business intent), this document focuses on **the architectural drivers**: the constraints and quality scenarios that, if violated, would render the architecture inadequate.

## 1.2 Scope and Method

The platform is **partially implemented (~70–80 % code complete)**. The codebase under [apps/api/src](../../../src) is therefore treated as **the primary source of truth**. ASRs are derived in three layers:

1. **Confirmed ASRs** — directly observable in the implemented codebase (e.g., dual-layer idempotency for order placement, ACL snapshot projections, VNPay HMAC verification).
2. **Implied ASRs** — supported by the codebase but not exhaustively realized; e.g., partial real-time WebSocket presence; partial automated test coverage.
3. **Forward-looking ASRs** — unimplemented requirements explicitly required by [Business Rules](../Business_Rules.md), [Use Case Specification](../USE_CASE_SPECIFICATION.md), and [SRS](../SRS_FoodDelivery.md), kept as architectural design targets (e.g., shipper dispatch atomicity, refund automation, multi-region failover — *deferred*).

Each ASR is annotated with a confidence label:
- **[Implemented]** — verified in code
- **[Partial]** — partially implemented; design intent visible
- **[Planned]** — required but not yet implemented

## 1.3 Implementation Reality

The implemented architecture is a **Modular Monolith** with:

- Bounded contexts: `restaurant-catalog`, `ordering`, `payment`, `promotion`, `notification`, `image`, `auth`
- **Selective CQRS** (`@nestjs/cqrs`): used for order placement (`PlaceOrderCommand`), order lifecycle transitions (`TransitionOrderCommand`), and payment IPN handling (`ProcessIpnCommand`); standard service/repository layering elsewhere
- **In-process synchronous EventBus** for cross-BC integration (no external message broker)
- **Anti-Corruption Layer (ACL) snapshot projections** maintained by event handlers
- **Dependency-Inversion ports** (`PAYMENT_INITIATION_PORT`, `PROMOTION_APPLICATION_PORT`) between Ordering and Payment / Promotion
- Single PostgreSQL database (Drizzle ORM) with module-scoped table groups
- Redis for cart state, idempotency keys, distributed locks, and WebSocket presence
- Socket.IO gateway for real-time notifications
- VNPay payment gateway (HMAC-SHA512), Cloudinary image CDN, FCM push, Nodemailer email

**Out of scope (explicitly NOT in current architecture, to prevent overclaiming):**
- Microservices, service mesh, gRPC
- Distributed tracing / OpenTelemetry
- Message brokers (Kafka / RabbitMQ / SQS)
- Multi-region active-active deployment
- API rate limiting via `@nestjs/throttler` (not currently registered)

---

# 2. Architectural Drivers

The following drivers shape the architecture and are referenced by ASRs throughout this document.

| ID  | Driver | Source | Architectural Impact |
|-----|--------|--------|----------------------|
| AD-1 | **Exactly-once order creation under retry / network loss** | BR-2, US-CUS-checkout, [place-order.handler.ts](../../../src/module/ordering/order/commands/place-order.handler.ts) | Dual-layer idempotency (Redis key + DB `UNIQUE(cart_id)`); ports & adapters; CQRS command for placement |
| AD-2 | **Integrity & non-repudiation of online payments** | BR-4, BR-P4, [process-ipn.handler.ts](../../../src/module/payment/commands/process-ipn.handler.ts) | HMAC-SHA512 IPN verification before any state change; optimistic locking (`version`) on `payment_transactions`; constant-time signature comparison |
| AD-3 | **Decoupling of bounded contexts under one deployable** | [Strategies §Modular Monolith Blueprint](Quality-Attributes-Architecture-Strategies.md), [ordering.module.ts](../../../src/module/ordering/ordering.module.ts) | Synchronous in-process EventBus; ACL snapshot tables (`ordering_*_snapshots`); DIP ports for outbound calls |
| AD-4 | **Real-time order-status visibility (≤ 5 s)** | Utility Tree (Performance → Update propagation), US-CUS-track | Socket.IO gateway; Redis presence reference-counting; per-user rooms |
| AD-5 | **State-machine integrity of order lifecycle** | BR (status transitions), [transitions.ts](../../../src/module/ordering/order-lifecycle/constants/transitions.ts), [transition-order.handler.ts](../../../src/module/ordering/order-lifecycle/commands/transition-order.handler.ts) | Hand-crafted TRANSITIONS map in `constants/transitions.ts`; enforcement + optimistic lock in `TransitionOrderHandler`; `OrderLifecycleService` handles ownership-only checks; `order_status_logs` audit trail |
| AD-6 | **Single-restaurant cart constraint** | BR-2 | Enforced in cart service before append; Redis-only cart store (no DB schema for carts) |
| AD-7 | **Delivery radius constraint** | BR-3 | Haversine in `GeoService`; ACL snapshot of `delivery_zones`; validated synchronously in `PlaceOrderHandler` |
| AD-8 | **Manual partner verification gate** | BR-1 | Admin approval state machine on `restaurants` and `shippers`; restricted role grants until approved |
| AD-9 | **Graceful degradation of optional external services** | Vision & Scope §QA, notification module factories | Provider abstractions (`EmailProvider`, `PushProvider`) with Noop/Stub fallbacks; event-handler exceptions never rethrown |
| AD-10 | **Auditability of privileged actions** | Quality Attribute (Supportability), use-case logging requirements | Structured logger usage; `order_status_logs`, `payment_transactions`, `notification_delivery_logs` |

---

# 3. Quality Attribute Scenarios

Each scenario follows the SEI ATAM template: Source, Stimulus, Environment, Artifact, Response, Response Measure.

## 3.1 Performance

### QA-P-01 — Restaurant Search Response Time *[Implemented]*

| Element            | Description                                                                                                                                                                                                                                                |
|--------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Customer submits a restaurant / item search query                                                                                                                                                                                                          |
| Stimulus Source    | Mobile (Expo) or Web (Vite) client                                                                                                                                                                                                                         |
| Environment        | Normal operational load (≤ 1× projected peak)                                                                                                                                                                                                              |
| Artifact           | `restaurant-catalog/search` controller + repository ([search.repository.ts](../../../src/module/restaurant-catalog/search/search.repository.ts)); PostgreSQL                                                                                              |
| Response           | First page of results returned with pagination metadata                                                                                                                                                                                                    |
| Response Measure   | p95 ≤ 2 s; page size ≤ 20; results ordered deterministically                                                                                                                                                                                              |
| Architectural Tactics | Paginated queries (`skip`/`take`); indexed lookups; planned Redis read-through caching for hot queries (Cache-Aside)                                                                                                                                       |

### QA-P-02 — Order Status Propagation to Customer *[Partial]*

| Element            | Description                                                                                                                                  |
|--------------------|----------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Order status transitions (e.g., `confirmed → preparing`)                                                                                     |
| Stimulus Source    | Restaurant operator (web), Shipper (mobile), or system task                                                                                  |
| Environment        | Normal load; customer device online; WebSocket session active                                                                                |
| Artifact           | [NotificationGateway](../../../src/module/notification/gateway/notification.gateway.ts) → `room:user:{userId}`; Socket.IO `/notifications` ns |
| Response           | Customer client receives `WS_NOTIFICATION_CREATED` event; UI updates without a refresh                                                       |
| Response Measure   | End-to-end latency from `OrderStatusChangedEvent` publish to client receipt ≤ 5 s p95                                                        |
| Architectural Tactics | In-process EventBus → event handler → WebSocket emit; Redis-tracked presence enables fan-out only to active sessions                         |

### QA-P-03 — Checkout End-to-End Latency *[Implemented]*

| Element            | Description                                                                                                                                       |
|--------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Customer submits Place-Order request                                                                                                              |
| Stimulus Source    | Customer mobile / web client                                                                                                                      |
| Environment        | Normal load; payment method = COD                                                                                                                 |
| Artifact           | [PlaceOrderHandler](../../../src/module/ordering/order/commands/place-order.handler.ts); Drizzle transaction over `orders`, `order_items`, `order_status_logs` |
| Response           | Order persisted; `OrderPlacedEvent` dispatched; response returned                                                                                 |
| Response Measure   | p95 ≤ 3 s including ACL snapshot reads, promotion reservation, haversine validation, and DB commit                                                |
| Architectural Tactics | Single ACID transaction; idempotency short-circuit on Redis hit; haversine in-memory; ACL reads from local snapshot tables (no cross-BC RPC)      |

### QA-P-04 — Menu / Availability Update Propagation *[Partial]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Restaurant edits menu item price / availability                                                                          |
| Stimulus Source    | Restaurant web client                                                                                                    |
| Environment        | Normal load                                                                                                              |
| Artifact           | Restaurant-catalog → publishes `MenuItemUpdatedEvent` ([menu-item-updated.event.ts](../../../src/shared/events/menu-item-updated.event.ts)); Ordering ACL projector |
| Response           | `ordering_menu_item_snapshots` updated; subsequent place-order uses fresh data                                           |
| Response Measure   | Snapshot freshness ≤ 60 s under normal load; ≤ 10 s under peak (best-effort, synchronous in-process)                     |

---

## 3.2 Availability

### QA-A-01 — Authentication Endpoint Availability *[Partial]*

| Element            | Description                                                                                                                       |
|--------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Customer / partner submits sign-in or session validation                                                                          |
| Stimulus Source    | Any client                                                                                                                        |
| Environment        | Calendar month, normal + occasional partial outage                                                                                |
| Artifact           | Better Auth integration ([lib/auth.ts](../../../src/lib/auth.ts)); PostgreSQL session store                                       |
| Response           | Successful authentication or graceful retryable error (HTTP 5xx with backoff hint)                                                |
| Response Measure   | Monthly availability ≥ 99.5 % (single-region MVP target; ≥ 99.9 % requires planned LB + multi-instance topology)                  |
| Architectural Tactics | Stateless app instances (planned horizontal scale); fail-fast at startup on config errors; restart-friendly Docker container       |

### QA-A-02 — Real-Time Channel Graceful Degradation *[Partial]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | WebSocket connection lost (network, server restart)                                                                      |
| Stimulus Source    | Customer / shipper / restaurant client                                                                                   |
| Environment        | Mobile network handover, degraded connectivity                                                                            |
| Artifact           | NotificationGateway client SDK                                                                                            |
| Response           | Client falls back to polling `/api/notifications`; no permanent loss of notifications (durable in `notifications` table)  |
| Response Measure   | Notifications recoverable for ≥ 30 days; reconnect resumes server-side delivery without duplication                       |
| Architectural Tactics | Durable notification store; idempotent `notification.id`; per-user room rejoin on reconnect                              |

### QA-A-03 — Optional-Channel Degradation *[Implemented]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | SMTP, FCM, or Cloudinary unreachable                                                                                     |
| Stimulus Source    | External provider outage                                                                                                 |
| Environment        | Provider degraded                                                                                                        |
| Artifact           | `EmailChannel`, `PushChannel` providers; Cloudinary signed-upload flow                                                   |
| Response           | Core flows (order placement, payment) continue; the affected channel logs failure to `notification_delivery_logs`        |
| Response Measure   | Zero impact on order-state correctness; failed dispatches retried by future iteration (currently logged, not auto-retried) |

---

## 3.3 Reliability

### QA-R-01 — Order Placement Idempotency *[Implemented]*

| Element            | Description                                                                                                                                                          |
|--------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Client retries Place-Order request after timeout or unknown response                                                                                                  |
| Stimulus Source    | Mobile / web client                                                                                                                                                  |
| Environment        | Network instability                                                                                                                                                  |
| Artifact           | [PlaceOrderHandler](../../../src/module/ordering/order/commands/place-order.handler.ts); Redis `idempotency:order:{key}`; `orders.cart_id` UNIQUE constraint         |
| Response           | Identical `orderId` returned; no duplicate `orders` row; no double-charge                                                                                            |
| Response Measure   | Zero duplicate orders across N retries with identical `X-Idempotency-Key` within `IDEMPOTENCY_TTL_FALLBACK_SECONDS`                                                  |
| Architectural Tactics | D5-A Redis idempotency key (fast path); D5-B DB `UNIQUE(cart_id)` (backstop); transactional commit before publishing `OrderPlacedEvent`                              |

### QA-R-02 — Payment IPN Webhook Idempotency *[Implemented]*

| Element            | Description                                                                                                                            |
|--------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | VNPay retries the IPN callback                                                                                                         |
| Stimulus Source    | VNPay gateway                                                                                                                          |
| Environment        | VNPay retry policy (until `RspCode=00`)                                                                                                |
| Artifact           | [ProcessIpnHandler](../../../src/module/payment/commands/process-ipn.handler.ts); `payment_transactions.version`                       |
| Response           | First call updates state and publishes `PaymentConfirmedEvent` / `PaymentFailedEvent`; subsequent calls return success without re-emit |
| Response Measure   | Zero duplicate state transitions; zero duplicate downstream events under arbitrary retry counts                                        |
| Architectural Tactics | Signature verification first; lookup by `vnp_TxnRef`; terminal-state short-circuit; optimistic-lock `version` increment                |

### QA-R-03 — Order State-Machine Integrity *[Implemented]*

| Element            | Description                                                                                                                                                    |
|--------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Any actor (customer, restaurant, shipper, admin, scheduled task) requests an order status transition                                                            |
| Stimulus Source    | Any of the above                                                                                                                                               |
| Environment        | Normal + concurrent operation                                                                                                                                  |
| Artifact           | [TRANSITIONS map](../../../src/module/ordering/order-lifecycle/constants/transitions.ts) (closed transition matrix); [TransitionOrderHandler](../../../src/module/ordering/order-lifecycle/commands/transition-order.handler.ts) (enforcement + optimistic lock); [OrderLifecycleService](../../../src/module/ordering/order-lifecycle/services/order-lifecycle.service.ts) (ownership checks); `orders.version`; `order_status_logs` |
| Response           | Disallowed transitions rejected with a typed error; allowed transitions commit atomically and append an audit log                                              |
| Response Measure   | 100 % of disallowed transitions rejected; 100 % committed transitions logged; concurrent transition attempts fail-safe via optimistic-lock retry / rejection   |
| Architectural Tactics | Hand-crafted TRANSITIONS map (D6-A) in `constants/transitions.ts`; `TransitionOrderHandler` enforces via `@CommandHandler`; optimistic locking on `version`; transactional INSERT into `order_status_logs` |

### QA-R-04 — Single-Restaurant Cart Invariant *[Implemented]*

| Element            | Description                                                                                                                |
|--------------------|----------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Customer adds an item from Restaurant B to a cart already containing items from Restaurant A                                |
| Stimulus Source    | Customer client                                                                                                            |
| Environment        | Normal                                                                                                                     |
| Artifact           | [CartService](../../../src/module/ordering/cart/cart.service.ts)                                                            |
| Response           | Request rejected with a structured error (`CART_RESTAURANT_CONFLICT`); existing cart left unchanged                         |
| Response Measure   | 100 % rejection in unit / e2e tests; cart store remains consistent                                                          |
| Architectural Tactics | BR-2 enforcement in service before Redis write                                                                              |

### QA-R-05 — Atomic Shipper Assignment *[Planned]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Two shippers concurrently accept the same dispatch                                                                       |
| Stimulus Source    | Shipper mobile clients                                                                                                   |
| Environment        | Concurrent acceptance                                                                                                    |
| Artifact           | Delivery-assignment module (forward-looking; not yet present in `src/module`)                                            |
| Response           | At most one shipper bound to the order; loser receives a typed conflict response                                         |
| Response Measure   | 0 dual-assignment incidents under load test                                                                              |
| Architectural Tactics | `UPDATE … WHERE shipper_id IS NULL` single-row atomic assignment, or Redis distributed lock + optimistic version          |

---

## 3.4 Security

### QA-S-01 — VNPay Callback Integrity *[Implemented]*

| Element            | Description                                                                                                                                       |
|--------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Forged or tampered VNPay IPN payload                                                                                                              |
| Stimulus Source    | Attacker / Internet                                                                                                                               |
| Environment        | Public IPN endpoint                                                                                                                               |
| Artifact           | [VNPayService.verifyReturnUrl / verifyIpn](../../../src/module/payment/services/vnpay.service.ts); `crypto.timingSafeEqual`                       |
| Response           | Request rejected; no state mutation; no events emitted                                                                                            |
| Response Measure   | 100 % rejection of payloads with invalid HMAC-SHA512 signatures in penetration tests                                                              |
| Architectural Tactics | Signature verification **before** any DB lookup; constant-time comparison; ordered URL-encoded canonicalization per VNPay spec                    |

### QA-S-02 — Authentication & Session Management *[Implemented]*

| Element            | Description                                                                                                                  |
|--------------------|------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | User sign-in / session validation                                                                                            |
| Stimulus Source    | Customer, restaurant, shipper, admin                                                                                          |
| Environment        | Public endpoints                                                                                                              |
| Artifact           | Better Auth + Drizzle adapter ([lib/auth.ts](../../../src/lib/auth.ts)); `session`, `account`, `verification` tables          |
| Response           | Strong session token issued; bearer token validated server-side on each request                                              |
| Response Measure   | Industry-standard password hashing (Better Auth default — scrypt); session secret ≥ 32 chars enforced at startup via Zod      |
| Architectural Tactics | Library-managed credential handling; HTTPS-only deployment (deployment constraint); no custom rolling of crypto             |

### QA-S-03 — Role-Based Authorization *[Implemented]*

| Element            | Description                                                                                                                                |
|--------------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Unauthorized actor accesses an admin / restaurant / shipper endpoint                                                                       |
| Stimulus Source    | Any client                                                                                                                                 |
| Environment        | Any                                                                                                                                        |
| Artifact           | `user.role` (multi-role CSV); [`hasRole()`](../../../src/module/auth/role.util.ts) utility; route guards                                   |
| Response           | 401 (no session) / 403 (insufficient role); audit log entry                                                                                |
| Response Measure   | 100 % denial rate for missing / mismatched roles in route tests                                                                            |
| Architectural Tactics | Multi-role bitmap-equivalent (CSV) checked via OR-logic helper; Better Auth `admin()` plugin for admin scoping                           |

### QA-S-04 — Dev-Only Identity Middleware Must Not Reach Production *[Not Implemented — Open Security Gap]*

| Element            | Description                                                                                                                          |
|--------------------|--------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Production deployment containing development middleware that injects synthetic users from headers                                    |
| Stimulus Source    | Deployment pipeline                                                                                                                  |
| Environment        | Production                                                                                                                           |
| Artifact           | [`DevTestUserMiddleware`](../../../src/lib/dev-test-user.middleware.ts)                                                              |
| Response           | Middleware removed from the global middleware chain in `NODE_ENV=production`                                                         |
| Response Measure   | 100 % of production builds reject `x-test-user-id` header; verified by deployment smoke test                                         |
| **Current Gap**    | **`app.module.ts` registers this middleware unconditionally for ALL routes (`'*'`) with no `NODE_ENV` check. The middleware itself has no environment guard. Any caller who sends `x-test-user-id` in production would have `req.user` injected. Production builds must add environment gating before deployment.** |
| Architectural Tactics | Add `if (process.env.NODE_ENV !== 'production')` guard in `AppModule.configure()`; enforce via CI gate on production Docker image (Planned) |

### QA-S-05 — Input Validation & Stored-XSS Protection *[Implemented]*

| Element            | Description                                                                                                                  |
|--------------------|------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Customer submits a review / restaurant updates description with HTML / JS payload                                            |
| Stimulus Source    | Authenticated user                                                                                                            |
| Environment        | Any                                                                                                                          |
| Artifact           | Global `ValidationPipe({ transform: true })` in [main.ts](../../../src/main.ts); class-validator DTOs                         |
| Response           | Disallowed fields stripped; lengths enforced; rendering relies on framework default escaping                                  |
| Response Measure   | No stored-XSS execution in security regression tests; SQL injection prevented by Drizzle parameterized queries                |

### QA-S-06 — Rate Limiting on Public Endpoints *[Planned]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Burst of unauthenticated requests on login, register, or search endpoints                                                |
| Stimulus Source    | Attacker / abusive client                                                                                                |
| Environment        | Production                                                                                                               |
| Artifact           | Reverse proxy (planned) or `@nestjs/throttler` (not yet integrated)                                                      |
| Response           | Excess requests throttled with 429                                                                                       |
| Response Measure   | ≤ 100 req/min/IP for login; ≤ 300 req/min/IP for catalog                                                                  |
| Architectural Tactics | Edge-layer throttling (nginx / cloud LB) OR module-level throttler; not yet implemented in `apps/api`                     |

---

## 3.5 Scalability

### QA-SC-01 — Horizontal Scaling of API Instances *[Partial]*

| Element            | Description                                                                                                                |
|--------------------|----------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Browse / search load reaches 2× projected peak                                                                              |
| Stimulus Source    | Aggregate customer traffic                                                                                                  |
| Environment        | Peak hour                                                                                                                  |
| Artifact           | Stateless NestJS API instances behind a load balancer (planned deployment topology); PostgreSQL primary                     |
| Response           | Additional instances absorb traffic; per-request latency remains within SLO                                                 |
| Response Measure   | p95 search response ≤ 2 s under 2× peak in load tests; CPU < 70 % per instance                                              |
| Architectural Tactics | Stateless app design (no in-memory session); Redis-shared cart and presence; database connection pooling                    |
| Constraint         | **In-process synchronous EventBus** implies event delivery is local to the instance that publishes; this is acceptable today because the publisher and all listeners live in the same module graph. Multi-instance deployments must NOT split event handling between instances, OR a future migration to an external broker is required before such a split. |

### QA-SC-02 — Cart and Idempotency Storage Scaling *[Implemented]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | High concurrent cart mutation / order submission                                                                         |
| Stimulus Source    | Customer fleet                                                                                                           |
| Environment        | Peak                                                                                                                     |
| Artifact           | Redis cluster; ioredis client with backoff retry                                                                          |
| Response           | Cart writes complete in O(1) per key; idempotency lookup is O(1)                                                         |
| Response Measure   | p95 cart op ≤ 50 ms                                                                                                      |
| Architectural Tactics | Per-customer cart key; per-idempotency-key set with TTL; lazy-connect + capped exponential backoff retry                 |

---

## 3.6 Modifiability

### QA-M-01 — Adding a New Payment Provider *[Implemented]*

| Element            | Description                                                                                                                                |
|--------------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Add a non-VNPay payment provider (e.g., MoMo, ZaloPay)                                                                                     |
| Stimulus Source    | Product roadmap                                                                                                                            |
| Environment        | Development                                                                                                                                |
| Artifact           | `IPaymentInitiationPort` ([payment-initiation.port.ts](../../../src/shared/ports/payment-initiation.port.ts)); Payment module               |
| Response           | New provider implemented as a strategy behind the port; ordering BC unchanged                                                              |
| Response Measure   | Zero file changes in `module/ordering`; ≤ 5 file additions in `module/payment`; contract tests cover initiate / confirm / fail / cancel    |
| Architectural Tactics | Ports & Adapters; in-process DI symbol token; provider selection by payment method enum                                                    |

### QA-M-02 — Adding a New Order Status *[Implemented]*

| Element            | Description                                                                                                                          |
|--------------------|--------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Add a new lifecycle status (e.g., `awaiting_courier`)                                                                                |
| Stimulus Source    | Operations roadmap                                                                                                                   |
| Environment        | Development                                                                                                                          |
| Artifact           | `order.schema.ts` enum; `OrderLifecycleService.transitions`; notification handlers                                                   |
| Response           | New status added to enum, transition matrix, and audit log writer                                                                    |
| Response Measure   | Required changes ≤ 3 files in `module/ordering`; transition-matrix tests assert closed set                                           |

### QA-M-03 — Replacing a Notification Channel Provider *[Implemented]*

| Element            | Description                                                                                                          |
|--------------------|----------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Replace FCM with another push provider                                                                               |
| Stimulus Source    | Operations / cost decision                                                                                           |
| Environment        | Development                                                                                                          |
| Artifact           | `PushProvider` interface ([push-provider.interface.ts](../../../src/module/notification/channels/push/push-provider.interface.ts)) |
| Response           | New adapter added; module factory rebinds the token                                                                  |
| Response Measure   | Zero changes in event handlers or domain code                                                                        |

---

## 3.7 Interoperability

### QA-I-01 — VNPay Gateway Integration *[Implemented]*

| Element            | Description                                                                                                                       |
|--------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Customer pays online                                                                                                              |
| Stimulus Source    | Customer / VNPay return + IPN callbacks                                                                                            |
| Environment        | Public Internet                                                                                                                   |
| Artifact           | [VNPayService](../../../src/module/payment/services/vnpay.service.ts); `vnp_*` parameters; `crypto` HMAC-SHA512                   |
| Response           | Payment URL generated; return + IPN parsed; signed correctly; result persisted                                                    |
| Response Measure   | Conformance to VNPay spec (signature, order, encoding) verified by sandbox testing                                                |

### QA-I-02 — Push Notification Multi-Channel Dispatch *[Implemented]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | A `NotificationCreated` event fires                                                                                      |
| Stimulus Source    | Cross-BC event handlers                                                                                                  |
| Environment        | Customer in foreground / background / offline                                                                            |
| Artifact           | [ChannelDispatcherService](../../../src/module/notification/services/channel-dispatcher.service.ts); `InAppChannelService`, `EmailChannelService`, `PushChannelService` |
| Response           | Channels chosen by user preferences and presence; each channel delivers independently                                    |
| Response Measure   | Per-channel success rate ≥ 95 % when provider is healthy; delivery attempts logged in `notification_delivery_logs`        |

### QA-I-03 — Image Upload via Cloudinary *[Implemented]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Restaurant uploads a menu-item image                                                                                     |
| Stimulus Source    | Restaurant web client                                                                                                    |
| Environment        | Normal                                                                                                                   |
| Artifact           | [Cloudinary provider](../../../src/module/image/cloudinary.provider.ts); signed upload                                   |
| Response           | Image uploaded to Cloudinary; URL persisted in `images` table                                                            |
| Response Measure   | Upload latency p95 ≤ 5 s for images ≤ 2 MB                                                                                |

---

## 3.8 Supportability

### QA-SUP-01 — Audit Trail for Order Lifecycle *[Implemented]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Any order status transition                                                                                              |
| Stimulus Source    | Any actor                                                                                                                |
| Environment        | Any                                                                                                                      |
| Artifact           | `order_status_logs` table                                                                                                |
| Response           | One row per transition: `{orderId, fromStatus, toStatus, triggeredBy (UUID|null), triggeredByRole, note, createdAt}`; `fromStatus` is nullable for the initial creation entry |
| Response Measure   | 100 % of committed transitions audited; queryable by orderId, actor, or time range                                       |

### QA-SUP-02 — Structured Logging on Cross-BC Events *[Partial]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | An event handler fails (e.g., ACL projection error, channel dispatch error)                                              |
| Stimulus Source    | Internal                                                                                                                 |
| Environment        | Production                                                                                                               |
| Artifact           | NestJS `Logger`; never-rethrow contract in `@EventsHandler` classes                                                       |
| Response           | Error logged at ERROR level with context (`eventType`, `aggregateId`); upstream not impacted                              |
| Response Measure   | Mean time to detect ≤ 5 minutes (manual / log-based until APM is integrated)                                              |
| Gap                | No central log aggregation or correlation IDs in the implemented baseline; APM / OpenTelemetry is future work             |

### QA-SUP-03 — Stuck-Order Diagnostics *[Planned]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | An order remains in a non-terminal status beyond a configured threshold                                                  |
| Stimulus Source    | Scheduler                                                                                                                |
| Environment        | Production                                                                                                               |
| Artifact           | Scheduled task in `ordering/order-lifecycle`                                                                              |
| Response           | Order flagged with a reason code and surfaced on the admin monitoring view                                               |
| Response Measure   | Detection latency ≤ 1 minute past threshold                                                                              |

---

## 3.9 Maintainability

### QA-MA-01 — Bounded-Context Boundary Enforcement *[Implemented]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | A developer attempts to import a Payment / Promotion concrete class into Ordering                                        |
| Stimulus Source    | Pull request                                                                                                             |
| Environment        | Development                                                                                                              |
| Artifact           | Ports (`PAYMENT_INITIATION_PORT`, `PROMOTION_APPLICATION_PORT`); ACL snapshot tables                                     |
| Response           | The compiler permits it, but architectural reviews / planned ESLint boundary rules forbid it; only the port symbol is imported |
| Response Measure   | Zero cross-BC concrete imports in `module/ordering` (verified by grep / planned ESLint rule)                              |

### QA-MA-02 — Schema Evolution via Drizzle Migrations *[Implemented]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | New table / column added                                                                                                 |
| Stimulus Source    | Developer                                                                                                                |
| Environment        | Development → staging → production                                                                                       |
| Artifact           | Drizzle Kit migrations; `drizzle.config.ts`                                                                              |
| Response           | Generated migration file applied; existing data preserved                                                                |
| Response Measure   | Migrations are forward-compatible (no destructive rewrites without a coordinated release)                                |

---

## 3.10 Testability

### QA-T-01 — Deterministic Order Placement Tests *[Implemented]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | A new lifecycle / pricing rule is added                                                                                  |
| Stimulus Source    | Developer                                                                                                                |
| Environment        | CI                                                                                                                       |
| Artifact           | Jest unit + e2e tests; payment e2e ([test/payment.e2e-spec.ts](../../../test/payment.e2e-spec.ts))                       |
| Response           | Tests pass deterministically against ephemeral DB + Redis + stub providers                                               |
| Response Measure   | Test suite green on every push; pure-function rules (haversine, pricing) covered ≥ 90 %                                  |
| Architectural Tactics | Provider abstractions allow `NoopEmailProvider` / `StubPushProvider` in tests; injectable `RedisService` permits mocking |

### QA-T-02 — Test Authentication Bypass for E2E *[Implemented]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | E2E suite executes against the running API                                                                               |
| Stimulus Source    | Developer / CI                                                                                                            |
| Environment        | Non-production                                                                                                            |
| Artifact           | `DevTestUserMiddleware`                                                                                                   |
| Response           | Synthetic user injected from `x-test-user-id`; roles granted for test scenarios                                          |
| Response Measure   | Test setup ≤ 1 line per request; never active in production (per QA-S-04)                                                |

---

## 3.11 Usability

> Usability ASRs are owned by the client apps ([mobile](../../../../mobile), [web](../../../../web)), but listed here when they impose backend constraints.

### QA-U-01 — Sub-2-Minute Registration Flow *[Partial]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | New customer signs up                                                                                                    |
| Stimulus Source    | Customer (mobile / web)                                                                                                  |
| Environment        | Normal mobile network                                                                                                    |
| Artifact           | Better Auth `emailAndPassword` flow; client UX                                                                            |
| Response           | Account created, session issued, first screen rendered                                                                   |
| Response Measure   | ≥ 90 % of first-time users complete in ≤ 2 minutes; SUS ≥ 80 in usability tests                                          |
| Backend Constraint | Account-creation API response p95 ≤ 2 s                                                                                  |

### QA-U-02 — Predictable Restaurant Discovery *[Implemented]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Customer browses restaurants from the home screen                                                                        |
| Stimulus Source    | Customer                                                                                                                  |
| Environment        | Normal                                                                                                                    |
| Artifact           | Restaurant-catalog public endpoints                                                                                      |
| Response           | Stable pagination cursors; consistent ordering across requests                                                            |
| Response Measure   | ≥ 90 % task-completion rate in usability tests; deterministic ordering verified by tests                                  |

---

## 3.12 Conceptual Integrity

### QA-CI-01 — Single Order-Status Vocabulary *[Implemented]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Any module reads or writes order status                                                                                  |
| Stimulus Source    | Internal modules                                                                                                          |
| Environment        | Any                                                                                                                       |
| Artifact           | `orderStatusEnum` in [order.schema.ts](../../../src/module/ordering/order/order.schema.ts)                               |
| Response           | All modules consume the same enum; cross-BC consumers receive status as a string literal type matching the enum           |
| Response Measure   | Zero parallel status vocabularies across modules; contract tests assert the allowed set                                   |

### QA-CI-02 — Event Envelope Consistency *[Implemented]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | A new domain event is introduced                                                                                         |
| Stimulus Source    | Developer                                                                                                                |
| Environment        | Development                                                                                                              |
| Artifact           | [shared/events](../../../src/shared/events) — all events are immutable POJOs with explicit constructors                  |
| Response           | New event follows the same shape and is exported through the barrel `index.ts`                                           |
| Response Measure   | Linter / review enforces; all consumers import only from `@/shared/events`                                                |

---

# 4. Architecturally Significant Functional Areas

The tables below enumerate ASRs organized by **Use Case**, following the structure of [`ASR - Architectual Significant Requirements.md`](ASR%20-%20Architectual%20Significant%20Requirements.md) and the UC taxonomy of [SRS_FoodDelivery.md](../SRS_FoodDelivery.md) and [USE_CASE_SPECIFICATION.md](../USE_CASE_SPECIFICATION.md). Each row maps to one Use Case or a closely related UC group sharing the same architectural concern. Technical mechanisms (idempotency keys, ACL projections, state machine enforcement) appear in the **Architectural Requirements** column — they are **not** stand-alone Function rows.

Column definitions:
- **No.** — sequence within the domain group
- **Domain** — SRS phase grouping
- **Function** — canonical UC name and SRS identifier
- **Description** — business-level behavior: actor actions and expected business outcome
- **Architectural Requirements** — quality-attribute-organized constraints, tactics, and design decisions
- **Note** — implementation status: [Implemented] / [Partial] / [Planned]

---

## 4.1 Authentication & Account Management (UC-1)

| No. | Domain | Function | Description | Architectural Requirements | Note |
|-----|--------|----------|-------------|----------------------------|------|
| 1 | Authentication & Account Management | **Sign Up** (UC-1) | Customers, restaurant owners, and delivery personnel provide their email address, personal information, and a password to create a platform account. Restaurant and shipper registrations enter a `pending_approval` state and require explicit administrator approval before operational access is granted (BR-1). | **Security:** Library-managed password hashing (scrypt via Better Auth defaults); `BETTER_AUTH_SECRET` minimum 32 characters enforced at startup via Zod `env.schema.ts` — application refuses to start if the constraint is violated. All user input validated via global `ValidationPipe` with class-validator DTOs; parameterized queries via Drizzle ORM prevent SQL injection. HTTPS enforced at the reverse-proxy layer in production. **Performance:** Account creation API response p95 ≤ 2 s. **Reliability:** Duplicate-account prevention via `UNIQUE(email)` on `users` table. **Interoperability:** `expo()` plugin supports Expo deep-link OAuth callbacks; `phoneNumber()` plugin provides an OTP stub for future SMS integration (currently logs to console in development). **Auditability:** Registration attempt, outcome, and timestamp logged; planned central pipeline for audit trail. | [Implemented] |
| 2 | | **Sign In** (UC-1) | Users provide their registered email address and password to authenticate and receive a bearer session token. The token authorises all subsequent API requests and is validated server-side on every call. | **Security:** Constant-time credential comparison (provided by Better Auth internal logic); strong session tokens (≥ 128-bit entropy) persisted in the `session` table; bearer plugin extracts `Authorization: Bearer <token>` header on every request. **Performance:** Login API response p95 ≤ 1 s. **Rate Limiting:** Brute-force protection via edge-proxy throttle or `@nestjs/throttler` (Planned — QA-S-06). **Reliability:** Session validation is stateless per-request; a compromised or expired token is rejected immediately without cache invalidation delay. **Auditability:** Failed login attempts observable via structured access logs. | [Implemented] |
| 3 | | **Forgot Password / Reset Password** (UC-1) | Users who cannot sign in initiate a password reset by supplying a registered email address or phone number. The system delivers a time-limited one-time verification code; upon successful verification the user sets a new password and all previously active sessions are invalidated. | **Security:** OTP is time-limited, single-use, and invalidated after first successful use; new-password submission transmitted over HTTPS; phone OTP is a development stub (OTP logged to console) — production integration requires a real SMS provider behind the `phoneNumber()` plugin interface. Reset endpoint does not disclose whether an account exists for the supplied contact (no account-existence leak). **Performance:** Email OTP delivery within 30–60 s; password update API response p95 ≤ 2 s. **Reliability:** Email channel has a Noop fallback when SMTP is unreachable — core flows unaffected. **Auditability:** Reset request initiation, OTP delivery status, and completion outcome (success / failure) logged with timestamp. | [Partial] |
| 4 | | **Role-Based Access Control** | Each platform endpoint enforces authorization based on the authenticated caller's assigned role (`customer`, `restaurant`, `shipper`, `admin`). A user may simultaneously hold multiple roles (e.g., `user,restaurant`). | **Security:** `user.role` stores a comma-separated multi-role value; `hasRole()` utility in [`role.util.ts`](../../../src/module/auth/role.util.ts) applies OR-logic — a caller passes if **any** of their roles satisfy the requirement. Better Auth `admin()` plugin scopes admin-only endpoints. 100 % denial of unauthorized requests verified by route-level tests. **Conceptual Integrity:** `APP_ROLES = ['admin','restaurant','shipper','user']` constant in [`lib/auth.ts`](../../../src/lib/auth.ts) is the single definition of allowed roles; the same vocabulary is used by route guards, CQRS handlers, ACL projectors, and `order_status_logs`. **Auditability:** Unauthorized access attempts surface as 401 (no session) / 403 (insufficient role) in structured access logs. | [Implemented] |

---

## 4.2 Foundation & Customer Ordering Core (UC-2 – UC-10)

| No. | Domain | Function | Description | Architectural Requirements | Note |
|-----|--------|----------|-------------|----------------------------|------|
| 1 | Foundation & Customer Ordering Core | **Discover Restaurants & Food** (UC-2) | Customers search for restaurants and food items by keyword, location, category, or popularity. The system returns a paginated list of approved, currently open restaurants and matching menu items. | **Performance:** p95 ≤ 2 s for the first results page under normal load; paginated (≤ 20 items per page); index-backed queries on `name`, `isApproved`, `isOpen`. **Scalability:** Read-heavy path served by stateless API instances; Redis Cache-Aside planned for hot search queries to reduce database pressure at peak. **Security:** Parameterized queries via Drizzle ORM prevent SQL injection; all input sanitized via `ValidationPipe`; no PII exposed in public search results. **Reliability:** Catalog reflects latest `isApproved` and `isOpen` states from the restaurant-catalog BC; ACL snapshots in Ordering BC carry a consistent view for checkout validation. | [Implemented] |
| 2 | | **View Restaurant Details** (UC-3) | Customers select a restaurant to view its complete profile: menu categories, items, modifier groups and options, pricing, operating hours, average rating, and delivery zone information. | **Performance:** Detail-page API response p95 ≤ 2 s. **Reliability:** Item availability status reflects the latest toggle event (UC-13); pricing and modifier data sourced from `menu_items` / `modifier_options` tables at query time. **Interoperability (rating):** Restaurant aggregate rating derived from review projections — Restaurant Catalog BC updates `ratingSum` / `ratingCount` on `RestaurantRatingChangedEvent`; detail endpoint reads the derived `averageRating` from the `restaurants` row. | [Implemented] |
| 3 | | **Add Item to Cart** (UC-4) | Customers select a menu item with desired modifier choices and add it to their shopping cart. The system validates item availability and enforces the single-restaurant cart constraint (BR-2); attempting to add an item from a different restaurant than items already in the cart is rejected. | **Reliability (BR-2):** Single-restaurant constraint enforced in `CartService` before the Redis write — returns structured error `CART_RESTAURANT_CONFLICT` on mismatch; existing cart left unchanged. Item pricing captured from the ACL snapshot at add-time and is immune to subsequent catalog edits. **Performance:** Cart write p95 ≤ 50 ms (Redis O(1) per-customer-key operation). **Availability:** Cart persisted in Redis with TTL = `CART_ABANDONED_TTL_SECONDS` (app_setting, 86 400 s default); abandoned carts swept by a background task. **Security:** Cart key scoped per authenticated `customerId` (`cart:{customerId}`); unauthenticated access rejected. | [Implemented] |
| 4 | | **Manage Shopping Cart** (UC-5) | Customers view their current cart contents, update item quantities, remove individual items, or clear the entire cart before proceeding to checkout. | **Reliability:** Cart read/write operations are atomic per Redis key; concurrent submissions to checkout are protected by a short-lived lock (`cart:{customerId}:lock`, `SET NX EX 30`) held during `PlaceOrderHandler`. **Usability:** Cart state is immediately reflected after each mutation; the API returns the full cart payload on every mutation response — no separate refresh call required. **Security:** All cart operations require an authenticated session; operations are scoped to the authenticated user's cart key only. | [Implemented] |
| 5 | | **Save & Manage Delivery Addresses** (UC-6) | Customers save, update, select, and remove delivery addresses tied to their account. A previously designated default address is pre-populated at checkout to reduce friction. | **Usability:** Default address pre-populated at checkout to minimize input steps; ≤ 2 interactions to select a saved address from the list. **Security:** Addresses stored and retrieved scoped to the authenticated user's `customerId`; no cross-user address access is possible at the API layer. **Reliability:** Addresses persisted in PostgreSQL `customer_addresses` table; survive cart clearing and session expiry. | [Implemented] |
| 6 | | **Manage Delivery Zones** (UC-7) | Restaurant owners define and update the geographic delivery coverage for their restaurant including delivery radius, base delivery fee, per-kilometre rate, preparation time estimate, and delivery time buffer. Administrators may manage zones on behalf of any restaurant. | **Reliability (ACL):** Every zone create / update / delete publishes a `DeliveryZoneSnapshotUpdatedEvent`; the Ordering ACL projector upserts `ordering_delivery_zone_snapshots` on receipt — UC-8 reads exclusively from this snapshot for fee computation and ETA, never from the zones service directly (bounded-context isolation). **Performance:** Zone change propagated to checkout within ≤ 10 s under normal load (synchronous in-process event). **Security:** Zone management restricted to authenticated restaurant role (own restaurant only) or admin role. **Conceptual Integrity:** Single `GeoService` (Haversine implementation) used for all distance computations across the system; no duplicated geo logic. | [Implemented] |
| 7 | | **Place Order** (UC-8) | Customers submit their shopping cart as a confirmed order, providing the delivery address, optional preparation notes, and payment method (COD or VNPay). The system validates delivery radius, applies any active promotion, captures a frozen pricing snapshot, and persists the order atomically. For VNPay orders a payment redirect URL is returned immediately. | **Reliability:** Single Drizzle ACID transaction over `orders`, `order_items`, and `order_status_logs`; `OrderPlacedEvent` emitted **after** successful commit. Dual-layer idempotency: Redis key (`idempotency:order:{key}`, TTL from `ORDER_IDEMPOTENCY_TTL_SECONDS`) as fast-path short-circuit **plus** DB `UNIQUE(cart_id)` as backstop — guarantees zero duplicate orders on client retry under any network condition. Checkout lock (`cart:{customerId}:lock`, `SET NX EX 30`) prevents concurrent submissions for the same cart. **Performance:** End-to-end p95 ≤ 3 s including all ACL snapshot reads, Haversine validation, promotion reservation, and DB commit. **Security:** `X-Idempotency-Key` header validated and scoped to the authenticated `customerId` session token. **Reliability (pricing):** Each `order_items` row captures `unit_price`, `modifiers_price`, item name, and `subtotal` from the ACL snapshot at order time — immune to subsequent menu edits. **Auditability:** Initial `order_status_logs` entry created at placement with `fromStatus = NULL` (origin entry). | [Implemented] |
| 8 | | **Make Online Payment — VNPay** (UC-9) | Customers are redirected to VNPay's hosted payment page to complete payment. VNPay notifies the backend via a server-to-server IPN callback, which drives the order into `paid` (payment success) or triggers cancellation (payment failure or session timeout). | **Security:** Payment redirect URL signed with HMAC-SHA512 over canonically ordered `vnp_*` parameters per VNPay specification; VNPay hash secret (`VNPAY_HASH_SECRET`) never logged or surfaced in API responses; IPN callback signature verified using `crypto.timingSafeEqual` (constant-time) before any state mutation. **Reliability (idempotency):** IPN handler short-circuits on terminal-state detection — duplicate VNPay retries produce no additional state change; optimistic lock (`payment_transactions.version`) prevents concurrent mutations; `UNIQUE(provider_txn_id)` is the DB-level backstop. Payment amount validated against the stored transaction amount (BR-P4). **Interoperability:** Strict conformance to VNPay integration specification (parameter order, percent-encoding, VND-only currency, sandbox / live base-URL environment switch). **Reliability (timeout):** Pending VNPay transactions automatically expired after `PAYMENT_SESSION_TIMEOUT_SECONDS` (env var, default 1 800 s) by `PaymentTimeoutTask` (runs every minute via `@Cron`); expired transactions emit `PaymentFailedEvent` which drives order cancellation via the Ordering BC. **Auditability:** `payment_transactions` row records `status`, `amount`, `providerTxnId`, `expiresAt`, and `version` for every lifecycle change. | [Implemented] |
| 9 | | **View Order History** (UC-10) | Customers view their complete history of past and active orders with full details: itemised line items, pricing breakdown, full status timeline, and payment information. Customers may initiate a reorder from a previous order, which reconstructs the item list for re-adding to cart. | **Performance:** Order list API response p95 ≤ 2 s; paginated; indexed by `customerId` and `createdAt`. **Security:** Order queries scoped to the authenticated `customerId` — no cross-customer data leakage; resource-level authorization enforced in the `order-history` service layer. **Reliability:** Full `order_status_logs` timeline available per order; orders are never deleted — status transitions only. **Usability:** Reorder returns a cart-shaped payload derived from historical `order_items`; UC-4 re-validates current prices against the latest ACL snapshot at the point of add — historical prices are advisory only. | [Implemented] |

---

## 4.3 Restaurant & Delivery Operations (UC-11 – UC-19)

| No. | Domain | Function | Description | Architectural Requirements | Note |
|-----|--------|----------|-------------|----------------------------|------|
| 1 | Restaurant & Delivery Operations | **Restaurant Registration & Profile Management** (UC-11) | Restaurant owners register their business by providing name, address, geographic coordinates, delivery zone, operating hours, and supporting documents. After submission the application enters `pending_approval`; administrators approve or reject it. Approved profile edits update the live catalog and propagate to all dependent bounded contexts. | **Security:** Restaurant role required for all profile management actions; admin role required for approval / rejection decisions. Role assignments enforced at the handler layer. **Reliability (BC propagation):** Every approved create / update publishes `RestaurantUpdatedEvent`; Ordering ACL projector refreshes `ordering_restaurant_snapshots` and Notification ACL projector refreshes `notification_restaurant_snapshots` synchronously in-process within ≤ 1 minute. Approval state machine on `restaurants` table: `pending_approval → approved / rejected`. **Auditability:** Approval decisions recorded with admin actor UUID, timestamp, and reason note; state transitions are non-repudiable. **Manageability:** Approval effective immediately (synchronous in-process event propagation). | [Implemented] |
| 2 | | **Manage Menu Catalog** (UC-12) | Restaurant owners create, update, and remove menu categories, items, modifier groups, and modifier options. Changes are reflected immediately for customers browsing the restaurant and are consumed by the checkout validation pipeline at the next order. | **Interoperability (cross-BC):** `MenuItemUpdatedEvent` published on every successful create / update / delete; Ordering ACL projector upserts `ordering_menu_item_snapshots` — UC-4 and UC-8 consume only this snapshot, never the source restaurant-catalog table (bounded-context isolation). **Reliability:** Event handlers are idempotent (upsert-based); handler exceptions swallowed and logged to ERROR level to preserve order-placement correctness (event-handler contract: never rethrow). **Performance:** ACL snapshot freshness ≤ 60 s under normal load (synchronous in-process event pipeline). **Security:** Restaurant owner authenticated and verified against the `restaurantId` ownership in the service layer — a restaurant can only manage its own catalog. **Interoperability (images):** Menu item images uploaded via Cloudinary signed upload; URL persisted in `images` table — image bytes never stored on the backend. | [Implemented] |
| 3 | | **Toggle Item & Restaurant Availability** (UC-13) | Restaurant owners mark individual menu items as sold out or available, and open or close their restaurant for accepting new orders. Availability changes become visible to browsing customers and take effect at checkout within seconds. | **Reliability:** Both `MenuItemUpdatedEvent` and `RestaurantUpdatedEvent` published synchronously on every toggle; Ordering ACL snapshots updated in-process — UC-4 rejects `out_of_stock` items and UC-8 rejects closed restaurants at checkout. **Performance:** Availability change propagated to customers ≤ 10 s under peak load (in-process synchronous event pipeline). **Conceptual Integrity:** `isOpen` is the single authoritative flag for restaurant order-acceptance state; `available` / `out_of_stock` is the canonical item-level flag — no parallel or duplicate availability signals anywhere in the system. **Security:** Toggle endpoints restricted to the authenticated restaurant owner; `restaurantId` ownership verified in the service layer. | [Implemented] |
| 4 | | **Accept or Reject Order** (UC-14) | Restaurant operators review incoming orders and accept or reject them within the configured time window (default 600 s from `RESTAURANT_ACCEPT_TIMEOUT_SECONDS`). Rejection requires a reason note for the audit log. For VNPay-paid orders, rejection triggers the refund pipeline automatically. | **Reliability (state machine):** All transitions routed through `TransitionOrderCommand` → `TransitionOrderHandler`; the closed TRANSITIONS map in [`constants/transitions.ts`](../../../src/module/ordering/order-lifecycle/constants/transitions.ts) enforces: T-01 (`pending → confirmed`), T-03 (`pending → cancelled`), T-04 (`paid → confirmed`), T-05 (`paid → cancelled`); any other transition rejected with HTTP 422. Optimistic lock (`orders.version`) prevents concurrent double-accept or race conditions. **Security:** Restaurant role with matching `restaurantId` ownership verification required; a restaurant operator cannot act on another restaurant's orders. **Reliability (timeout):** Automatic cancellation by `OrderTimeoutTask` (`@Cron(EVERY_MINUTE)`) if the restaurant does not respond within `RESTAURANT_ACCEPT_TIMEOUT_SECONDS`; task dispatches `TransitionOrderCommand` through the same CQRS path. **Auditability:** Transition recorded in `order_status_logs` with `triggeredBy` UUID, `triggeredByRole`, `note`, and `createdAt`. | [Implemented] |
| 5 | | **Prepare Order for Pickup** (UC-15) | Restaurant staff mark an accepted order as ready for shipper collection after food preparation is complete. This status change notifies the assigned or available shippers to proceed to the restaurant for pickup. | **Reliability:** T-06 (`confirmed → ready_for_pickup`) routed through `TransitionOrderCommand`; publishes `OrderReadyForPickupEvent` consumed by the Notification BC to dispatch a pickup notification to the shipper. Idempotent — repeated submissions with the same version produce a conflict response rather than a duplicate event. **Performance:** Notification delivered to shipper ≤ 5 s p95 via WebSocket / FCM push. **Security:** Restaurant role with ownership check (`restaurantId`) required for this transition. **Auditability:** Transition recorded in `order_status_logs` with actor, role, and timestamp. | [Implemented] |
| 6 | | **Shipper Registration** (UC-16) | Delivery personnel register their account by providing personal details, vehicle information, and identity documents. An administrator reviews and approves the application; upon approval the account's role is elevated to `shipper`, making the shipper eligible to receive delivery assignments. | **Security:** `shipper` role elevation performed exclusively through the admin approval flow (BR-1); no self-service role escalation is possible. `shipper_applications` table tracks full application lifecycle (`pending_approval → approved / rejected`). **Reliability:** Application lifecycle state machine enforced at the service layer; only `pending_approval` applications may be acted upon. **Auditability:** Application history preserved; approval / rejection decisions recorded with admin actor, reason, and timestamp. | [Implemented] |
| 7 | | **Manage Shipper Availability** (UC-17) | Shippers toggle their real-time online / offline availability status to indicate readiness for receiving delivery assignments. The status is immediately visible to the dispatch system and reflected in the shipper's app. | **Usability:** Toggle completes in ≤ 2 interactions; resulting availability state clearly displayed. **Reliability:** Status stored idempotently; persists across app restarts and network interruptions. **Security:** Shipper-role-only endpoint; availability status tied to authenticated shipper's account. | [Partial] |
| 8 | | **Accept Delivery Assignment** (UC-18) | Shippers receive dispatch offers for orders in `ready_for_pickup` status and choose to accept an assignment. The system ensures exactly one shipper is bound to an order (first-accept-wins); the losing shipper receives a conflict response. | **Reliability:** Atomic assignment via `UPDATE orders SET shipperId = ? WHERE id = ? AND shipperId IS NULL` (single-row conditional update) or Redis distributed lock — prevents dual-assignment under concurrent acceptance (QA-R-05). **Performance:** Dispatch offer delivered to eligible shippers ≤ 5 s p95 via WebSocket / FCM push. **Security:** Shipper role required; state-machine enforcement ensures only `ready_for_pickup` orders are dispatchable. | [Planned] |
| 9 | | **Deliver Order** (UC-19) | Shippers pick up the prepared order from the restaurant and, after successful delivery to the customer, mark the order as delivered. This finalises the delivery flow, triggers customer notification, and — for COD orders — records payment reconciliation. | **Reliability:** T-09 (`picked_up → delivered`) routed through `TransitionOrderCommand`; idempotent via optimistic lock (`orders.version`) — a duplicate submission returns a conflict rather than a second event. **Performance:** Delivered status visible to customer ≤ 5 s p95 via WebSocket / FCM push. **Security:** Only the shipper whose UUID matches `orders.shipperId` may execute this transition; unauthorized attempts return HTTP 403. **Auditability:** Delivery timestamp, shipper actor, and role recorded in `order_status_logs`. | [Planned] |

---

## 4.4 Customer Interaction, Promotion & Notification (UC-20 – UC-26)

| No. | Domain | Function | Description | Architectural Requirements | Note |
|-----|--------|----------|-------------|----------------------------|------|
| 1 | Customer Interaction, Promotion & Notification | **Track Order Status** (UC-20) | Customers monitor the real-time progression of their active order through live status updates pushed to their device. Each transition (confirmed, preparing, ready for pickup, out for delivery, delivered) is reflected in the order detail view within seconds, without requiring a page refresh. | **Performance:** Status update delivered to customer ≤ 5 s p95 end-to-end — from `TransitionOrderCommand` commit through `OrderStatusChangedEvent` dispatch, WebSocket emit (`WS_NOTIFICATION_CREATED`) to `room:user:{userId}`, to client receipt (QA-P-02). **Availability:** WebSocket degradation falls back to REST polling via `/api/notifications`; notifications durably stored in `notifications` table for backfill on reconnect — durable for ≥ 30 days. **Reliability:** Redis presence ref-counting (`ws:connections:{userId}`) tracks active sessions; per-socket expiry timer cleared in `handleDisconnect` to prevent memory leaks. `OrderStatusChangedEvent` emitted after DB commit — no phantom events on rollback. **Security:** Socket.IO connection authenticated server-side via bearer token (userId resolved at connect); per-user rooms (`room:user:{userId}`) prevent cross-user status observation. | [Partial] |
| 2 | | **Cancel Order** (UC-21) | Customers cancel an active order that has not yet been picked up for delivery. Pre-payment (COD `pending`) cancellations transition directly to `cancelled`. Post-VNPay-payment cancellations additionally publish an event that triggers automatic refund processing in the Payment BC. | **Reliability:** T-02 (`pending → cancelled`) for COD and T-05 (`paid → cancelled`) for VNPay routed through `TransitionOrderCommand`; post-payment cancellation synchronously publishes `OrderCancelledAfterPaymentEvent` consumed asynchronously by Payment BC refund handler (UC-25) — event handler failure does not roll back the cancellation. **Security:** Customer can only cancel their own order — `orders.customerId` ownership enforced at the service layer; HTTP 404 returned for orders not owned by the caller (prevents order-existence leakage). **Auditability:** Cancellation recorded in `order_status_logs` with `triggeredByRole = 'customer'`, `note`, and `createdAt`. | [Implemented] |
| 3 | | **Submit Rating & Review** (UC-22) | Customers who have received a delivered order may rate it on a 1–5 star scale and leave an optional free-text comment. Each customer may submit exactly one review per order. Reviews are moderation-ready: administrators can hide or remove abusive content without deleting the underlying record. | **Reliability:** Unique constraint on `(orderId, customerId)` in the reviews table prevents duplicate submissions; a second attempt returns HTTP 409. **Conceptual Integrity (cross-BC):** Review BC references orders by UUID only — no cross-BC joins to `orders` table; `RestaurantRatingChangedEvent` propagates the updated `ratingSum` / `ratingCount` to the Restaurant Catalog BC, which updates the `restaurants` row — Review BC never writes to `restaurants` directly. **Security:** Authenticated customer session required; status-gate enforced in service layer — only `delivered` orders may be rated. **Supportability:** `status` column (`published` / `hidden` / `removed`) supports moderation without data deletion. | [Partial] |
| 4 | | **Manage Restaurant Promotions** (UC-23) | Restaurant owners create, configure, activate, pause, and deactivate promotions scoped to their restaurant — including percentage-based and flat-amount discounts with optional coupon-code triggers, usage caps (`maxTotalUses`, `maxUsesPerUser`), and validity windows (`startsAt`, `endsAt`). | **Reliability:** 4-phase reservation protocol at checkout: `preview` (read-only eligibility) → `computeAndReserve` (atomic counter increment + reservation row) → `confirm` (committed on order success) → `rollback` (compensating write on order failure) — ensures discount is never applied to a failed order. **Modifiability:** `IPromotionApplicationPort` (DIP token `PROMOTION_APPLICATION_PORT`) decouples the Ordering BC from all Promotion BC internals — zero concrete Promotion imports in `module/ordering`. **Security:** Restaurant owner can only manage promotions for their own `restaurantId`; ownership enforced in the service layer. **Conceptual Integrity:** Promotion state machine (`draft → active → paused → expired`) enforced at the service layer; disallowed transitions return HTTP 422. | [Implemented] |
| 5 | | **Manage Platform Promotions** (UC-24) | Platform administrators create and manage platform-wide promotions and generate coupon-code batches. Admin-scope promotions may apply to all restaurants (`scope = 'platform'`, `restaurantId = NULL`) or target a single specific restaurant. | **Security:** Admin role required for all platform-scope promotion operations; `restaurantId` on restaurant-scoped admin promotions is validated against actual restaurant existence. **Reliability:** Coupon code uniqueness enforced at the DB level (`UNIQUE(code)`); an admin-submitted batch containing an already-used code raises an immediate `ConflictException` — no silent retry or skip. **Conceptual Integrity:** Same promotion payload validation contract as UC-23 (BR-23.2); same state machine enforcement — no separate admin-only promotion codepath. **Auditability:** Admin actions (create, activate, deactivate, code generation) logged with actor UUID and timestamp. | [Implemented] |
| 6 | | **Process Payment Refund** (UC-25) | When a VNPay-paid order is cancelled — by the customer, restaurant, administrator, or the automated order-timeout task — the platform initiates a refund to return the captured payment to the customer. The process is event-driven and handled asynchronously by the Payment BC without blocking the cancellation flow. | **Reliability:** `OrderCancelledAfterPaymentHandler` in the Payment BC subscribes to `OrderCancelledAfterPaymentEvent`; handler processes the refund attempt independently of the cancellation — handler exception is swallowed and logged; cancellation is never rolled back due to a refund failure. **Conceptual Integrity:** The Payment BC is the sole component responsible for VNPay financial operations; Ordering BC publishes the domain event and has no further role in the refund — no direct VNPay API calls from `module/ordering`. **Interoperability:** Full VNPay refund API automation is Planned; current implementation logs the event and dispatches `order_cancelled` and `refund_initiated` notifications to the customer. **Auditability:** Refund attempt and outcome recorded in `payment_transactions`; customer notified of refund initiation via Notification BC. | [Partial] |
| 7 | | **Manage Real-Time Notifications** (UC-26) | Users receive contextual notifications through in-app, FCM push, and email channels for significant platform events (order accepted, preparing, ready for pickup, delivered, cancelled, payment confirmed, refund initiated). Users can view their notification inbox, mark messages as read, and register or remove device tokens for push delivery. | **Interoperability:** Multi-channel dispatch via [`ChannelDispatcherService`](../../../src/module/notification/services/channel-dispatcher.service.ts); provider abstractions (`EmailProvider`, `PushProvider`) with Noop / Stub fallback when provider is unavailable — order flow correctness is never blocked by a notification failure. **Availability (QA-A-03):** Provider failure isolated per channel; core flows (order placement, payment IPN) are entirely unaffected by notification errors. **Performance:** In-app notification delivered via WebSocket ≤ 5 s p95; FCM and email delivered asynchronously. **Reliability:** `notifications` table provides a durable inbox; notifications survive WebSocket disconnection; REST backfill available for ≥ 30 days. **Security:** Socket.IO connection authenticated at connect via bearer token; push device tokens registered per user-device pair and cleaned up by `DeviceTokenCleanupTask`. **Supportability (QA-I-02):** Every dispatch attempt recorded in `notification_delivery_logs` with channel, outcome, and error detail for failed attempts. | [Implemented] |

---

## 4.5 Administration & Governance (UC-27 – UC-35)

| No. | Domain | Function | Description | Architectural Requirements | Note |
|-----|--------|----------|-------------|----------------------------|------|
| 1 | Administration & Governance | **Approve or Reject Restaurant Applications** (UC-27) | Administrators review pending restaurant registration applications and approve or reject them. Approved restaurants receive operational status and become visible in the public catalog; rejected applications preserve the audit record along with the rejection reason. | **Security:** Admin role required; approval operation restricted to authenticated admin session only. **Reliability:** Approval publishes `RestaurantUpdatedEvent`; Ordering and Notification ACL snapshots refreshed in-process within ≤ 1 minute of the decision. **Auditability:** Decision recorded with admin actor UUID, timestamp, reason note, and previous / new `status` in the restaurants audit history. **Manageability:** Decision effective immediately — no asynchronous approval queue delay for the happy path. | [Implemented] |
| 2 | | **Approve or Reject Shipper Applications** (UC-28) | Administrators review pending shipper registration applications and approve or reject them. Upon approval the applicant's account role is elevated to `shipper`, making them immediately eligible for availability management (UC-17) and delivery assignment (UC-18). | **Security:** `shipper` role elevation performed exclusively through the admin approval endpoint — no self-service role escalation is permitted at any layer. **Reliability:** Approval state machine on `shipper_applications` table enforced in service layer. **Auditability:** Approval / rejection decision recorded with admin actor, target applicant UUID, reason, and timestamp. | [Partial] |
| 3 | | **Suspend or Reactivate Partner Accounts** (UC-29) | Administrators suspend restaurant or shipper partner accounts for policy violations, removing their ability to receive orders or delivery assignments. Suspended accounts may be reactivated by an administrator once the violation is resolved. | **Security:** Admin role required; suspension scope limited to partner accounts (restaurant / shipper); customer account management handled separately in UC-31. **Reliability:** Suspension immediately clears the relevant operational flags (e.g., `isApproved`, `isActive`); in-flight orders at the time of suspension are not automatically cancelled — operations team intervenes manually for edge cases. **Auditability:** Suspension and reactivation events recorded with admin actor, target account, reason, action, and effective timestamp. | [Planned] |
| 4 | | **Monitor Orders and Platform Health** (UC-30) | Administrators view a filtered, paginated list of all platform orders across all restaurants in real time. The view surfaces order status, payment method, pending actions, and anomalies such as stuck orders. Filtering and sorting support operational triage. | **Performance:** Query p95 ≤ 2 s; data freshness ≤ 60 s; paginated with indexed queries on `status`, `restaurantId`, `createdAt`. **Security:** Admin role required; all restaurants' orders accessible (unlike restaurant-scoped views). **Manageability:** Supported filters: `status`, `restaurantId`, `startDate`, `endDate`, `paymentMethod`; sort fields: `created_at`, `updated_at`, `total_amount` (all `snake_case`). **Scalability:** Planned read-replica routing for high-volume monitoring to avoid impacting transactional write throughput. | [Partial] |
| 5 | | **Search and Manage User Accounts** (UC-31) | Administrators search the user directory by name, email, role, or registration date, view individual user profiles, and perform account management actions — including suspension, reactivation, and role modification. | **Security:** Admin role required; all user management actions authenticated and audited with actor UUID, action type, target, and timestamp. **Reliability (data integrity):** Soft-delete / suspension pattern preserves historical order and transaction records associated with managed accounts. **Interoperability:** User data operations leverage Better Auth `admin()` plugin endpoints for consistent session and account lifecycle management. **Auditability:** Each administrative action (view, suspend, reactivate, role change) logged in the structured audit trail. | [Planned] |
| 6 | | **Administrative Order Cancellation & Refund** (UC-32) | Administrators cancel any in-progress order regardless of customer or restaurant ownership, and for VNPay-paid orders, trigger the automatic refund pipeline. This capability enables customer-service resolution of stuck, disputed, or fraudulent orders. | **Security:** Admin role required; admin cancellation bypasses the customer / restaurant `customerId` / `restaurantId` ownership gate — admin authority is encoded in `allowedRoles` in the TRANSITIONS map, not in a separate codepath. **Reliability:** Cancellation routed through `TransitionOrderCommand` — admin uses the same closed TRANSITIONS map as all other actors; no state-machine bypass. Post-payment cancellation publishes `OrderCancelledAfterPaymentEvent` for automatic refund handling (UC-25). **Auditability:** Admin action recorded in `order_status_logs` with `triggeredByRole = 'admin'`; reason note is mandatory (`requireNote: true` in the TRANSITIONS map entry). **Conceptual Integrity:** Admin authority expressed through the `allowedRoles` array in `constants/transitions.ts` — there is no separate admin cancellation codepath, preserving a single consistent state machine for all actors. | [Implemented] |
| 7 | | **View and Export Operational Reports** (UC-33) | Administrators generate operational reports covering order volumes by period, gross merchandise value (GMV) by restaurant, delivery performance metrics, and promotion effectiveness. Reports are exportable in standard formats (CSV / PDF). | **Performance:** Asynchronous report generation planned for large date ranges; recent-period summaries SHOULD complete p95 ≤ 5 s. **Security:** RBAC-scoped (admin-only); transmitted over HTTPS; PII minimised in exports to necessary identifiers. **Auditability:** Report access (actor, parameters, timestamp) logged. **Scalability:** Long-range reports to leverage read replica or a pre-aggregated analytics snapshot table (Planned). | [Planned] |
| 8 | | **View Dashboard & Platform Overview** (UC-34) | Administrators view a real-time operational dashboard showing active order count, today's GMV, top-performing restaurants, and current delivery status summary. The dashboard auto-refreshes at configured intervals to provide continuous situational awareness without manual reload. | **Performance:** Dashboard data freshness ≤ 60 s (acceptable for operational overview); page load p95 SHOULD be ≤ 2 s. **Security:** Admin role required; only aggregated metrics exposed — no customer PII in dashboard panels. **Manageability:** Key operational indicators surfaced without requiring a full report generation cycle; enables rapid incident detection during peak hours. | [Planned] |
| 9 | | **Manage Admin Roles & Permissions** (UC-35) | Platform administrators manage admin user accounts, assign or revoke roles, and enforce a last-admin safeguard that prevents removal of the sole remaining active administrator account — ensuring the platform always has at least one admin capable of governance actions. | **Security:** Role assignment and revocation restricted to authenticated admin actors; no self-service role escalation at any layer. Last-admin safeguard enforced at the service layer before any role revocation — the check and the role update execute within the same transaction. **Conceptual Integrity:** Uses the same `user.role` CSV model and `hasRole()` OR-logic as all other authorization flows — no separate role management vocabulary or system. **Auditability:** Every role change logged with actor UUID, target user UUID, old role value, new role value, and timestamp. **Reliability:** Last-admin check is synchronous and transactional — role revocation and safeguard check are atomic. | [Planned] |

---

# 5. Architectural Constraints

| ID  | Constraint | Rationale | Implication |
|-----|------------|-----------|-------------|
| C-1 | **Modular Monolith** — single deployable | MVP scale; reduces operational complexity | All BCs live in one process; horizontal scaling = scale the whole app; cross-BC integration uses in-process EventBus + DIP ports |
| C-2 | **PostgreSQL single primary** | Strong transactional semantics needed for order placement & payment | Cross-BC consistency through ACID transactions inside one BC + in-process events between BCs; no distributed transactions |
| C-3 | **In-process synchronous EventBus** (no broker) | Operational simplicity for MVP | Splitting BCs across instances is not supported without first introducing an external broker (Outbox + broker) — see QA-SC-01 |
| C-4 | **NestJS + Drizzle + Better Auth** | Selected by team; community-supported; type-safe | All modules use NestJS DI; schemas declared via Drizzle; auth routes auto-managed by Better Auth |
| C-5 | **Vietnamese market (VNPay only for MVP)** | Business requirement (BR-4) | VNPay-specific signature, currency in VND, integration adapter; no PCI scope (no card data stored) |
| C-6 | **HTTPS everywhere in production** | OWASP, payment integration | TLS termination at reverse proxy; not enforced inside the Node process |
| C-7 | **Single-region deployment** | Cost / scope for MVP | RTO / RPO not formalized; backups via PostgreSQL native; multi-region failover is post-MVP |
| C-8 | **Mobile and web clients are separate apps** | Distinct UX | Shared OpenAPI / Better Auth contract; backend agnostic to client kind |
| C-9 | **TypeScript end-to-end** | Type-safety, monorepo turborepo | Shared types impossible across packages without explicit publication; current codebase keeps API types internal |
| C-10 | **Cloudinary for images** | Offload storage / CDN | Backend does not store image bytes |
| C-11 | **No personal financial data stored** | Reduces compliance burden | Only payment-gateway references stored in `payment_transactions`; no PAN / CVV |

---

# 6. Cross-Cutting Concerns

## 6.1 Idempotency

- **Order placement**: Redis key (`idempotency:order:{key}`) + DB `UNIQUE(cart_id)` (QA-R-01).
- **VNPay IPN**: terminal-state short-circuit + `UNIQUE(provider_txn_id)` + optimistic lock (QA-R-02).
- **ACL projections**: `ON CONFLICT DO UPDATE` upserts; safe to replay (QA-CAT-02 / QA-NOTE-05).
- **Promotion**: 4-phase reservation protocol with explicit rollback (UC-23 §4.4, row 4).

## 6.2 Event Handling Contract

- Event handlers **must not rethrow**; errors are logged at ERROR level and swallowed to prevent upstream cascade failure (e.g., a notification error must not roll back the order).
- Side effects in handlers must be idempotent — handlers may be retried in future iterations.

## 6.3 Configuration

- All env vars validated at startup with Zod ([env.schema.ts](../../../src/config/env.schema.ts)) — **fail fast**.
- Secrets (Better Auth, VNPay hash, Cloudinary, SMTP) injected via env vars; never committed.
- Optional providers degrade to Noop / Stub when env vars are absent (Email, Push).

## 6.4 Observability

- **Implemented baseline**: per-class NestJS `Logger` instances; structured messages with context.
- **Gaps**: no correlation IDs across requests / events; no APM (OpenTelemetry, Datadog); no central log aggregation. *Planned* — but explicitly out of scope of the current ASR baseline.

## 6.5 Time and Geo

- All timestamps stored in UTC via `timestamp with time zone`.
- Distances computed via Haversine on stored decimal lat / lng pairs in `GeoService`; planned PostGIS migration is **not** required at MVP scale.

## 6.6 Authorization Layering

- Better Auth issues session tokens; bearer plugin extracts on every request.
- NestJS route guards verify session presence; service / handler code calls `hasRole()` for fine-grained role checks.
- ACL snapshots in Notification BC supply restaurant ownership without coupling to `restaurants` table.

## 6.7 Background Jobs

- `@nestjs/schedule` for cron / interval triggers:
  - Payment timeout sweeper ([payment-timeout.task.ts](../../../src/module/payment/tasks/payment-timeout.task.ts)) — runs every minute; expires `payment_transactions` past `expiresAt` (set from `PAYMENT_SESSION_TIMEOUT_SECONDS` env var); publishes `PaymentFailedEvent`
  - Order timeout sweeper ([order-timeout.task.ts](../../../src/module/ordering/order-lifecycle/tasks/order-timeout.task.ts)) — runs every minute; auto-cancels `orders` past `expiresAt` (set from `RESTAURANT_ACCEPT_TIMEOUT_SECONDS` app_setting, default 600 s); dispatches `TransitionOrderCommand` so T-03/T-05 run through the same CQRS path
  - Device-token cleanup ([device-token-cleanup.task.ts](../../../src/module/notification/tasks/device-token-cleanup.task.ts))
  - WebSocket heartbeat
- All tasks idempotent; safe under instance crashes.

---

# 7. Traceability to Architecture

The matrix below traces ASRs back to the architectural decisions that satisfy them. Source-of-truth files are linked.

| ASR / QA Scenario | Architectural Decision / Tactic | Evidence |
|-------------------|---------------------------------|----------|
| QA-R-01, UC-8 (Place Order) | D5-A Redis idempotency key (`idempotency:order:{key}`) + D5-B DB `UNIQUE(cart_id)` backstop | [place-order.handler.ts](../../../src/module/ordering/order/commands/place-order.handler.ts), `orders.cart_id` UNIQUE |
| QA-R-02, UC-9 (Make Online Payment — VNPay) | Signature-first IPN handler + optimistic lock (`payment_transactions.version`) | [process-ipn.handler.ts](../../../src/module/payment/commands/process-ipn.handler.ts), [vnpay.service.ts](../../../src/module/payment/services/vnpay.service.ts) |
| QA-R-03, QA-CI-01, UC-8–UC-21 (Order Lifecycle) | Hand-crafted TRANSITIONS map + `TransitionOrderHandler` enforces closed status enum | [transitions.ts](../../../src/module/ordering/order-lifecycle/constants/transitions.ts), [transition-order.handler.ts](../../../src/module/ordering/order-lifecycle/commands/transition-order.handler.ts), [order.schema.ts](../../../src/module/ordering/order/order.schema.ts) |
| QA-P-02, QA-A-02, UC-20 (Track Order Status), UC-26 (Notifications) | Socket.IO per-user rooms + Redis presence ref-count | [notification.gateway.ts](../../../src/module/notification/gateway/notification.gateway.ts) |
| QA-M-01, UC-9 (VNPay) | `IPaymentInitiationPort` DIP token | [payment-initiation.port.ts](../../../src/shared/ports/payment-initiation.port.ts), [payment.module.ts](../../../src/module/payment/payment.module.ts) |
| QA-M-03, UC-26 (Notifications) | Provider abstractions (`EmailProvider`, `PushProvider`) per channel with Noop fallback | [push-provider.interface.ts](../../../src/module/notification/channels/push/push-provider.interface.ts), [email-provider.interface.ts](../../../src/module/notification/channels/email/email-provider.interface.ts) |
| QA-MA-01, UC-12/UC-26 (ACL Snapshots) | ACL snapshot pattern — Ordering + Notification projectors | [notification-restaurant-snapshot.projector.ts](../../../src/module/notification/acl/notification-restaurant-snapshot.projector.ts), [acl/](../../../src/module/ordering/acl) |
| QA-P-04, UC-12 (Manage Menu Catalog) | `MenuItemUpdatedEvent` + Ordering ACL projector upsert | [menu-item-updated.event.ts](../../../src/shared/events/menu-item-updated.event.ts) |
| QA-S-01, UC-9 (VNPay) | HMAC-SHA512 over canonical params + `crypto.timingSafeEqual` IPN verification | [vnpay.service.ts](../../../src/module/payment/services/vnpay.service.ts) |
| QA-S-02, UC-1 (Sign Up / Sign In) | Better Auth library + Drizzle adapter; Zod `env.schema.ts` enforces secret ≥ 32 chars | [lib/auth.ts](../../../src/lib/auth.ts), [auth.schema.ts](../../../src/module/auth/auth.schema.ts) |
| QA-S-03, UC-1 (Role-Based Access Control) | `hasRole()` multi-role OR-logic; `APP_ROLES` single-definition constant | [role.util.ts](../../../src/module/auth/role.util.ts) |
| QA-R-04, UC-4 (Add Item to Cart) | BR-2 enforcement in `CartService` before Redis write | [cart.service.ts](../../../src/module/ordering/cart/cart.service.ts) |
| QA-SC-02, UC-4/UC-5 (Cart Management) | Redis-only cart keyed by `customerId` + ioredis | [cart.redis-repository.ts](../../../src/module/ordering/cart/cart.redis-repository.ts), [redis.module.ts](../../../src/lib/redis/redis.module.ts) |
| QA-SUP-01, UC-8–UC-32 (Order Lifecycle Audit) | `order_status_logs` audit table — every transition recorded with actor, role, note, timestamp | [order.schema.ts](../../../src/module/ordering/order/order.schema.ts) |
| AD-7, UC-8 (Place Order — delivery radius) | Haversine `GeoService` + ACL `ordering_delivery_zone_snapshots` | [geo.service.ts](../../../src/lib/geo/geo.service.ts), [delivery-zone-snapshot.schema.ts](../../../src/module/ordering/acl/schemas/delivery-zone-snapshot.schema.ts) |
| UC-9 (VNPay — payment timeout) | `PaymentTimeoutTask` (`@Cron(EVERY_MINUTE)`) sweeps `expiresAt` column | [payment-timeout.task.ts](../../../src/module/payment/tasks/payment-timeout.task.ts) |
| UC-14 (Accept/Reject Order — restaurant timeout) | `OrderTimeoutTask` (`@Cron(EVERY_MINUTE)`) uses `RESTAURANT_ACCEPT_TIMEOUT_SECONDS` from `app_settings` | [order-timeout.task.ts](../../../src/module/ordering/order-lifecycle/tasks/order-timeout.task.ts), [app-settings.schema.ts](../../../src/module/ordering/common/app-settings.schema.ts) |
| UC-30/UC-34 (Admin — runtime config) | `app_settings` table (3 seeded keys); changes effective without redeploy | [app-settings.schema.ts](../../../src/module/ordering/common/app-settings.schema.ts), [ordering.constants.ts](../../../src/module/ordering/common/ordering.constants.ts) |
| QA-A-03, QA-I-02, UC-26 (Notifications) | Provider factories with Noop / Stub fallback; `notification_delivery_logs` | [notification.module.ts](../../../src/module/notification/notification.module.ts) |
| C-3, QA-SC-01, UC-8/UC-9 (CQRS) | Selective `@nestjs/cqrs` in-process EventBus (3 command handlers) | [ordering.module.ts](../../../src/module/ordering/ordering.module.ts), [payment.module.ts](../../../src/module/payment/payment.module.ts) |
| C-2 | Drizzle ORM single PostgreSQL database — no multi-DB fan-out | [drizzle.module.ts](../../../src/drizzle/drizzle.module.ts), [schema.ts](../../../src/drizzle/schema.ts) |
| UC-25 (Process Payment Refund) | `OrderCancelledAfterPaymentHandler` in Payment BC subscribes to domain event; refund async, non-blocking | [order-cancelled-after-payment.handler.ts](../../../src/module/payment/events/order-cancelled-after-payment.handler.ts) |

---

## Appendix A — ASR Confidence Summary

The table below counts the §4 functional rows by implementation status (one row = one UC or sub-UC item). QA scenario statuses (§3) are unchanged.

| Confidence | Count | §4 UC Rows |
|------------|------:|------------|
| **Implemented** | 23 | Sign Up (UC-1), Sign In (UC-1), RBAC, Discover Restaurants (UC-2), View Restaurant Details (UC-3), Add Item to Cart (UC-4), Manage Shopping Cart (UC-5), Save Delivery Addresses (UC-6), Manage Delivery Zones (UC-7), Place Order (UC-8), Make Online Payment — VNPay (UC-9), View Order History (UC-10), Restaurant Registration (UC-11), Manage Menu Catalog (UC-12), Toggle Availability (UC-13), Accept/Reject Order (UC-14), Prepare for Pickup (UC-15), Shipper Registration (UC-16), Cancel Order (UC-21), Manage Restaurant Promotions (UC-23), Manage Platform Promotions (UC-24), Approve Restaurant Applications (UC-27), Admin Order Cancellation (UC-32) |
| **Partial** | 7 | Forgot Password (UC-1), Track Order Status (UC-20), Submit Rating & Review (UC-22), Process Payment Refund (UC-25), Manage Shipper Availability (UC-17), Approve Shipper Applications (UC-28), Monitor Orders (UC-30) |
| **Not Implemented — Open Gap** | 1 | QA-S-04: `DevTestUserMiddleware` registered unconditionally for `'*'` routes in `app.module.ts` — no `NODE_ENV` guard present; must add guard before any production deployment |
| **Planned** | 7 | Accept Delivery Assignment (UC-18), Deliver Order (UC-19), Suspend/Reactivate Partners (UC-29), Search & Manage Users (UC-31), View & Export Reports (UC-33), View Dashboard (UC-34), Manage Admin Roles (UC-35) |

---

## Appendix B — Out-of-Scope (to prevent overclaiming)

The following are commonly listed in enterprise ASRs but are **deliberately excluded** from the SoLi MVP and must not be assumed present:

- Microservices, service mesh, Kubernetes operators
- Message brokers (Kafka, RabbitMQ, NATS, SQS)
- Distributed tracing (OpenTelemetry / Jaeger / Zipkin / APM)
- Multi-region active-active or active-passive failover
- Saga orchestrator framework (Temporal, AWS Step Functions)
- Outbox pattern infrastructure (events are in-process synchronous)
- Formal SLOs / error budgets / chaos engineering practice
- API rate limiting in the NestJS app (relies on edge / reverse proxy when introduced)
- PCI DSS scope (no card data ever stored)
- MFA / FIDO2 (not in MVP — see BR-4 / SRS)
- Identity federation (OAuth / OIDC IdP) — Better Auth `expo()` plugin only for Expo deep-links

When the platform evolves past MVP, these items become candidate ASRs and should be re-introduced through a formal architecture review.
