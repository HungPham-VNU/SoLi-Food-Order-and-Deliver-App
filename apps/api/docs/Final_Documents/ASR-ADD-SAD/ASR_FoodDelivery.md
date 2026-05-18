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
   - 4.2 [Foundation & Customer Ordering Core (UC-2 – UC-9)](#42-foundation--customer-ordering-core-uc-2--uc-9)
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

The tables below capture **architecturally significant** Use Cases only — those whose requirements impose concrete decisions on module structure, runtime behavior, cross-BC integration, data ownership, or quality-attribute tactics. Use Cases that are architecturally routine (CRUD endpoints with standard pagination and role-scoped queries — UC-6, UC-10, UC-17, UC-31, UC-34) are intentionally excluded; they are governed by the general constraints in §5 and cross-cutting concerns in §6.

QA labels follow the course 14 Quality Attribute taxonomy exactly: **Performance**, **Availability**, **Reliability**, **Security**, **Scalability**, **Maintainability**, **Flexibility**, **Reusability**, **Interoperability**, **Conceptual Integrity**, **Usability**, **Testability**, **Supportability**, **Manageability**. Each Architectural Requirements cell uses the format `**QA:**<br>- bullet` — one label per concern, bullets merged under a single header.

Column definitions:
- **No.** — sequence within the domain group
- **Domain** — SRS phase grouping
- **Function** — canonical UC name and SRS identifier
- **Description** — business-level behavior: actor actions and expected business outcome
- **Architectural Requirements** — QA-organized constraints and tactics
- **Note** — [Implemented] / [Partial] / [Planned]

---

## 4.1 Authentication & Account Management (UC-1)

| No. | Domain | Function | Description | Architectural Requirements | Note |
|-----|--------|----------|-------------|----------------------------|------|
| 1 | Authentication & Account Management | **Sign Up** (UC-1) | Customers, restaurant owners, and delivery personnel provide email, personal information, and a password to create a platform account. Restaurant and shipper registrations enter `pending_approval` and require administrator approval before operational access is granted (BR-1). | **Security:**<br>- Password hashing via scrypt (Better Auth defaults); `BETTER_AUTH_SECRET` ≥ 32 chars enforced at startup by Zod `env.schema.ts` — app refuses to start on violation<br>- Global `ValidationPipe` + class-validator DTOs; Drizzle parameterized queries prevent SQL injection<br>- HTTPS enforced at reverse-proxy layer in production<br>**Reliability:**<br>- `UNIQUE(email)` on `users` table prevents duplicate accounts<br>**Performance:**<br>- Account creation API response p95 ≤ 2 s<br>**Interoperability:**<br>- `expo()` plugin supports Expo deep-link OAuth callbacks; `phoneNumber()` plugin is OTP stub for future SMS integration (logs to console in development only)<br>**Auditability:**<br>- Registration attempt, outcome, and timestamp logged (central pipeline Planned) | [Implemented] |
| 2 | | **Sign In** (UC-1) | Users provide email and password to authenticate and receive a bearer session token authorising all subsequent API requests, validated server-side on every call. | **Security:**<br>- Constant-time credential comparison (Better Auth internals); session tokens ≥ 128-bit entropy persisted in `session` table<br>- Bearer plugin validates `Authorization: Bearer <token>` on every request<br>- Brute-force protection via edge-proxy throttle or `@nestjs/throttler` (Planned — QA-S-06)<br>**Reliability:**<br>- Session validation is stateless per-request; expired or revoked token rejected immediately without cache delay<br>**Performance:**<br>- Login API response p95 ≤ 1 s<br>**Auditability:**<br>- Failed login attempts observable via structured access logs | [Implemented] |
| 3 | | **Forgot Password / Reset Password** (UC-1) | Users who cannot sign in supply a registered email or phone; the system delivers a time-limited OTP. After successful verification the user sets a new password and all prior sessions are invalidated. | **Security:**<br>- OTP is time-limited, single-use, and invalidated after first successful verification<br>- Reset submission over HTTPS only; phone OTP is a dev stub (logged to console) — production requires a real SMS provider behind the `phoneNumber()` plugin interface<br>- Reset endpoint does not disclose account existence (prevents account enumeration)<br>**Availability:**<br>- Email provider has Noop fallback when SMTP is unreachable — core platform flows unaffected<br>**Performance:**<br>- Password update API response p95 ≤ 2 s; OTP email delivered within 30–60 s<br>**Auditability:**<br>- Reset request, OTP delivery status, and outcome (success / failure) logged with timestamp | [Partial] |
| 4 | | **Role-Based Access Control** | Every platform endpoint enforces authorization based on the caller's assigned role (`customer`, `restaurant`, `shipper`, `admin`). A user may hold multiple roles simultaneously (e.g., `user,restaurant`). | **Security:**<br>- `user.role` stores a comma-separated multi-role value; `hasRole()` in [`role.util.ts`](../../../src/module/auth/role.util.ts) applies OR-logic — caller passes if any assigned role matches<br>- Better Auth `admin()` plugin scopes admin-only endpoints; 100% unauthorized-request denial verified by route tests<br>**Conceptual Integrity:**<br>- `APP_ROLES = ['admin','restaurant','shipper','user']` constant in [`lib/auth.ts`](../../../src/lib/auth.ts) is the single definition of allowed roles — same vocabulary in route guards, CQRS handlers, ACL projectors, and `order_status_logs`; no parallel role system<br>**Auditability:**<br>- Unauthorized attempts surface as 401 (no session) / 403 (insufficient role) in structured access logs | [Implemented] |

---

## 4.2 Foundation & Customer Ordering Core (UC-2 – UC-9)

| No. | Domain | Function | Description | Architectural Requirements | Note |
|-----|--------|----------|-------------|----------------------------|------|
| 1 | Foundation & Customer Ordering Core | **Discover Restaurants & Food** (UC-2) | Customers search for restaurants and menu items by keyword, location, or category. The system returns a paginated list of approved, currently open restaurants. | **Performance:**<br>- p95 ≤ 2 s for first results page; paginated ≤ 20 items; index-backed queries on `name`, `isApproved`, `isOpen`<br>**Scalability:**<br>- Read-heavy path served by stateless API instances; Redis Cache-Aside planned for hot queries at peak load<br>**Security:**<br>- Drizzle parameterized queries prevent SQL injection; `ValidationPipe` sanitizes all input; no PII exposed in public results<br>**Interoperability:**<br>- Results reflect latest `isApproved`/`isOpen` state from restaurant-catalog BC via ACL projections in Ordering BC — browsing never reads the source table directly | [Implemented] |
| 2 | | **View Restaurant Details** (UC-3) | Customers view a restaurant's full profile: menu categories, items, modifier groups, pricing, operating hours, average rating, and delivery zone coverage. | **Performance:**<br>- Detail page API response p95 ≤ 2 s<br>**Interoperability:**<br>- Item availability and pricing reflect the latest `ordering_menu_item_snapshots` updated by `MenuItemUpdatedEvent` from UC-12/UC-13<br>- Aggregate rating derived from `RestaurantRatingChangedEvent`; Restaurant Catalog BC updates `ratingSum`/`ratingCount` on the `restaurants` row — Review BC never writes to `restaurants` directly | [Implemented] |
| 3 | | **Add Item to Cart** (UC-4) | Customers add a menu item with modifier choices to their cart. The system validates item availability and enforces the single-restaurant constraint (BR-2). Mixing items from different restaurants is rejected. | **Security:**<br>- Cart key scoped per authenticated `customerId` (`cart:{customerId}`); unauthenticated access rejected<br>**Performance:**<br>- Cart write p95 ≤ 50 ms (Redis O(1) per-customer-key operation)<br>**Reliability:**<br>- BR-2 single-restaurant constraint enforced in `CartService` before Redis write — returns `CART_RESTAURANT_CONFLICT` on mismatch; existing cart unchanged<br>- Item pricing captured from ACL snapshot at add-time — immune to subsequent catalog edits<br>- Cart TTL = `CART_ABANDONED_TTL_SECONDS` (app_setting, default 86 400 s); background task sweeps expired carts | [Implemented] |
| 4 | | **Manage Shopping Cart** (UC-5) | Customers view cart contents, update item quantities, remove individual items, or clear the cart before proceeding to checkout. | **Reliability:**<br>- Cart mutations are atomic per Redis key; checkout lock (`cart:{customerId}:lock`, `SET NX EX 30`) prevents concurrent order submissions for the same cart<br>**Usability:**<br>- Full cart payload returned on every mutation response — no separate refresh call required<br>**Security:**<br>- All cart operations require authenticated session; operations scoped to the caller's own cart key only | [Implemented] |
| 5 | | **Manage Delivery Zones** (UC-7) | Restaurant owners define geographic delivery coverage: radius, base fee, per-km rate, preparation time, and delivery buffer. Administrators may manage zones for any restaurant. | **Interoperability:**<br>- Every zone change publishes `DeliveryZoneSnapshotUpdatedEvent`; Ordering ACL projector upserts `ordering_delivery_zone_snapshots` — UC-8 reads exclusively from this snapshot for fee computation and ETA, never crossing BC boundaries directly<br>**Reliability:**<br>- Zone snapshot upsert is idempotent (`ON CONFLICT DO UPDATE`); UC-8 always reads a consistent view even on event replay<br>**Performance:**<br>- Zone change propagated to checkout within ≤ 10 s (synchronous in-process event)<br>**Security:**<br>- Restricted to restaurant role (own restaurant only) or admin role; ownership verified in service layer<br>**Conceptual Integrity:**<br>- Single `GeoService` (Haversine) used for all distance computations across the system — no duplicated geo logic | [Implemented] |
| 6 | | **Place Order** (UC-8) | Customers submit their cart as a confirmed order, providing delivery address, optional notes, and payment method (COD or VNPay). The system validates delivery radius, applies any active promotion, captures a frozen pricing snapshot, and persists the order atomically. For VNPay, a payment redirect URL is returned immediately. | **Reliability:**<br>- Single Drizzle ACID transaction over `orders`, `order_items`, `order_status_logs`; `OrderPlacedEvent` emitted **after** commit only — no phantom events on rollback<br>- Dual-layer idempotency: Redis key `idempotency:order:{key}` (TTL = `ORDER_IDEMPOTENCY_TTL_SECONDS`) as fast-path short-circuit **plus** DB `UNIQUE(cart_id)` as backstop — zero duplicate orders on any client retry<br>- Checkout lock (`cart:{customerId}:lock`, `SET NX EX 30`) prevents concurrent submissions for the same cart<br>- Each `order_items` row captures `unit_price`, `modifiers_price`, item name, and `subtotal` from ACL snapshot at order time — immune to subsequent catalog edits<br>**Performance:**<br>- End-to-end p95 ≤ 3 s including all ACL reads, Haversine validation, promotion reservation, and DB commit<br>**Security:**<br>- `X-Idempotency-Key` header validated and scoped to the authenticated `customerId` session token<br>**Auditability:**<br>- Initial `order_status_logs` entry created at placement with `fromStatus = NULL` (origin entry) | [Implemented] |
| 7 | | **Make Online Payment — VNPay** (UC-9) | Customers are redirected to VNPay's hosted payment page to complete payment. VNPay notifies the backend via a server-to-server IPN callback, driving the order to `paid` on success or triggering cancellation on failure or timeout. | **Security:**<br>- Redirect URL signed with HMAC-SHA512 over canonically ordered `vnp_*` params; `VNPAY_HASH_SECRET` never logged or surfaced in API responses<br>- IPN signature verified with `crypto.timingSafeEqual` (constant-time comparison) before any state mutation<br>**Reliability:**<br>- IPN handler short-circuits on terminal-state detection — duplicate VNPay retries produce no state change<br>- Optimistic lock (`payment_transactions.version`) prevents concurrent mutations; `UNIQUE(provider_txn_id)` is the DB backstop<br>- Payment amount validated against the stored transaction amount (BR-P4) before confirming<br>- Pending transactions auto-expired after `PAYMENT_SESSION_TIMEOUT_SECONDS` (env var, default 1 800 s) by `PaymentTimeoutTask` (`@Cron(EVERY_MINUTE)`); emits `PaymentFailedEvent` → drives order cancellation<br>**Interoperability:**<br>- Strict conformance to VNPay specification: canonical parameter ordering, percent-encoding, VND-only currency, sandbox / live base-URL switch via env var<br>**Auditability:**<br>- `payment_transactions` records `status`, `amount`, `providerTxnId`, `expiresAt`, and `version` for every lifecycle change | [Implemented] |

---

## 4.3 Restaurant & Delivery Operations (UC-11 – UC-19)

| No. | Domain | Function | Description | Architectural Requirements | Note |
|-----|--------|----------|-------------|----------------------------|------|
| 1 | Restaurant & Delivery Operations | **Restaurant Registration & Profile Management** (UC-11) | Restaurant owners register their business and manage their profile. Applications enter `pending_approval`; administrators approve or reject. Approved profile updates propagate to all dependent bounded contexts. | **Security:**<br>- Restaurant role required for profile management; admin role required for approval / rejection decisions<br>**Reliability:**<br>- Approval state machine on `restaurants` table enforces `pending_approval → approved / rejected` — no arbitrary status jumps; enforced at service layer<br>**Interoperability:**<br>- Approved create / update publishes `RestaurantUpdatedEvent`; Ordering ACL projector refreshes `ordering_restaurant_snapshots`; Notification ACL projector refreshes `notification_restaurant_snapshots` synchronously in-process<br>**Manageability:**<br>- Approval effective immediately — no async queue delay for the happy path<br>**Auditability:**<br>- Decision recorded with admin actor UUID, timestamp, reason note, and old / new status — non-repudiable | [Implemented] |
| 2 | | **Manage Menu Catalog** (UC-12) | Restaurant owners create, update, and remove menu categories, items, modifier groups, and modifier options. Changes feed the checkout validation pipeline at the next order. | **Interoperability:**<br>- `MenuItemUpdatedEvent` published on every create / update / delete; Ordering ACL projector upserts `ordering_menu_item_snapshots` — UC-4 and UC-8 consume only this snapshot, never the source restaurant-catalog table (strict BC isolation)<br>- Images uploaded via Cloudinary signed upload; URL persisted in `images` table — image bytes never stored on backend<br>**Reliability:**<br>- ACL event handlers are idempotent (upsert-based); exceptions swallowed and logged to ERROR level to preserve order-placement correctness (handler contract: never rethrow)<br>- Snapshot freshness ≤ 60 s under normal load (synchronous in-process event pipeline)<br>**Security:**<br>- Restaurant owner verified against `restaurantId` ownership in service layer — a restaurant can only manage its own catalog | [Implemented] |
| 3 | | **Toggle Item & Restaurant Availability** (UC-13) | Restaurant owners mark menu items as sold out or available, and open or close their restaurant for orders. Availability changes take effect at checkout within seconds. | **Interoperability:**<br>- `MenuItemUpdatedEvent` / `RestaurantUpdatedEvent` published synchronously on every toggle; Ordering ACL snapshots updated in-process — UC-4 rejects `out_of_stock` items; UC-8 rejects closed restaurants at checkout<br>**Performance:**<br>- Availability change visible to customers ≤ 10 s under peak load (synchronous in-process pipeline)<br>**Conceptual Integrity:**<br>- `isOpen` is the single authoritative flag for restaurant order-acceptance; `available` / `out_of_stock` is the canonical item-level flag — no parallel availability signals anywhere in the system<br>**Security:**<br>- Toggle restricted to authenticated restaurant owner; `restaurantId` ownership verified in service layer | [Implemented] |
| 4 | | **Accept or Reject Order** (UC-14) | Restaurant operators accept or reject incoming orders within the configured window (default 600 s from `RESTAURANT_ACCEPT_TIMEOUT_SECONDS`). Rejection requires a reason note. Post-VNPay-payment rejection triggers the refund pipeline. | **Reliability:**<br>- Closed TRANSITIONS map in [`constants/transitions.ts`](../../../src/module/ordering/order-lifecycle/constants/transitions.ts) enforces T-01 (`pending → confirmed`), T-03 (`pending → cancelled`), T-04 (`paid → confirmed`), T-05 (`paid → cancelled`) — invalid transitions rejected with HTTP 422<br>- Optimistic lock (`orders.version`) prevents concurrent double-accept or race conditions<br>- Auto-cancellation by `OrderTimeoutTask` (`@Cron(EVERY_MINUTE)`) if restaurant does not respond within `RESTAURANT_ACCEPT_TIMEOUT_SECONDS`; dispatched via `TransitionOrderCommand` through the same CQRS path<br>**Security:**<br>- Restaurant role with `restaurantId` ownership verification required — operator cannot act on another restaurant's orders<br>**Auditability:**<br>- Transition recorded in `order_status_logs` with `triggeredBy` UUID, `triggeredByRole`, `note`, and `createdAt` | [Implemented] |
| 5 | | **Prepare Order for Pickup** (UC-15) | Restaurant staff mark an accepted order ready for shipper collection after preparation. This triggers a pickup notification to eligible shippers. | **Reliability:**<br>- T-06 (`confirmed → ready_for_pickup`) routed through `TransitionOrderCommand`; idempotent via optimistic lock — duplicate submissions produce a conflict response, not a duplicate event<br>- Publishes `OrderReadyForPickupEvent` after commit; consumed by Notification BC for shipper pickup notification<br>**Performance:**<br>- Pickup notification delivered to shipper ≤ 5 s p95 via WebSocket / FCM<br>**Security:**<br>- Restaurant role with `restaurantId` ownership check required for this transition<br>**Auditability:**<br>- Transition recorded in `order_status_logs` with actor, role, and timestamp | [Implemented] |
| 6 | | **Shipper Registration** (UC-16) | Delivery personnel register with personal details, vehicle information, and identity documents. An administrator approves the application; on approval the account role is elevated to `shipper`. | **Security:**<br>- `shipper` role elevated exclusively through admin approval (BR-1) — no self-service role escalation possible at any layer<br>- `shipper_applications` table tracks full lifecycle (`pending_approval → approved / rejected`)<br>**Reliability:**<br>- Application state machine enforced at service layer; only `pending_approval` applications may be acted upon<br>**Auditability:**<br>- Application history preserved; decisions recorded with admin actor, reason, and timestamp | [Implemented] |
| 7 | | **Accept Delivery Assignment** (UC-18) | Shippers receive dispatch offers for `ready_for_pickup` orders and accept an assignment. The system guarantees exactly one shipper bound per order (first-accept-wins). | **Reliability:**<br>- At-most-one assignment enforced by atomic `UPDATE orders SET shipperId = ? WHERE id = ? AND shipperId IS NULL` (single-row conditional update) or Redis distributed lock — prevents dual-assignment under concurrent acceptance<br>**Performance:**<br>- Dispatch offer delivered to eligible shippers ≤ 5 s p95 via WebSocket / FCM<br>**Security:**<br>- Shipper role required; state machine ensures only `ready_for_pickup` orders are dispatchable | [Planned] |
| 8 | | **Deliver Order** (UC-19) | Shippers pick up and deliver the order; upon delivery they mark the order as delivered, finalising the flow and triggering customer notification. | **Reliability:**<br>- T-09 (`picked_up → delivered`) routed through `TransitionOrderCommand`; idempotent via optimistic lock — duplicate submissions produce a conflict, not a second event<br>**Performance:**<br>- Delivered status visible to customer ≤ 5 s p95 via WebSocket / FCM<br>**Security:**<br>- Only the shipper whose UUID matches `orders.shipperId` may execute this transition; unauthorized attempts return HTTP 403<br>**Auditability:**<br>- Delivery timestamp, shipper actor UUID, and role recorded in `order_status_logs` | [Planned] |

---

## 4.4 Customer Interaction, Promotion & Notification (UC-20 – UC-26)

| No. | Domain | Function | Description | Architectural Requirements | Note |
|-----|--------|----------|-------------|----------------------------|------|
| 1 | Customer Interaction, Promotion & Notification | **Track Order Status** (UC-20) | Customers monitor the real-time progression of their active order. Each status transition is pushed to the device within seconds without requiring a manual refresh. | **Performance:**<br>- Status update delivered ≤ 5 s p95 end-to-end: `TransitionOrderCommand` commit → `OrderStatusChangedEvent` dispatch → WebSocket emit to `room:user:{userId}` → client receipt<br>**Availability:**<br>- WebSocket failure degrades gracefully to REST polling `/api/notifications`; `notifications` table provides durable backfill for ≥ 30 days on reconnect<br>**Reliability:**<br>- `OrderStatusChangedEvent` emitted only after successful DB commit — no phantom events on transaction rollback<br>- Redis presence ref-count (`ws:connections:{userId}`) + per-socket expiry timer cleared in `handleDisconnect` — prevents WebSocket connection resource leaks<br>**Security:**<br>- Socket.IO connection authenticated server-side via bearer token (userId resolved at connect); per-user rooms (`room:user:{userId}`) prevent cross-user order observation | [Partial] |
| 2 | | **Cancel Order** (UC-21) | Customers cancel an active order before pickup. Pre-payment (COD) cancellations transition directly to `cancelled`; post-VNPay-payment cancellations additionally trigger the refund pipeline. | **Reliability:**<br>- T-02 (`pending → cancelled`) for COD; T-05 (`paid → cancelled`) for VNPay — both routed through `TransitionOrderCommand` — same closed state machine applies to all actors<br>- Post-payment cancellation publishes `OrderCancelledAfterPaymentEvent`; refund handler failure (UC-25) is isolated and never rolls back the cancellation<br>**Security:**<br>- `orders.customerId` ownership enforced at service layer; HTTP 404 returned for non-owned orders (prevents order-existence enumeration)<br>**Auditability:**<br>- Recorded in `order_status_logs` with `triggeredByRole = 'customer'`, `note`, and `createdAt` | [Implemented] |
| 3 | | **Submit Rating & Review** (UC-22) | Customers rate a delivered order (1–5 stars) with an optional comment. One review per order per customer. Administrators can moderate content without deleting records. | **Reliability:**<br>- `UNIQUE(orderId, customerId)` prevents duplicate submissions — second attempt returns HTTP 409<br>**Security:**<br>- Authenticated session required; service layer status-gate — only `delivered` orders may be rated<br>**Conceptual Integrity:**<br>- Review BC references orders by UUID only — no cross-BC joins to `orders` table; `RestaurantRatingChangedEvent` propagates `ratingSum` / `ratingCount` delta to Restaurant Catalog BC — Review BC never writes to `restaurants` directly<br>**Supportability:**<br>- `status` column (`published` / `hidden` / `removed`) supports moderation without data deletion | [Partial] |
| 4 | | **Manage Restaurant Promotions** (UC-23) | Restaurant owners create, configure, activate, pause, and deactivate promotions (percentage / flat discounts, optional coupon codes, usage caps, validity windows) scoped to their restaurant. | **Reliability:**<br>- 4-phase reservation at checkout: `preview` (read-only eligibility) → `computeAndReserve` (atomic counter increment + reservation row) → `confirm` (on order success) → `rollback` (compensating write on failure) — discount never applied to a failed order<br>**Flexibility:**<br>- `IPromotionApplicationPort` (DIP token `PROMOTION_APPLICATION_PORT`) decouples Ordering BC from all Promotion BC internals — zero concrete Promotion imports in `module/ordering`<br>**Security:**<br>- Restaurant owner scoped to own `restaurantId`; ownership enforced in service layer<br>**Conceptual Integrity:**<br>- Promotion state machine (`draft → active → paused → expired`) enforced at service layer; disallowed transitions return HTTP 422 | [Implemented] |
| 5 | | **Manage Platform Promotions** (UC-24) | Platform administrators create and manage platform-wide promotions and generate coupon-code batches, targeting all restaurants or a specific one. | **Security:**<br>- Admin role required for all platform-scope operations; `restaurantId` on restaurant-scoped admin promotions validated against actual restaurant existence<br>**Reliability:**<br>- `UNIQUE(code)` at DB level; duplicate code raises `ConflictException` immediately — no silent retry or skip<br>**Conceptual Integrity:**<br>- Same validation contract and state machine as UC-23 — no separate admin-only promotion codepath<br>**Auditability:**<br>- Admin actions (create, activate, deactivate, code generation) logged with actor UUID and timestamp | [Implemented] |
| 6 | | **Process Payment Refund** (UC-25) | When a VNPay-paid order is cancelled — by any actor or by the timeout task — the platform initiates a refund asynchronously through the Payment BC without blocking the cancellation flow. | **Reliability:**<br>- `OrderCancelledAfterPaymentHandler` in Payment BC processes the refund independently; handler exception swallowed and logged — cancellation is never rolled back due to a refund failure<br>**Conceptual Integrity:**<br>- Payment BC is the sole component responsible for all VNPay financial operations; Ordering BC only publishes the domain event — no direct VNPay API calls from `module/ordering`<br>**Interoperability:**<br>- Full VNPay refund API automation [Planned]; current implementation logs the event and dispatches `order_cancelled` / `refund_initiated` notifications to the customer<br>**Auditability:**<br>- Refund attempt and outcome recorded in `payment_transactions`; customer notified via Notification BC | [Partial] |
| 7 | | **Manage Real-Time Notifications** (UC-26) | Users receive in-app, FCM push, and email notifications for order and payment events. Users view their inbox, mark messages as read, and manage device tokens for push delivery. | **Interoperability:**<br>- Multi-channel dispatch via [`ChannelDispatcherService`](../../../src/module/notification/services/channel-dispatcher.service.ts); provider abstractions (`EmailProvider`, `PushProvider`) with Noop / Stub fallback — order and payment flows never blocked by notification failures<br>**Availability:**<br>- Provider failure isolated per channel; core flows (order placement, payment IPN) entirely unaffected by notification errors<br>**Performance:**<br>- In-app notification via WebSocket ≤ 5 s p95; FCM and email dispatched asynchronously<br>**Reliability:**<br>- `notifications` table provides durable inbox; survives WebSocket disconnection; REST backfill available for ≥ 30 days<br>- Push device tokens cleaned up by `DeviceTokenCleanupTask` on stale registrations<br>**Security:**<br>- Socket.IO connection authenticated at connect via bearer token; push tokens registered per user-device pair<br>**Supportability:**<br>- Every dispatch attempt logged in `notification_delivery_logs` with channel, outcome, and error detail for failed attempts | [Implemented] |

---

## 4.5 Administration & Governance (UC-27 – UC-35)

| No. | Domain | Function | Description | Architectural Requirements | Note |
|-----|--------|----------|-------------|----------------------------|------|
| 1 | Administration & Governance | **Approve or Reject Restaurant Applications** (UC-27) | Administrators review pending restaurant registrations and approve or reject them. Approved restaurants become visible in the public catalog; ACL snapshots are refreshed in all dependent BCs. | **Security:**<br>- Admin role required; approval restricted to authenticated admin session<br>**Interoperability:**<br>- Approval publishes `RestaurantUpdatedEvent`; Ordering and Notification ACL snapshots refreshed in-process within ≤ 1 minute<br>**Manageability:**<br>- Decision effective immediately — no async approval queue delay for the happy path<br>**Auditability:**<br>- Decision recorded with admin actor UUID, timestamp, reason note, and old / new status | [Implemented] |
| 2 | | **Approve or Reject Shipper Applications** (UC-28) | Administrators review pending shipper registrations and approve or reject them. Approval elevates the account to the `shipper` role, making the shipper eligible for delivery operations. | **Security:**<br>- `shipper` role elevation exclusively through admin approval (BR-1) — no self-service escalation at any layer<br>**Reliability:**<br>- Approval state machine on `shipper_applications` table enforced in service layer; only `pending_approval` applications may be acted upon<br>**Auditability:**<br>- Decision recorded with admin actor, target applicant UUID, reason, and timestamp | [Partial] |
| 3 | | **Suspend or Reactivate Partner Accounts** (UC-29) | Administrators suspend restaurant or shipper partner accounts for policy violations, and reactivate them once the violation is resolved. | **Security:**<br>- Admin role required; suspension scope limited to partner accounts (restaurant / shipper) only<br>**Reliability:**<br>- Suspension immediately clears operational flags (`isApproved`, `isActive`); in-flight orders at suspension time are not auto-cancelled — operations team intervenes for edge cases<br>**Auditability:**<br>- Suspension and reactivation events recorded with admin actor, target account, reason, action, and effective timestamp | [Planned] |
| 4 | | **Monitor Orders and Platform Health** (UC-30) | Administrators view a filtered, paginated list of all platform orders across all restaurants in real time, with status, payment method, and anomaly indicators for operational triage. | **Performance:**<br>- Query p95 ≤ 2 s; data freshness ≤ 60 s; paginated with indexed queries on `status`, `restaurantId`, `createdAt`<br>**Security:**<br>- Admin role required; all restaurants' orders visible (unlike restaurant-scoped views)<br>**Manageability:**<br>- Filters: `status`, `restaurantId`, `startDate`, `endDate`, `paymentMethod`; sort: `created_at`, `updated_at`, `total_amount`<br>**Scalability:**<br>- Planned read-replica routing for high-volume monitoring to isolate from transactional write throughput | [Partial] |
| 5 | | **Administrative Order Cancellation & Refund** (UC-32) | Administrators cancel any in-progress order regardless of ownership and, for VNPay-paid orders, trigger the automatic refund pipeline — enabling customer-service resolution of stuck or disputed orders. | **Security:**<br>- Admin authority encoded in `allowedRoles` entries in the TRANSITIONS map — bypasses customer / restaurant ownership gate without a separate codepath<br>**Reliability:**<br>- Cancellation routed through `TransitionOrderCommand` — same closed TRANSITIONS map as all actors; no state-machine bypass for admin<br>- Post-payment cancellation publishes `OrderCancelledAfterPaymentEvent` for automatic refund handling (UC-25)<br>**Conceptual Integrity:**<br>- No separate admin cancellation codepath — admin authority is a configuration in `allowedRoles`; single state machine applies to every actor<br>**Auditability:**<br>- Recorded in `order_status_logs` with `triggeredByRole = 'admin'`; mandatory reason note (`requireNote: true` in TRANSITIONS map entry) | [Implemented] |
| 6 | | **View and Export Operational Reports** (UC-33) | Administrators generate operational reports covering order volumes, GMV by restaurant, delivery performance, and promotion effectiveness, exportable as CSV / PDF. | **Performance:**<br>- Asynchronous generation for large date ranges [Planned]; recent-period summaries p95 ≤ 5 s<br>**Security:**<br>- Admin role required; HTTPS transmission; PII minimized in exports to necessary identifiers<br>**Scalability:**<br>- Long-range reports to leverage read-replica or pre-aggregated analytics snapshot table [Planned]<br>**Auditability:**<br>- Report access (actor, parameters, timestamp) logged | [Planned] |
| 7 | | **Manage Admin Roles & Permissions** (UC-35) | Administrators assign or revoke roles for admin users and enforce a last-admin safeguard preventing removal of the sole remaining active administrator. | **Security:**<br>- Role assignment and revocation restricted to authenticated admin actors only; no self-service role escalation at any layer<br>- Last-admin safeguard enforced synchronously in the same transaction as the revocation attempt — prevents full system lockout<br>**Reliability:**<br>- Last-admin check and role update execute atomically — safeguard cannot be bypassed by concurrent requests<br>**Conceptual Integrity:**<br>- Uses the same `user.role` CSV model and `hasRole()` OR-logic as all authorization flows — no parallel role management system<br>**Auditability:**<br>- Every role change logged with actor UUID, target UUID, old role value, new role value, and timestamp | [Planned] |

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

The table below counts §4 functional rows by implementation status. Architecturally routine UCs (UC-6, UC-10, UC-17, UC-31, UC-34) are excluded from §4 — they involve standard CRUD with no architectural drivers; they are covered by the general constraints in §5 and cross-cutting concerns in §6. QA scenario statuses (§3) are unchanged.

| Confidence | Count | §4 UC Rows |
|------------|------:|------------|
| **Implemented** | 22 | Sign Up (UC-1), Sign In (UC-1), RBAC, Discover Restaurants (UC-2), View Restaurant Details (UC-3), Add Item to Cart (UC-4), Manage Shopping Cart (UC-5), Manage Delivery Zones (UC-7), Place Order (UC-8), Make Online Payment — VNPay (UC-9), Restaurant Registration (UC-11), Manage Menu Catalog (UC-12), Toggle Availability (UC-13), Accept/Reject Order (UC-14), Prepare for Pickup (UC-15), Shipper Registration (UC-16), Cancel Order (UC-21), Manage Restaurant Promotions (UC-23), Manage Platform Promotions (UC-24), Manage Real-Time Notifications (UC-26), Approve Restaurant Applications (UC-27), Admin Order Cancellation (UC-32) |
| **Partial** | 6 | Forgot Password (UC-1), Track Order Status (UC-20), Submit Rating & Review (UC-22), Process Payment Refund (UC-25), Approve Shipper Applications (UC-28), Monitor Orders (UC-30) |
| **Not Implemented — Open Gap** | 1 | QA-S-04: `DevTestUserMiddleware` registered unconditionally for `'*'` routes in `app.module.ts` — no `NODE_ENV` guard present; must add guard before any production deployment |
| **Planned** | 5 | Accept Delivery Assignment (UC-18), Deliver Order (UC-19), Suspend / Reactivate Partners (UC-29), View & Export Reports (UC-33), Manage Admin Roles & Permissions (UC-35) |

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
