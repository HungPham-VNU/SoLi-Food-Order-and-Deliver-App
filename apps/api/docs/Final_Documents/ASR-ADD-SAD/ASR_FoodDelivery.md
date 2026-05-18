# Architecturally Significant Requirements (ASR)

## SoLi Food Delivery Platform

---

| Field              | Detail                                                                               |
|--------------------|--------------------------------------------------------------------------------------|
| **Document Title** | Architecturally Significant Requirements — SoLi Food Delivery                        |
| **Version**        | 1.0                                                                                  |
| **Status**         | Baseline (derived from current implementation)                                       |
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
   - 4.1 [Authentication & Account Management](#41-authentication--account-management)
   - 4.2 [Restaurant Discovery & Catalog](#42-restaurant-discovery--catalog)
   - 4.3 [Cart Management](#43-cart-management)
   - 4.4 [Checkout & Order Placement](#44-checkout--order-placement)
   - 4.5 [Payment Processing (VNPay)](#45-payment-processing-vnpay)
   - 4.6 [Order Lifecycle](#46-order-lifecycle)
   - 4.7 [Delivery Assignment](#47-delivery-assignment)
   - 4.8 [Notification Delivery](#48-notification-delivery)
   - 4.9 [Promotion Engine](#49-promotion-engine)
   - 4.10 [Admin Governance](#410-admin-governance)
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

The following sections enumerate ASRs **per functional area**, grouped using the style of [`ASR - Architectual Significant Requirements.md`](ASR%20-%20Architectual%20Significant%20Requirements.md). Each row groups the architecturally significant qualities; trivial functional behaviors are deferred to the SRS.

## 4.1 Authentication & Account Management

| ID | Function | Description | Architectural Requirements |
|----|----------|-------------|----------------------------|
| ASR-AUTH-01 | Sign-Up | Customer / restaurant / shipper registration | **Security**: Library-managed password hashing (Better Auth default — scrypt). Strong `BETTER_AUTH_SECRET` ≥ 32 chars validated at startup. Input validation via class-validator. HTTPS in production (deployment constraint). **Performance**: account-creation p95 ≤ 2 s. **Auditability**: log registration attempt, timestamp, outcome (planned via central log pipeline). **Manual approval gate** for restaurant / shipper roles per BR-1. |
| ASR-AUTH-02 | Sign-In | Email + password sign-in; bearer token issuance | **Security**: constant-time credential comparison provided by Better Auth; bearer plugin extracts token from Authorization header; sessions persisted in `session` table. **Performance**: login p95 ≤ 1 s. **Reliability**: idempotent session validation per request. **Rate limiting** (Planned, QA-S-06). |
| ASR-AUTH-03 | Role-Based Authorization | RBAC across customer / restaurant / shipper / admin | **Security**: `user.role` CSV with `hasRole()` OR-logic; `@nestjs/cqrs` handlers + route guards enforce; admin role separated via Better Auth `admin()` plugin. 100 % denial of unauthorized requests. **Auditability**: privileged action logging (QA-SUP-01). |
| ASR-AUTH-04 | Multi-Role User | A user may simultaneously hold `restaurant` and `user` roles | **Modifiability**: avoids enum constraints; CSV in `user.role` supports OR-checks. **Conceptual Integrity**: role names defined in one place ([lib/auth.ts](../../../src/lib/auth.ts)). |
| ASR-AUTH-05 | Phone OTP (stub today) | Phone-based verification | **Interoperability** (Planned production): integrate real SMS provider behind an interface; current implementation logs OTP to console for dev. |
| ASR-AUTH-06 | Dev Test User Middleware | Bypass auth in non-production | **Security** (QA-S-04 — Open Gap): currently registered unconditionally in `app.module.ts`; **NODE_ENV guard is missing**. Must add `if (process.env.NODE_ENV !== 'production')` guard before deploying. Never reachable in production builds once gating is added. |

## 4.2 Restaurant Discovery & Catalog

| ID | Function | Description | Architectural Requirements |
|----|----------|-------------|----------------------------|
| ASR-CAT-01 | Restaurant search | Public search with pagination | **Performance**: p95 ≤ 2 s (QA-P-01); paginated; indexed; planned Redis Cache-Aside for hot queries. **Security**: parameterized queries via Drizzle; input validation; no PII in results. **Scalability**: read-heavy; stateless instances. |
| ASR-CAT-02 | Menu / item updates | Restaurant edits menu | **Interoperability across BCs**: publishes `MenuItemUpdatedEvent`; Ordering ACL projector updates `ordering_menu_item_snapshots`. **Update propagation** ≤ 60 s (QA-P-04). **Reliability**: idempotent upsert; handler never rethrows. |
| ASR-CAT-03 | Restaurant availability toggle | Open / closed and per-item availability | **Performance**: change visible to customers ≤ 10 s under peak; **Reliability**: source of truth is restaurant-catalog; ACL snapshots in Ordering store last-known availability for graceful behavior even if source is stale. |
| ASR-CAT-04 | Delivery zones | Per-restaurant radius, base fee, per-km rate, prep + buffer time | **Conceptual Integrity**: a single zone projection used by Ordering for fee & ETA computation. **Reliability**: zones snapshotted to `ordering_delivery_zone_snapshots`; haversine in `GeoService`. **BR-3** enforced at checkout. |
| ASR-CAT-05 | Image management | Cloudinary signed uploads | **Interoperability**: external CDN; **Security**: signed uploads; image URL persisted in `images`. |

## 4.3 Cart Management

| ID | Function | Description | Architectural Requirements |
|----|----------|-------------|----------------------------|
| ASR-CART-01 | Cart storage | Per-customer ephemeral cart | **Performance**: O(1) Redis ops; p95 ≤ 50 ms. **No DB persistence** (D2-B); TTL = `CART_TTL_SECONDS`. **Scalability**: distributed via Redis. |
| ASR-CART-02 | Single-restaurant constraint (BR-2) | Cart contains at most one restaurant | **Reliability** (QA-R-04): enforced in `CartService` before write; structured error returned on conflict. |
| ASR-CART-03 | Checkout lock | Prevent concurrent place-order on the same cart | **Reliability**: Redis `SET NX EX` short-lived lock during `PlaceOrderHandler`. Lock released regardless of outcome. |

## 4.4 Checkout & Order Placement

| ID | Function | Description | Architectural Requirements |
|----|----------|-------------|----------------------------|
| ASR-CHK-01 | Place order | Atomic transition cart → order | **Reliability**: single Drizzle transaction over `orders`, `order_items`, `order_status_logs`; `OrderPlacedEvent` emitted **after** commit. **Idempotency** (QA-R-01): Redis key + DB `UNIQUE(cart_id)`. **Performance** (QA-P-03): p95 ≤ 3 s end-to-end. |
| ASR-CHK-02 | Delivery radius validation (BR-3) | Customer address must be within restaurant zone | **Reliability**: synchronous haversine check against ACL snapshot; reject with structured error when out of zone. **Conceptual Integrity**: single GeoService used everywhere. |
| ASR-CHK-03 | Pricing snapshot | Order line items capture `unit_price`, `modifiers_price`, item name, and `subtotal` | **Reliability**: prices captured at order time from ACL snapshot; immune to subsequent menu edits. **Auditability**: full price history in `order_items`. |
| ASR-CHK-04 | Promotion application | Discount reservation, confirm, rollback | **Modifiability**: `IPromotionApplicationPort` (QA-M-01-style). **Reliability**: 4-phase protocol (`preview`, `computeAndReserve`, `confirm`, `rollback`) ensures atomicity across order placement. **Idempotency**: reservation keyed by pre-generated `tempOrderId`. |
| ASR-CHK-05 | Idempotency headers | `X-Idempotency-Key` honored | **Reliability** (QA-R-01); fast path Redis short-circuit. |

## 4.5 Payment Processing (VNPay)

| ID | Function | Description | Architectural Requirements |
|----|----------|-------------|----------------------------|
| ASR-PAY-01 | VNPay URL generation | Construct signed payment URL | **Security** (QA-S-01): HMAC-SHA512 over canonical URL-encoded `vnp_*` params; secret never logged. **Interoperability**: strict adherence to VNPay spec. |
| ASR-PAY-02 | IPN handling | Server-to-server callback from VNPay | **Security**: signature verification **before** any DB action; constant-time comparison. **Reliability** (QA-R-02): terminal-state short-circuit; optimistic-lock `version`; `UNIQUE(provider_txn_id)` backstop. **Integrity**: amount validated against stored transaction (BR-P4). |
| ASR-PAY-03 | Order status coupling to payment | `PENDING → PAID` only on `PaymentConfirmedEvent`; `PENDING → CANCELLED` on `PaymentFailedEvent` | **Conceptual Integrity** (QA-CI-01): payment events drive order lifecycle via Ordering BC; payment never writes to `orders` directly. |
| ASR-PAY-04 | Payment timeout | Pending VNPay transactions expire after `PAYMENT_SESSION_TIMEOUT_SECONDS` (env var, default 1 800 s) via `expiresAt` set at creation time | **Reliability**: scheduled task ([payment-timeout.task.ts](../../../src/module/payment/tasks/payment-timeout.task.ts)) runs every minute, finds transactions past `expiresAt`, transitions them to `failed` via optimistic lock, emits `PaymentFailedEvent`; idempotent. **Note**: timeout is an env var (not runtime-configurable via app_settings). |
| ASR-PAY-05 | Refund (post-paid cancellation) | Order cancelled after payment triggers refund | **Reliability**: `OrderCancelledAfterPaymentEvent` consumed by Payment BC ([order-cancelled-after-payment.handler.ts](../../../src/module/payment/events/order-cancelled-after-payment.handler.ts)). Refund process partially implemented; full automation **[Planned]**. |
| ASR-PAY-06 | COD path | Cash-on-delivery orders bypass VNPay | **Conceptual Integrity**: same `OrderPlacedEvent` shape; payment method enum drives port behavior. |

## 4.6 Order Lifecycle

| ID | Function | Description | Architectural Requirements |
|----|----------|-------------|----------------------------|
| ASR-LC-01 | Hand-crafted state machine | Status transitions defined declaratively in a closed TRANSITIONS map | **Reliability** (QA-R-03): TRANSITIONS map in [`constants/transitions.ts`](../../../src/module/ordering/order-lifecycle/constants/transitions.ts) defines T-01–T-12; `TransitionOrderHandler` ([commands/transition-order.handler.ts](../../../src/module/ordering/order-lifecycle/commands/transition-order.handler.ts)) enforces via CQRS; invalid transitions rejected with typed errors. **Maintainability**: new statuses are local changes (QA-M-02). |
| ASR-LC-02 | Optimistic locking | `orders.version` incremented on every transition | **Reliability**: concurrent transitions fail-safe; loser retries or surfaces conflict. |
| ASR-LC-03 | Lifecycle event publication | `OrderStatusChangedEvent`, `OrderReadyForPickupEvent` | **Interoperability**: Notification BC subscribes; **Performance** (QA-P-02): customer receives push / WebSocket ≤ 5 s p95. |
| ASR-LC-04 | Cancellation rules | Pre-/post-payment cancellation paths differ | **Reliability**: pre-payment cancellation simply transitions; post-payment cancellation emits `OrderCancelledAfterPaymentEvent` to trigger refund (ASR-PAY-05). |

## 4.7 Delivery Assignment *[Forward-Looking]*

| ID | Function | Description | Architectural Requirements |
|----|----------|-------------|----------------------------|
| ASR-DEL-01 | Shipper dispatch offer | Eligible shippers receive an offer | **Performance**: offer delivered ≤ 5 s. **Reliability**: at-most-one assignment (QA-R-05). |
| ASR-DEL-02 | Atomic acceptance | First-accept wins | **Reliability** (QA-R-05): single-row atomic UPDATE OR Redis distributed lock. |
| ASR-DEL-03 | Shipper availability toggle | Online / offline status | **Usability**: ≤ 2 interactions. **Reliability**: stored idempotently. |
| ASR-DEL-04 | Delivery confirmation | Shipper marks order delivered | **Reliability**: exactly-once recording with retry support; status visible to customer within 5 s. |

> All ASR-DEL items are **[Planned]**; current codebase contains supporting events (`OrderReadyForPickupEvent`) but no dedicated delivery-assignment module under `src/module`.

## 4.8 Notification Delivery

| ID | Function | Description | Architectural Requirements |
|----|----------|-------------|----------------------------|
| ASR-NOTE-01 | Multi-channel dispatch | In-app + push (FCM) + email | **Interoperability** (QA-I-02): provider abstractions per channel; per-user preferences and quiet hours. **Availability** (QA-A-03): provider failure degrades gracefully. |
| ASR-NOTE-02 | Real-time WebSocket | Socket.IO `/notifications` namespace | **Performance** (QA-P-02): ≤ 5 s; **Security**: auth on connect (server-side userId); presence tracked via Redis ref-count. **Reliability**: per-socket session-expiry timer must be cleared in `handleDisconnect` to prevent memory leaks. |
| ASR-NOTE-03 | Durable inbox | `notifications` table | **Reliability**: notifications survive WebSocket downtime; client backfills on reconnect via REST endpoint. |
| ASR-NOTE-04 | Device-token management | FCM tokens per device per user | **Reliability**: scheduled cleanup of invalid tokens ([device-token-cleanup.task.ts](../../../src/module/notification/tasks/device-token-cleanup.task.ts)). |
| ASR-NOTE-05 | Cross-BC restaurant lookup via ACL | Routing notifications to restaurant owners | **Modifiability**: `notification_restaurant_snapshots` projected from `RestaurantUpdatedEvent`. No direct read of `restaurants` table from Notification BC. |

## 4.9 Promotion Engine

| ID | Function | Description | Architectural Requirements |
|----|----------|-------------|----------------------------|
| ASR-PRO-01 | Discount preview | Read-only eligibility & amount | **Performance**: ≤ 200 ms; no DB writes. |
| ASR-PRO-02 | Discount reservation | Atomic counter increment + reservation row | **Reliability**: atomic; rollback supported on order failure. |
| ASR-PRO-03 | Port-based integration | `IPromotionApplicationPort` | **Modifiability**: Ordering imports only the port (DIP); promotion implementations evolve independently. |

## 4.10 Admin Governance

| ID | Function | Description | Architectural Requirements |
|----|----------|-------------|----------------------------|
| ASR-ADM-01 | Partner approval (BR-1) | Admin approves restaurant / shipper applications | **Security**: admin role required; **Auditability**: state change logged; **Manageability**: decision effective ≤ 1 minute. |
| ASR-ADM-02 | Monitoring view | List active orders + filters | **Performance**: p95 ≤ 2 s with data freshness ≤ 60 s for 1 000 active orders. **Scalability**: paginated. |
| ASR-ADM-03 | Operational config | Admin-tunable runtime thresholds | **Manageability**: backed by `app_settings` table ([app-settings.schema.ts](../../../src/module/ordering/common/app-settings.schema.ts)); three seeded keys: `ORDER_IDEMPOTENCY_TTL_SECONDS` (300 s default), `RESTAURANT_ACCEPT_TIMEOUT_SECONDS` (600 s default), `CART_ABANDONED_TTL_SECONDS` (86 400 s default); changes effective without redeploy. **Note**: payment expiry (`PAYMENT_SESSION_TIMEOUT_SECONDS`) is an env var, not runtime-configurable via app_settings. |
| ASR-ADM-04 | Reports | Read-only aggregations over orders / GMV | **Performance**: planned async report generation; **Security**: RBAC-scoped data access; **Auditability**: log report access. **[Partial]** |

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
- **Promotion**: 4-phase reservation protocol with explicit rollback (ASR-CHK-04).

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
| QA-R-01, ASR-CHK-01, ASR-CHK-05 | D5-A Redis idempotency + D5-B DB UNIQUE | [place-order.handler.ts](../../../src/module/ordering/order/commands/place-order.handler.ts), `orders.cart_id` UNIQUE |
| QA-R-02, ASR-PAY-02 | Signature-first IPN handler + optimistic lock | [process-ipn.handler.ts](../../../src/module/payment/commands/process-ipn.handler.ts), [vnpay.service.ts](../../../src/module/payment/services/vnpay.service.ts) |
| QA-R-03, ASR-LC-01, QA-CI-01 | Hand-crafted TRANSITIONS map + `TransitionOrderHandler` enforces closed enum | [transitions.ts](../../../src/module/ordering/order-lifecycle/constants/transitions.ts), [transition-order.handler.ts](../../../src/module/ordering/order-lifecycle/commands/transition-order.handler.ts), [order.schema.ts](../../../src/module/ordering/order/order.schema.ts) |
| QA-P-02, QA-A-02, ASR-NOTE-02 | Socket.IO + Redis presence ref-count | [notification.gateway.ts](../../../src/module/notification/gateway/notification.gateway.ts) |
| QA-M-01, ASR-PAY-01 | `IPaymentInitiationPort` DIP | [payment-initiation.port.ts](../../../src/shared/ports/payment-initiation.port.ts), [payment.module.ts](../../../src/module/payment/payment.module.ts) |
| QA-M-03, ASR-NOTE-01 | Provider abstractions per channel | [push-provider.interface.ts](../../../src/module/notification/channels/push/push-provider.interface.ts), [email-provider.interface.ts](../../../src/module/notification/channels/email/email-provider.interface.ts) |
| QA-MA-01, ASR-NOTE-05 | ACL snapshot pattern | [notification-restaurant-snapshot.projector.ts](../../../src/module/notification/acl/notification-restaurant-snapshot.projector.ts), [acl/](../../../src/module/ordering/acl) |
| QA-P-04, ASR-CAT-02 | `MenuItemUpdatedEvent` + projector | [menu-item-updated.event.ts](../../../src/shared/events/menu-item-updated.event.ts) |
| QA-S-01, ASR-PAY-01, ASR-PAY-02 | HMAC-SHA512 with timing-safe comparison | [vnpay.service.ts](../../../src/module/payment/services/vnpay.service.ts) |
| QA-S-02, ASR-AUTH-01, ASR-AUTH-02 | Better Auth library + Drizzle adapter | [lib/auth.ts](../../../src/lib/auth.ts), [auth.schema.ts](../../../src/module/auth/auth.schema.ts) |
| QA-S-03, ASR-AUTH-03 | `hasRole()` multi-role OR-logic | [role.util.ts](../../../src/module/auth/role.util.ts) |
| QA-R-04, ASR-CART-02 | BR-2 enforcement in CartService | [cart.service.ts](../../../src/module/ordering/cart/cart.service.ts) |
| QA-SC-02, ASR-CART-01 | Redis-only cart + ioredis | [cart.redis-repository.ts](../../../src/module/ordering/cart/cart.redis-repository.ts), [redis.module.ts](../../../src/lib/redis/redis.module.ts) |
| QA-SUP-01, ASR-LC-01 | `order_status_logs` audit table | [order.schema.ts](../../../src/module/ordering/order/order.schema.ts) |
| ASR-CHK-02, AD-7 | Haversine in GeoService + ACL zone snapshots | [geo.service.ts](../../../src/lib/geo/geo.service.ts), [delivery-zone-snapshot.schema.ts](../../../src/module/ordering/acl/schemas/delivery-zone-snapshot.schema.ts) |
| ASR-PAY-04 | Cron-driven payment timeout sweeper | [payment-timeout.task.ts](../../../src/module/payment/tasks/payment-timeout.task.ts) |
| ASR-LC-01 (timeout) | Cron-driven order timeout sweeper (restaurant accept window) | [order-timeout.task.ts](../../../src/module/ordering/order-lifecycle/tasks/order-timeout.task.ts), `RESTAURANT_ACCEPT_TIMEOUT_SECONDS` in `app_settings` |
| ASR-ADM-03 | Runtime-configurable thresholds in `app_settings` | [app-settings.schema.ts](../../../src/module/ordering/common/app-settings.schema.ts), [ordering.constants.ts](../../../src/module/ordering/common/ordering.constants.ts) |
| QA-A-03, QA-I-02 | Provider factories with Noop / Stub fallback | [notification.module.ts](../../../src/module/notification/notification.module.ts) |
| C-3, QA-SC-01 | `@nestjs/cqrs` in-process EventBus | [ordering.module.ts](../../../src/module/ordering/ordering.module.ts), [payment.module.ts](../../../src/module/payment/payment.module.ts) |
| C-2 | Drizzle ORM single PG database | [drizzle.module.ts](../../../src/drizzle/drizzle.module.ts), [schema.ts](../../../src/drizzle/schema.ts) |

---

## Appendix A — ASR Confidence Summary

| Confidence | Count | Examples |
|------------|------:|----------|
| **Implemented** | 24 | QA-P-01, QA-R-01, QA-R-02, QA-R-03, QA-R-04, QA-S-01, QA-S-02, QA-S-03, QA-S-05, QA-M-01, QA-M-02, QA-M-03, QA-MA-01, QA-MA-02, QA-T-01, QA-T-02, QA-CI-01, QA-CI-02, QA-SC-02, QA-I-01, QA-I-02, QA-I-03, QA-A-03, QA-SUP-01 |
| **Partial** | 9 | QA-P-02, QA-P-04, QA-A-01, QA-A-02, QA-SC-01, QA-SUP-02, QA-U-01, ASR-PAY-05, ASR-ADM-04 |
| **Not Implemented — Open Gap** | 1 | QA-S-04 (DevTestUserMiddleware unconditionally registered; no NODE_ENV guard in `app.module.ts`) |
| **Planned** | 6 | QA-R-05, QA-S-06, QA-SUP-03, ASR-DEL-01–04 |

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
