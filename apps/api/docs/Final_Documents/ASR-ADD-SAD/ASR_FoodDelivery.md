# Architecturally Significant Requirements (ASR)

## SoLi Food Delivery Platform

---

| Field              | Detail                                                                               |
|--------------------|--------------------------------------------------------------------------------------|
| **Document Title** | Architecturally Significant Requirements — SoLi Food Delivery                        |
| **Version**        | 2.6                                                                                  |
| **Status**         | Audited — rechecked against backend, web, and mobile implementation; weak trace mappings, driver mismatches, client-fallback overclaims, and Appendix count ambiguity removed; ReviewNotes companion document updated |
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
   - 3.6 [Flexibility](#36-flexibility)
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
3. **Forward-looking ASRs** — unimplemented requirements explicitly required by [Business Rules](../Business_Rules.md), [Use Case Specification](../USE_CASE_SPECIFICATION.md), and [SRS](../SRS_FoodDelivery.md), kept as architectural design targets (e.g., shipper approval workflow, stuck-order diagnostics, production refund retry automation).

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
- Client implementation reality: the mobile app initializes a Socket.IO notification hook, registers FCM tokens, and fetches the REST notification inbox on demand; a 60-second `useUnreadCount()` polling hook exists but is not wired to any component. Mobile order detail loads `/orders/my/:id` through React Query with no automatic order-detail polling. The web app currently contains a restaurant/admin UI shell and local mock order-board store; it does not implement a notification socket or live order API integration.

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
| AD-8 | **Partner approval integrity** | BR-1 | Restaurant approval currently uses boolean `restaurants.isApproved` / `isOpen` plus admin approve/unapprove endpoints; future shipper approval must preserve admin-only partner-role elevation and explicit decision integrity |
| AD-9 | **Graceful degradation of optional notification services** | Vision & Scope §QA, notification module factories | Provider abstractions (`EmailProvider`, `PushProvider`) with Noop/Stub fallbacks; notification side-effect handlers log failures without blocking committed core flows |
| AD-10 | **Auditability of privileged actions** | Quality Attribute (Supportability), use-case logging requirements | Structured logger usage; `order_status_logs`, `payment_transactions`, `notification_delivery_logs` |
| AD-11 | **Public endpoint abuse control** | QA-S-06, security requirements | Planned edge or Nest throttling for login, registration, and public search endpoints; current `apps/api` has no `@nestjs/throttler` registration |
| AD-12 | **Post-commit compensation reliability** | QA-R-08; refund and promotion compensation flows | Post-commit module side effects for refund handling and promotion rollback must remain idempotent, failure-isolated, and operationally recoverable without implying distributed consistency infrastructure |


---

# 3. Quality Attribute Scenarios

Each scenario follows the SEI ATAM template: Source, Stimulus, Environment, Artifact, Response, Response Measure.

## 3.1 Performance

### QA-P-01 — Restaurant Search Response Time *[Implemented]*

| Element            | Description                                                                                                                                                                                                                                                |
|--------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Customer submits a restaurant / item search query                                                                                                                                                                                                          |
| Stimulus Source    | Customer client                                                                                                                                                                                                                                            |
| Environment        | Normal operational load (≤ 1× projected peak)                                                                                                                                                                                                              |
| Artifact           | `restaurant-catalog/search` controller + repository ([search.repository.ts](../../../src/module/restaurant-catalog/search/search.repository.ts)); PostgreSQL                                                                                              |
| Response           | First page of results returned with pagination metadata                                                                                                                                                                                                    |
| Response Measure   | p95 ≤ 2 s; page size ≤ 20; results ordered deterministically                                                                                                                                                                                              |
| Architectural Tactics | Paginated queries (`offset`/`limit`); approved/open composite index on restaurants; planned Redis read-through caching for hot queries (Cache-Aside)                                                                                                      |

### QA-P-02 — Order Status Propagation to Customer *[Partial]*

| Element            | Description                                                                                                                                  |
|--------------------|----------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Order status transitions (e.g., `confirmed → preparing`)                                                                                     |
| Stimulus Source    | Restaurant / shipper / admin HTTP client, or system task                                                                                     |
| Environment        | Normal load; customer device online; WebSocket session active                                                                                |
| Artifact           | [NotificationGateway](../../../src/module/notification/gateway/notification.gateway.ts) → `room:user:{userId}`; Socket.IO `/notifications` ns |
| Response           | Connected notification clients receive `WS_NOTIFICATION_CREATED`; persisted notification rows remain available for REST inbox reloads         |
| Response Measure   | Backend event-to-WebSocket emit latency target ≤ 5 s p95; client screen refresh/rendering behavior is implementation-specific and currently only partial |
| Architectural Tactics | In-process EventBus → event handler → WebSocket emit; Redis-tracked presence enables fan-out only to active sessions                         |

### QA-P-03 — Checkout End-to-End Latency *[Implemented]*

| Element            | Description                                                                                                                                       |
|--------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Customer submits Place-Order request                                                                                                              |
| Stimulus Source    | Customer client                                                                                                                                    |
| Environment        | Normal load; payment method = COD                                                                                                                 |
| Artifact           | [PlaceOrderHandler](../../../src/module/ordering/order/commands/place-order.handler.ts); Drizzle transaction over `orders`, `order_items`, `order_status_logs` |
| Response           | Order persisted; `OrderPlacedEvent` dispatched; response returned                                                                                 |
| Response Measure   | p95 ≤ 3 s including ACL snapshot reads, promotion reservation, haversine validation, and DB commit                                                |
| Architectural Tactics | Single ACID transaction; idempotency short-circuit on Redis hit; haversine in-memory; ACL reads from local snapshot tables (no cross-BC RPC)      |

### QA-P-04 — Menu / Availability Update Propagation *[Partial]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Restaurant edits menu item price / availability                                                                          |
| Stimulus Source    | Restaurant management client                                                                                             |
| Environment        | Normal load                                                                                                              |
| Artifact           | Restaurant-catalog → publishes `MenuItemUpdatedEvent` ([menu-item-updated.event.ts](../../../src/shared/events/menu-item-updated.event.ts)); Ordering ACL projector |
| Response           | `ordering_menu_item_snapshots` updated; subsequent place-order uses fresh data                                           |
| Response Measure   | Propagation target ≤ 10 s; current same-process event dispatch is expected to complete substantially faster, but formal latency measurement is still pending |

---

## 3.2 Availability

### QA-A-01 — Authentication Endpoint Availability *[Partial]*

| Element            | Description                                                                                                                       |
|--------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Customer / partner submits sign-in or session validation                                                                          |
| Stimulus Source    | Any client                                                                                                                        |
| Environment        | Calendar month, normal + occasional partial outage                                                                                |
| Artifact           | Better Auth integration ([lib/auth.ts](../../../src/lib/auth.ts)); PostgreSQL session store                                       |
| Response           | Successful authentication when PostgreSQL/auth dependencies are available; failures surface as standard HTTP errors without relying on in-memory session state |
| Response Measure   | Availability target: 99.5 percent deployment objective for the authentication path; operational validation and resilience evidence are still pending |
| Architectural Tactics | Stateless app instances (planned horizontal scale); fail-fast at startup on config errors; restart-friendly Docker container       |

### QA-A-02 — Real-Time Channel Graceful Degradation *[Partial]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | WebSocket connection lost (network, server restart)                                                                      |
| Stimulus Source    | Customer / shipper / restaurant client                                                                                   |
| Environment        | Mobile network handover, degraded connectivity                                                                            |
| Artifact           | NotificationGateway plus REST NotificationController                                                                      |
| Response           | Backend supports recovery through the REST inbox at `/api/notifications/my`; mobile implements a notification socket and on-demand inbox fetch, while the defined unread-count polling hook is not wired and automatic order-detail polling is not implemented across clients |
| Response Measure   | In-app notifications are persisted with a 90-day `expiresAt`; reconnect re-joins the per-user room and new deliveries remain idempotent by notification key |
| Architectural Tactics | Durable notification store; idempotent `notification.id`; per-user room rejoin on reconnect                              |

### QA-A-03 — Optional Notification-Channel Degradation *[Implemented]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | SMTP or FCM unreachable / credentials absent                                                                             |
| Stimulus Source    | External provider outage                                                                                                 |
| Environment        | Provider degraded                                                                                                        |
| Artifact           | `EmailChannel`, `PushChannel` providers                                                                                  |
| Response           | Core flows (order placement, payment) continue; the affected notification channel logs failure to `notification_delivery_logs` |
| Response Measure   | Zero impact on order-state correctness; failed dispatches retried by future iteration (currently logged, not auto-retried) |

---

## 3.3 Reliability

### QA-R-01 — Order Placement Idempotency *[Implemented]*

| Element            | Description                                                                                                                                                          |
|--------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Client retries Place-Order request after timeout or unknown response                                                                                                  |
| Stimulus Source    | Customer client                                                                                                                                     |
| Environment        | Network instability                                                                                                                                                  |
| Artifact           | [PlaceOrderHandler](../../../src/module/ordering/order/commands/place-order.handler.ts); Redis `idempotency:order:{key}`; `orders.cart_id` UNIQUE constraint         |
| Response           | Identical `orderId` returned; no duplicate `orders` row; no double-charge                                                                                            |
| Response Measure   | Zero duplicate orders across retries with identical `X-Idempotency-Key` within `ORDER_IDEMPOTENCY_TTL_SECONDS` (fallback 300 s)                                      |
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

### QA-R-05 — Atomic Shipper Assignment *[Implemented]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Two shippers concurrently accept the same dispatch                                                                       |
| Stimulus Source    | Shipper mobile clients                                                                                                   |
| Environment        | Concurrent acceptance                                                                                                    |
| Artifact           | T-09 (`ready_for_pickup → picked_up`) in [TransitionOrderHandler](../../../src/module/ordering/order-lifecycle/commands/transition-order.handler.ts); `orders.version`; `orders.shipperId` |
| Response           | At most one shipper bound to the order; loser receives a typed conflict response                                         |
| Response Measure   | Logical guarantee: at most one shipper assignment per successful optimistic-lock commit on the same order row; concurrent validation remains operational work |
| Architectural Tactics | Shipper self-assignment occurs inside the same optimistic-lock status update that advances T-09; losing concurrent requests receive `ConflictException` |

### QA-R-06 — Payment Timeout Recovery *[Implemented]*

| Element            | Description                                                                                                                                                                     |
|--------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | A payment transaction remains in `pending` or `awaiting_ipn` state beyond the configured `expiresAt` deadline                                                                   |
| Stimulus Source    | Customer inactivity, gateway delay, or payment abandonment                                                                                                                      |
| Environment        | Normal scheduled execution (`@Cron(EVERY_MINUTE)`)                                                                                                                              |
| Artifact           | [PaymentTimeoutTask](../../../src/module/payment/tasks/payment-timeout.task.ts); `payment_transactions.expiresAt`; `PaymentFailedEvent`                                          |
| Response           | Expired transaction transitioned to `failed` via optimistic lock; `PaymentFailedEvent` published; Ordering BC handler auto-cancels the order through the CQRS path              |
| Response Measure   | Expired transactions are selected by the every-minute sweeper; optimistic locking prevents duplicate state changes, but multi-pod duplicate-event behavior requires deployment validation |
| Architectural Tactics | Scheduled sweeper with optimistic-lock concurrency guard; event-driven cancellation cascade; terminal-state protection prevents double-processing                             |

### QA-R-07 — Restaurant Acceptance Timeout *[Implemented]*

| Element            | Description                                                                                                                                                                     |
|--------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | A restaurant does not accept or reject an order within the configured acceptance window                                                                                         |
| Stimulus Source    | Restaurant operator inaction                                                                                                                                                    |
| Environment        | Normal scheduled execution (`@Cron(EVERY_MINUTE)`)                                                                                                                              |
| Artifact           | [OrderTimeoutTask](../../../src/module/ordering/order-lifecycle/tasks/order-timeout.task.ts); `RESTAURANT_ACCEPT_TIMEOUT_SECONDS` (from `app_settings`); `TransitionOrderCommand` |
| Response           | Order auto-cancelled via the same CQRS `TransitionOrderCommand` path used by all actors; T-05 fires for paid orders triggering the refund event automatically                   |
| Response Measure   | Eligible expired orders are scanned every minute and routed through `TransitionOrderCommand`; stuck-order diagnostics / alerting remain planned                                    |
| Architectural Tactics | Scheduler scan; reuse of existing CQRS command path (no bespoke cancellation logic); acceptance window configurable at runtime via `app_settings` without redeployment        |

### QA-R-08 — Refund and Promotion Compensation Reliability *[Partial]*

| Element            | Description                                                                                                                                                                     |
|--------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | A VNPay-paid order is cancelled through a refund-triggering transition, or an order with a reserved promotion fails / is cancelled                                               |
| Stimulus Source    | Ordering BC emits `OrderCancelledAfterPaymentEvent` or `OrderStatusChangedEvent(cancelled/refunded)`                                                                             |
| Environment        | Normal; VNPay Refund API stubbed in current implementation (production retry TBD)                                                                                               |
| Artifact           | [OrderCancelledAfterPaymentHandler](../../../src/module/payment/events/order-cancelled-after-payment.handler.ts); [PromotionRollbackOnCancellationHandler](../../../src/module/ordering/order-lifecycle/events/promotion-rollback-on-cancellation.handler.ts); [PromotionService](../../../src/module/promotion/services/promotion.service.ts) |
| Response           | Payment refund state is advanced in Payment BC; promotion reservations/usages are rolled back through the promotion port; failures are logged and do not roll back the already committed order state |
| Response Measure   | Order cancellation / failed checkout correctness is independent of refund or promotion-rollback outcome; real refund retry automation remains planned, while promotion counter rollback is implemented idempotently |
| Architectural Tactics | Event-driven async compensation; failure containment in payment/refund handlers; promotion rollback through `PROMOTION_APPLICATION_PORT` with idempotent counter decrements and usage status updates |

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
| Response Measure   | Invalid HMAC-SHA512 payloads are rejected before state mutation; penetration / negative security tests are recommended validation                                                    |
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
| Response           | 401 (no session) / 403 (insufficient role); unauthorized attempts observable through server/access logs; order lifecycle mutations write persistent audit rows |
| Response Measure   | Protected endpoints deny missing or mismatched roles before service-layer mutation                                                         |
| Architectural Tactics | Multi-role bitmap-equivalent (CSV) checked via OR-logic helper; Better Auth `admin()` plugin for admin scoping                           |


### QA-S-05 — Input Validation & Injection Resistance *[Implemented]*

| Element            | Description                                                                                                                  |
|--------------------|------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Client submits malformed DTO fields or HTML / JS payloads in catalog, cart, order, promotion, or notification requests        |
| Stimulus Source    | Authenticated or public client                                                                                                 |
| Environment        | Any                                                                                                                          |
| Artifact           | Global `ValidationPipe({ transform: true })` in [main.ts](../../../src/main.ts); class-validator DTOs                         |
| Response           | DTO validation rejects malformed payloads; Drizzle parameterization protects database access; stored review-text sanitization remains planned with UC-22 |
| Response Measure   | Invalid DTO payloads rejected before service-layer mutation; SQL injection prevented by Drizzle parameterized queries        |

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
| Stimulus           | Browse / search traffic and active notification sessions grow beyond the single-instance baseline during peak hour         |
| Stimulus Source    | Aggregate customer traffic and active WebSocket sessions                                                                     |
| Environment        | Peak hour                                                                                                                  |
| Artifact           | Stateless NestJS API instances behind a load balancer (planned deployment topology); PostgreSQL primary                     |
| Response           | Additional API instances can absorb stateless HTTP traffic; WebSocket fan-out requires sticky sessions or a Socket.IO Redis adapter before true multi-instance delivery correctness |
| Response Measure   | Architecture target: p95 search response ≤ 2 s for stateless HTTP traffic; formal load testing and per-instance CPU thresholds remain pending validation |
| Architectural Tactics | Stateless HTTP design (no in-memory session); Redis-shared cart, idempotency, and presence; database connection pooling; WebSocket room membership remains process-local in the current gateway |
| Constraint         | **In-process synchronous EventBus** assumes all participating modules live inside the same application instance. Replicated full-instance scaling behind a load balancer remains valid for the modular monolith, but separating publishers and listeners into different deployables would require an external broker before that topology is viable. |

### QA-SC-02 — Cart and Idempotency Storage Scaling *[Implemented]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | High concurrent cart mutation / order submission                                                                         |
| Stimulus Source    | Customer fleet                                                                                                           |
| Environment        | Peak                                                                                                                     |
| Artifact           | Redis service/instance accessed through an `ioredis` client with capped backoff retry                                      |
| Response           | Cart writes complete in O(1) per key; idempotency lookup is O(1)                                                         |
| Response Measure   | Target p95 cart operation ≤ 50 ms; benchmark validation remains operational work                                         |
| Architectural Tactics | Per-customer cart key; per-idempotency-key set with TTL; lazy-connect + capped exponential backoff retry                 |

---

## 3.6 Flexibility

### QA-FL-01 — Generalizing Payment Provider Integration *[Partial]*

| Element            | Description                                                                                                                                |
|--------------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Add a non-VNPay payment provider (e.g., MoMo, ZaloPay)                                                                                     |
| Stimulus Source    | Product roadmap                                                                                                                            |
| Environment        | Development                                                                                                                                |
| Artifact           | `IPaymentInitiationPort` ([payment-initiation.port.ts](../../../src/shared/ports/payment-initiation.port.ts)); Payment module               |
| Response           | Ordering is decoupled from the concrete Payment service, but the current port method is VNPay-specific (`initiateVNPayPayment`) and must be generalized before adding MoMo / ZaloPay without Ordering changes |
| Response Measure   | Current state: zero concrete Payment imports in `module/ordering`; target state: provider-neutral initiation contract and provider-selection tests |
| Architectural Tactics | Ports & Adapters boundary exists; provider strategy and payment-method-neutral port are planned                                            |

### QA-FL-02 — Adding a New Order Status *[Implemented]*

| Element            | Description                                                                                                                          |
|--------------------|--------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Add a new lifecycle status (e.g., `awaiting_courier`)                                                                                |
| Stimulus Source    | Operations roadmap                                                                                                                   |
| Environment        | Development                                                                                                                          |
| Artifact           | `order.schema.ts` enum; `TRANSITIONS` map; notification handlers                                                                  |
| Response           | New status added to enum, transition matrix, and audit log writer                                                                    |
| Response Measure   | Required changes are concentrated in the order enum, transition map, and notification mapping; transition-matrix tests are recommended validation |

### QA-FL-03 — Replacing a Notification Channel Provider *[Implemented]*

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
| Response Measure   | Conformance to VNPay spec is verifiable through sandbox/manual tests for signature, ordering, and encoding                         |

### QA-I-02 — Push Notification Multi-Channel Dispatch *[Implemented]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | NotificationService persists a notification row from a domain-event handler                                             |
| Stimulus Source    | Cross-BC event handlers                                                                                                  |
| Environment        | Customer in foreground / background / offline                                                                            |
| Artifact           | [ChannelDispatcherService](../../../src/module/notification/services/channel-dispatcher.service.ts); `InAppChannelService`, `EmailChannelService`, `PushChannelService` |
| Response           | Channels chosen by user preferences and presence; each channel delivers independently                                    |
| Response Measure   | Delivery attempts are recorded in `notification_delivery_logs`; provider success-rate targets require operational monitoring |

### QA-I-03 — Image Upload via Cloudinary *[Implemented]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Restaurant uploads a menu-item image                                                                                     |
| Stimulus Source    | Restaurant management client                                                                                             |
| Environment        | Normal                                                                                                                   |
| Artifact           | [Cloudinary provider](../../../src/module/image/cloudinary.provider.ts); signed upload                                   |
| Response           | Image uploaded to Cloudinary; URL persisted in `images` table                                                            |
| Response Measure   | Target upload latency p95 ≤ 5 s for images ≤ 2 MB; actual latency depends on Cloudinary/network conditions               |

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
| Artifact           | NestJS `Logger`; handler-specific failure policies in `@EventsHandler` classes                                            |
| Response           | Error logged at ERROR level with context (`eventType`, `aggregateId`); notification and refund handlers absorb failures, while ACL projectors currently log and rethrow after failed snapshot writes |
| Response Measure   | Handler failures are logged with contextual IDs; ≤ 5 minute detection requires active log monitoring until APM is integrated |
| Gap                | No central log aggregation or correlation IDs in the implemented baseline; APM / OpenTelemetry is future work             |

### QA-SUP-03 — Stuck-Order Diagnostics *[Planned]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | An order remains in a non-terminal status beyond a configured threshold                                                  |
| Stimulus Source    | Scheduler                                                                                                                |
| Environment        | Production                                                                                                               |
| Artifact           | Future diagnostic task and admin monitoring surface; current `OrderTimeoutTask` only auto-cancels expired pending / paid orders |
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
| Response Measure   | Existing e2e/spec coverage exercises payment, order, cart, ACL, promotion, and notification paths; coverage thresholds are not formalized |
| Architectural Tactics | Provider abstractions allow `NoopEmailProvider` / `StubPushProvider` in tests; injectable `RedisService` permits mocking |


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
| Response Measure   | Deterministic backend ordering is implemented; user task-completion metrics remain a client usability-test target         |

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
| Response Measure   | Zero parallel status vocabularies across implemented modules; contract tests for the allowed set are recommended validation |

### QA-CI-02 — Event Envelope Consistency *[Implemented]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | A new domain event is introduced                                                                                         |
| Stimulus Source    | Developer                                                                                                                |
| Environment        | Development                                                                                                              |
| Artifact           | [shared/events](../../../src/shared/events) — all events are immutable POJOs with explicit constructors                  |
| Response           | New event follows the same shape and is exported through the barrel `index.ts`                                           |
| Response Measure   | Code review currently enforces event-shape consistency; automated lint/fitness rules are planned                         |

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
| 1 | Authentication & Account Management | **Sign Up** (UC-1) | Customers, restaurant owners, and delivery personnel create platform accounts through Better Auth. New users default to the `user` role; restaurant ownership and shipper eligibility are handled by separate partner flows rather than by self-service role escalation. | **Security:**<br>- Password hashing via scrypt (Better Auth defaults); `BETTER_AUTH_SECRET` ≥ 32 chars enforced at startup by Zod `env.schema.ts` — app refuses to start on violation<br>- Global `ValidationPipe` + class-validator DTOs; Drizzle parameterized queries prevent SQL injection<br>- HTTPS enforced at reverse-proxy layer in production<br>**Reliability:**<br>- `UNIQUE(email)` on `users` table prevents duplicate accounts<br>**Performance:**<br>- Account creation API response p95 ≤ 2 s<br>**Interoperability:**<br>- `expo()` plugin supports Expo deep-link OAuth callbacks; `phoneNumber()` plugin provides the integration point for SMS-based OTP delivery<br>**Auditability:**<br>- Registration attempt, outcome, and timestamp captured in centralized audit logs | [Implemented] |
| 2 | | **Sign In** (UC-1) | Users provide email and password to authenticate and receive a bearer session token authorising all subsequent API requests, validated server-side on every call. | **Security:**<br>- Constant-time credential comparison (Better Auth internals); session tokens ≥ 128-bit entropy persisted in `session` table<br>- Bearer plugin validates `Authorization: Bearer <token>` on every request<br>- Brute-force protection via edge-proxy throttling or module-level throttling controls (QA-S-06)<br>**Reliability:**<br>- Session validation is stateless per-request; expired or revoked token rejected immediately without cache delay<br>**Performance:**<br>- Login API response p95 ≤ 1 s<br>**Auditability:**<br>- Failed login attempts observable via structured access logs | [Implemented] |
| 3 | | **Forgot Password / Reset Password** (UC-1) | Users who cannot sign in supply a registered email or phone; the system delivers a time-limited OTP. After successful verification the user sets a new password and all prior sessions are invalidated. | **Security:**<br>- OTP is time-limited, single-use, and invalidated after first successful verification<br>- Reset submission over HTTPS only; phone OTP delivery uses the `phoneNumber()` plugin interface to integrate SMS providers<br>- Reset endpoint does not disclose account existence (prevents account enumeration)<br>**Availability:**<br>- Email provider has Noop fallback when SMTP is unreachable — core platform flows unaffected<br>**Performance:**<br>- Password update API response p95 ≤ 2 s; OTP email delivered within 30–60 s<br>**Auditability:**<br>- Reset request, OTP delivery status, and outcome (success / failure) logged with timestamp | [Partial] |
| 4 | | **Role-Based Access Control** | Protected endpoints authorize by the Better Auth role vocabulary (`admin`, `restaurant`, `shipper`, `user`). Lifecycle audit logs use `customer` as the order-actor label for the default consumer role. A user may hold multiple roles simultaneously (e.g., `user,restaurant`). | **Security:**<br>- `user.role` stores a comma-separated multi-role value; `hasRole()` in [`role.util.ts`](../../../src/module/auth/role.util.ts) applies OR-logic — caller passes if any assigned role matches<br>- Better Auth `admin()` plugin scopes admin-only endpoints; protected handlers deny unauthorized requests before service-layer mutation<br>**Conceptual Integrity:**<br>- `APP_ROLES = ['admin','restaurant','shipper','user']` constant in [`lib/auth.ts`](../../../src/lib/auth.ts) is the single Better Auth role vocabulary; `order_status_logs.triggeredByRole` separately records order actors (`customer`, `restaurant`, `shipper`, `admin`, `system`)<br>**Auditability:**<br>- Unauthorized attempts surface as 401 (no session) / 403 (insufficient role) in structured access logs | [Implemented] |

---

## 4.2 Foundation & Customer Ordering Core (UC-2 – UC-9)

| No. | Domain | Function | Description | Architectural Requirements | Note |
|-----|--------|----------|-------------|----------------------------|------|
| 1 | Foundation & Customer Ordering Core | **Discover Restaurants & Food** (UC-2) | Customers search for restaurants and menu items by keyword, location, or category. The system returns a paginated list of approved restaurants that are open for ordering. | **Performance:**<br>- p95 ≤ 2 s for first results page; paginated ≤ 20 items by default; public search filters `restaurants.isApproved = true` and `restaurants.isOpen = true` in `restaurant-catalog/search`<br>**Scalability:**<br>- Read-heavy path served by stateless API instances; Redis Cache-Aside supports hot-query acceleration at peak load<br>**Security:**<br>- Drizzle parameterized queries prevent SQL injection; `ValidationPipe` sanitizes all input; no ownerId or approval internals exposed in public results<br>**Interoperability:**<br>- Public browse/search reads Restaurant Catalog source tables directly; Ordering ACL snapshots are used by checkout and lifecycle ownership checks, not by the public search repository | [Implemented] |
| 2 | | **View Restaurant Details** (UC-3) | Customers view a restaurant's profile: menu categories, items, modifier groups, pricing, operating hours/open state, delivery zone coverage, and rating/review information. | **Performance:**<br>- Detail page API response p95 ≤ 2 s<br>**Interoperability:**<br>- Restaurant detail and menu reads are owned by Restaurant Catalog; separate events maintain Ordering ACL snapshots for checkout validation, not for public detail rendering<br>**Conceptual Integrity:**<br>- Rating and review information is incorporated into the restaurant detail model without introducing a parallel catalog representation | [Implemented] |
| 3 | | **Add Item to Cart** (UC-4) | Customers add a menu item with modifier choices to their cart. The system validates item availability and enforces the single-restaurant constraint (BR-2). Mixing items from different restaurants is rejected. | **Security:**<br>- Cart key scoped per authenticated `customerId` (`cart:{customerId}`); unauthenticated access rejected<br>**Performance:**<br>- Cart write p95 ≤ 50 ms (Redis O(1) per-customer-key operation)<br>**Reliability:**<br>- BR-2 single-restaurant constraint enforced in `CartService` before Redis write — returns `CART_RESTAURANT_CONFLICT` on mismatch; existing cart unchanged<br>- Cart data is persisted with a sliding Redis TTL from `CART_ABANDONED_TTL_SECONDS` (default 86 400 s); abandoned carts are evicted by Redis TTL rather than a background sweeper | [Implemented] |
| 4 | | **Manage Shopping Cart** (UC-5) | Customers view cart contents, update item quantities, remove individual items, or clear the cart before proceeding to checkout. | **Reliability:**<br>- Cart mutations are atomic per Redis key; checkout lock (`cart:{customerId}:lock`, `SET NX EX 30`) prevents concurrent order submissions for the same cart<br>**Usability:**<br>- Full cart payload returned on every mutation response — no separate refresh call required<br>**Security:**<br>- All cart operations require authenticated session; operations scoped to the caller's own cart key only | [Implemented] |
| 5 | | **Manage Delivery Zones** (UC-7) | Restaurant owners define geographic delivery coverage: radius, base fee, per-km rate, preparation time, and delivery buffer. Administrators may manage zones for any restaurant. | **Interoperability:**<br>- Every zone change publishes `DeliveryZoneSnapshotUpdatedEvent`; Ordering ACL projector upserts `ordering_delivery_zone_snapshots` — UC-8 reads exclusively from this snapshot for fee computation and ETA, never crossing BC boundaries directly<br>**Reliability:**<br>- Zone snapshot upsert is idempotent (`ON CONFLICT DO UPDATE`); UC-8 always reads a consistent view even on event replay<br>**Performance:**<br>- Zone change propagated to checkout within ≤ 10 s (synchronous in-process event)<br>**Security:**<br>- Restricted to restaurant role (own restaurant only) or admin role; ownership verified in service layer<br>**Conceptual Integrity:**<br>- Single `GeoService` (Haversine) used for all distance computations across the system — no duplicated geo logic | [Implemented] |
| 6 | | **Place Order** (UC-8) | Customers submit their cart as a confirmed order, providing delivery address, optional notes, and payment method (COD or VNPay). The system validates delivery radius, applies any active promotion, captures a frozen pricing snapshot, and persists the order atomically. For VNPay, a payment redirect URL is returned immediately. | **Reliability:**<br>- Single Drizzle ACID transaction over `orders`, `order_items`, `order_status_logs`; `OrderPlacedEvent` emitted **after** commit only — no phantom events on rollback<br>- Dual-layer idempotency: Redis key `idempotency:order:{key}` (TTL = `ORDER_IDEMPOTENCY_TTL_SECONDS`) as fast-path short-circuit **plus** DB `UNIQUE(cart_id)` as backstop — zero duplicate orders on any client retry<br>- Checkout lock (`cart:{customerId}:lock`, `SET NX EX 30`) prevents concurrent submissions for the same cart<br>- Each `order_items` row captures `unit_price`, `modifiers_price`, item name, and `subtotal` from ACL snapshot at order time — immune to subsequent catalog edits<br>**Performance:**<br>- End-to-end p95 ≤ 3 s including all ACL reads, Haversine validation, promotion reservation, and DB commit<br>**Security:**<br>- `X-Idempotency-Key` header validated and scoped to the authenticated `customerId` session token<br>**Auditability:**<br>- Initial `order_status_logs` entry created at placement with `fromStatus = NULL` (origin entry) | [Implemented] |
| 7 | | **Make Online Payment — VNPay** (UC-9) | Customers are redirected to VNPay's hosted payment page to complete payment. VNPay notifies the backend via a server-to-server IPN callback, driving the order to `paid` on success or triggering cancellation on failure or timeout. | **Security:**<br>- Redirect URL signed with HMAC-SHA512 over canonically ordered `vnp_*` params; `VNPAY_HASH_SECRET` never logged or surfaced in API responses<br>- IPN signature verified with `crypto.timingSafeEqual` (constant-time comparison) before any state mutation<br>**Reliability:**<br>- IPN handler short-circuits on terminal-state detection — duplicate VNPay retries produce no state change<br>- Optimistic lock (`payment_transactions.version`) prevents concurrent mutations; `UNIQUE(provider_txn_id)` is the DB backstop<br>- Payment amount validated against the stored transaction amount (BR-P4) before confirming<br>- Pending transactions auto-expired after `PAYMENT_SESSION_TIMEOUT_SECONDS` (env var, default 1 800 s) by `PaymentTimeoutTask` (`@Cron(EVERY_MINUTE)`); emits `PaymentFailedEvent` → drives order cancellation<br>**Interoperability:**<br>- Strict conformance to VNPay specification: canonical parameter ordering, percent-encoding, VND-only currency, sandbox / live base-URL switch via env var<br>**Auditability:**<br>- `payment_transactions` records `status`, `amount`, `providerTxnId`, `expiresAt`, and `version` for every lifecycle change | [Implemented] |

---

## 4.3 Restaurant & Delivery Operations (UC-11 – UC-19)

| No. | Domain | Function | Description | Architectural Requirements | Note |
|-----|--------|----------|-------------|----------------------------|------|
| 1 | Restaurant & Delivery Operations | **Restaurant Registration & Profile Management** (UC-11) | Restaurant owners register their business and manage their profile. New restaurants default to `isApproved = false` and `isOpen = false`; administrators can approve or unapprove the restaurant. Approved profile updates propagate to dependent bounded contexts. | **Security:**<br>- Restaurant role required for profile management; admin role required for approve / unapprove endpoints<br>**Reliability:**<br>- Approval uses `isApproved` and `isOpen` controls so only approved restaurants participate in public discovery and checkout<br>**Interoperability:**<br>- Create / update / approve / unapprove publishes `RestaurantUpdatedEvent`; Ordering ACL projector refreshes `ordering_restaurant_snapshots`; Notification ACL projector refreshes `notification_restaurant_snapshots` in-process<br>**Manageability:**<br>- Approval takes effect immediately in the source DB and propagates synchronously to local ACL tables in the same process<br>**Auditability:**<br>- Restaurant approval decisions persist admin actor, decision reason, and old/new approval state in auditable logs | [Partial] |
| 2 | | **Manage Menu Catalog** (UC-12) | Restaurant owners create, update, and remove menu categories, items, modifier groups, and modifier options. Changes feed the checkout validation pipeline at the next order. | **Interoperability:**<br>- `MenuItemUpdatedEvent` published on create / update / sold-out changes; Ordering ACL projector upserts `ordering_menu_item_snapshots` so UC-8 validates against a local Ordering read model<br>- Images uploaded via Cloudinary signed upload; URL persisted in `images` table — image bytes never stored on backend<br>**Reliability:**<br>- ACL projectors are idempotent upserts (`ON CONFLICT DO UPDATE`); projection failures surface through operational logging and recovery handling<br>- Snapshot propagation target ≤ 10 s through same-process event dispatch<br>**Security:**<br>- Restaurant owner verified against `restaurantId` ownership in service layer — a restaurant can only manage its own catalog | [Implemented] |
| 3 | | **Toggle Item & Restaurant Availability** (UC-13) | Restaurant owners mark menu items as sold out or available, and open or close their restaurant for orders. Availability changes take effect at checkout within seconds. | **Interoperability:**<br>- `MenuItemUpdatedEvent` / `RestaurantUpdatedEvent` published synchronously on every toggle; Ordering ACL snapshots updated in-process — UC-4 rejects `out_of_stock` items; UC-8 rejects closed restaurants at checkout<br>**Performance:**<br>- Availability change visible to customers ≤ 10 s under peak load (synchronous in-process pipeline)<br>**Conceptual Integrity:**<br>- `isOpen` is the single authoritative flag for restaurant order-acceptance; `available` / `out_of_stock` is the canonical item-level flag — no parallel availability signals anywhere in the system<br>**Security:**<br>- Toggle restricted to authenticated restaurant owner; `restaurantId` ownership verified in service layer | [Implemented] |
| 4 | | **Accept or Reject Order** (UC-14) | Restaurant operators accept or reject incoming orders within the configured window (default 600 s from `RESTAURANT_ACCEPT_TIMEOUT_SECONDS`). Rejection requires a reason note. Post-VNPay-payment rejection triggers the refund pipeline. | **Reliability:**<br>- Closed TRANSITIONS map in [`constants/transitions.ts`](../../../src/module/ordering/order-lifecycle/constants/transitions.ts) enforces T-01 (`pending → confirmed`), T-03 (`pending → cancelled`), T-04 (`paid → confirmed`), T-05 (`paid → cancelled`) — invalid transitions rejected with HTTP 422<br>- Optimistic lock (`orders.version`) prevents concurrent double-accept or race conditions<br>- Auto-cancellation by `OrderTimeoutTask` (`@Cron(EVERY_MINUTE)`) if restaurant does not respond within `RESTAURANT_ACCEPT_TIMEOUT_SECONDS`; dispatched via `TransitionOrderCommand` through the same CQRS path<br>**Security:**<br>- Restaurant role with `restaurantId` ownership verification required — operator cannot act on another restaurant's orders<br>**Auditability:**<br>- Transition recorded in `order_status_logs` with `triggeredBy` UUID, `triggeredByRole`, `note`, and `createdAt` | [Implemented] |
| 5 | | **Prepare Order for Pickup** (UC-15) | Restaurant staff mark an accepted order as preparing and then ready for pickup. The system records the lifecycle transition and emits pickup-ready/status events for downstream consumers. | **Reliability:**<br>- T-06 (`confirmed → preparing`) and T-08 (`preparing → ready_for_pickup`) both routed through `TransitionOrderCommand`; idempotent via optimistic lock — duplicate submissions produce a conflict response, not a duplicate event<br>- T-08 publishes `OrderReadyForPickupEvent` after commit and `OrderStatusChangedEvent`, supporting customer pickup-ready notifications and shipper dispatch workflows<br>**Performance:**<br>- Customer status notification delivered ≤ 5 s p95 via WebSocket / FCM<br>**Security:**<br>- Restaurant role with `restaurantId` ownership check required for this transition<br>**Auditability:**<br>- Transition recorded in `order_status_logs` with actor, role, and timestamp | [Implemented] |
| 6 | | **Shipper Registration** (UC-16) | Delivery personnel complete a shipper onboarding workflow under BR-1 and receive shipper eligibility after approval so delivery endpoints operate under an authenticated `shipper` role. | **Security:**<br>- Shipper onboarding uses an application and approval workflow so role assignment occurs only after approved eligibility review<br>**Reliability:**<br>- Application persistence, approval state machine, document review, and approval event coordinate onboarding and activation of delivery capabilities<br>**Auditability:**<br>- Approval decisions preserve audit history including actor, timestamp, submitted documents, and decision metadata | [Planned] |
| 7 | | **Accept Delivery Assignment** (UC-18) | Shippers view `ready_for_pickup` orders and claim one by advancing T-09 (`ready_for_pickup → picked_up`), with dispatch offers filtered by online availability and proximity. | **Reliability:**<br>- At-most-one assignment enforced by the same optimistic-lock status update that sets `orders.shipperId` during T-09; concurrent losers receive a conflict response<br>**Performance:**<br>- `OrderReadyForPickupEvent` and notification fan-out provide the pickup-ready signal; dispatch selection incorporates proximity and availability criteria<br>**Security:**<br>- Shipper role required; state machine ensures only `ready_for_pickup` orders can be claimed | [Partial] |
| 8 | | **Deliver Order** (UC-19) | Shippers advance a claimed order through pickup, en-route, and delivered states. Upon delivery, the flow finalizes and notifies the customer. | **Reliability:**<br>- T-10 (`picked_up → delivering`) and T-11 (`delivering → delivered`) both routed through `TransitionOrderCommand`; idempotent via optimistic lock — duplicate submissions produce a conflict, not a second event<br>**Performance:**<br>- Delivered status visible to customer ≤ 5 s p95 via WebSocket / FCM<br>**Security:**<br>- Only the shipper whose UUID matches `orders.shipperId` may execute T-10/T-11; unauthorized attempts return HTTP 403<br>**Auditability:**<br>- Delivery timestamp, shipper actor UUID, and role recorded in `order_status_logs` | [Implemented] |

---

## 4.4 Customer Interaction, Promotion & Notification (UC-20 – UC-26)

| No. | Domain | Function | Description | Architectural Requirements | Note |
|-----|--------|----------|-------------|----------------------------|------|
| 1 | Customer Interaction, Promotion & Notification | **Track Order Status** (UC-20) | Customers monitor the progression of their active order through pushed status updates, durable notification history, and order-detail refresh paths. | **Performance:**<br>- Status update delivered ≤ 5 s p95 target: `TransitionOrderCommand` commit → `OrderStatusChangedEvent` dispatch → persisted notification → WebSocket emit to `room:user:{userId}`; client channels refresh visible order state from notification-driven updates<br>**Availability:**<br>- Backend supports recovery through REST notification inbox reads, reconnecting notification sockets, unread-count refresh, and order-detail refresh flows across clients after disconnect<br>**Reliability:**<br>- `OrderStatusChangedEvent` emitted only after successful DB commit — no phantom events on transaction rollback<br>- Redis presence ref-count (`ws:connections:{userId}`) + per-socket expiry timer cleared in `handleDisconnect` — prevents WebSocket connection resource leaks<br>**Security:**<br>- Socket.IO connection authenticated server-side via bearer token (userId resolved at connect); per-user rooms (`room:user:{userId}`) prevent cross-user notification observation<br>- Customer-scoped order detail and timeline reads enforce ownership before returning data | [Partial] |
| 2 | | **Cancel Order** (UC-21) | Customers cancel an active order before pickup. Pre-payment (COD) cancellations transition directly to `cancelled`; post-VNPay-payment cancellations additionally trigger the refund pipeline. | **Reliability:**<br>- T-03 (`pending → cancelled`) for COD; T-05 (`paid → cancelled`) for VNPay — both routed through `TransitionOrderCommand` — same closed state machine applies to all actors<br>- Post-payment cancellation publishes `OrderCancelledAfterPaymentEvent`; refund handler failure (UC-25) is isolated and never rolls back the cancellation<br>**Security:**<br>- `orders.customerId` ownership enforced at service layer; HTTP 404 returned for non-owned orders (prevents order-existence enumeration)<br>**Auditability:**<br>- Recorded in `order_status_logs` with `triggeredByRole = 'customer'`, `note`, and `createdAt` | [Implemented] |
| 3 | | **Submit Rating & Review** (UC-22) | Customers submit ratings and reviews for delivered orders. Review persistence, moderation, and rating-propagation events feed restaurant detail and feedback workflows. | **Reliability:**<br>- One review is allowed per delivered order per customer<br>**Security:**<br>- An authenticated customer may review only their own delivered order<br>**Conceptual Integrity:**<br>- Reviews reference orders by UUID and use the existing `orderStatusEnum` `delivered` state as the eligibility gate<br>**Supportability:**<br>- Moderation preserves review history rather than hard-deleting records | [Planned] |
| 4 | | **Manage Restaurant Promotions** (UC-23) | Restaurant owners create, configure, activate, pause, and deactivate promotions (percentage / flat discounts, optional coupon codes, usage caps, validity windows) scoped to their restaurant. | **Reliability:**<br>- 4-phase reservation at checkout: `preview` (read-only eligibility) → `computeAndReserve` (atomic counter increment + reservation row) → `confirm` (on order success) → `rollback` (compensating write on failure) — discount never applied to a failed order<br>**Flexibility:**<br>- `IPromotionApplicationPort` (DIP token `PROMOTION_APPLICATION_PORT`) decouples Ordering BC from all Promotion BC internals — zero concrete Promotion imports in `module/ordering`<br>**Security:**<br>- Restaurant owner scoped to own `restaurantId`; ownership enforced in service layer<br>**Conceptual Integrity:**<br>- Promotion state machine (`draft → active → paused → expired`) enforced at service layer; disallowed transitions return HTTP 422 | [Implemented] |
| 5 | | **Manage Platform Promotions** (UC-24) | Platform administrators create and manage platform-wide promotions and generate coupon-code batches, targeting all restaurants or a specific one. | **Security:**<br>- Admin role required for all platform-scope operations; platform vs restaurant scope constraints validated in service code<br>**Reliability:**<br>- `UNIQUE(code)` at DB level; duplicate code raises `ConflictException` immediately — no silent retry or skip<br>**Conceptual Integrity:**<br>- Same Promotion schema and status rules as UC-23 — no separate admin-only promotion aggregate<br>**Supportability:**<br>- Promotion administration records persistent actor UUID audit trails for platform-scope operations | [Implemented] |
| 6 | | **Process Payment Refund** (UC-25) | When a VNPay-paid order is cancelled, Payment BC handles refund compensation asynchronously without blocking the committed order cancellation, including the external refund interaction with VNPay. | **Reliability:**<br>- `OrderCancelledAfterPaymentHandler` in Payment BC transitions `payment_transactions` from `completed` to `refund_pending` to `refunded` using optimistic locking; handler exception swallowed and logged — cancellation is never rolled back due to refund failure<br>**Conceptual Integrity:**<br>- Payment BC is the sole component responsible for VNPay financial state; Ordering BC only publishes the domain event — no direct VNPay API calls from `module/ordering`<br>**Interoperability:**<br>- VNPay refund API interaction and retry handling are encapsulated in Payment BC and emit customer `order_cancelled` / `refund_initiated` notifications through Notification BC<br>**Auditability:**<br>- Refund state transitions recorded in `payment_transactions`; customer notifications persisted in Notification BC | [Partial] |
| 7 | | **Manage Real-Time Notifications** (UC-26) | Users receive in-app, FCM push, and email notifications for order and payment events. Users view their inbox, mark messages as read, and manage device tokens for push delivery. | **Interoperability:**<br>- Multi-channel dispatch via [`ChannelDispatcherService`](../../../src/module/notification/services/channel-dispatcher.service.ts); provider abstractions (`EmailProvider`, `PushProvider`) with Noop / Stub fallback — order and payment flows never blocked by notification failures<br>**Availability:**<br>- Provider failure isolated per channel; core flows (order placement, payment IPN) entirely unaffected by notification errors<br>**Performance:**<br>- In-app notification via WebSocket ≤ 5 s p95 target; FCM and email dispatched asynchronously<br>**Reliability:**<br>- `notifications` table provides durable inbox; survives WebSocket disconnection; in-app rows are assigned a 90-day `expiresAt`<br>- Push device tokens cleaned up by `DeviceTokenCleanupTask` on stale registrations<br>**Security:**<br>- Socket.IO connection authenticated at connect via bearer token; push tokens registered per user-device pair<br>**Supportability:**<br>- Every dispatch attempt logged in `notification_delivery_logs` with channel, outcome, and error detail for failed attempts | [Implemented] |

---

## 4.5 Administration & Governance (UC-27 – UC-35)

| No. | Domain | Function | Description | Architectural Requirements | Note |
|-----|--------|----------|-------------|----------------------------|------|
| 1 | Administration & Governance | **Approve or Reject Restaurant Applications** (UC-27) | Administrators approve or unapprove restaurant registrations through boolean `isApproved`. Approved and open restaurants become visible in public catalog; ACL snapshots are refreshed in dependent BCs. | **Security:**<br>- Admin role required; approval restricted to authenticated admin session<br>**Interoperability:**<br>- Approval/unapproval publishes `RestaurantUpdatedEvent`; Ordering and Notification ACL snapshots refresh through the shared in-process integration pipeline<br>**Manageability:**<br>- Decision takes effect immediately in the source table and the administrative approval workflow<br>**Auditability:**<br>- Decision reason, admin actor UUID, and old/new approval state persist in approval audit records | [Partial] |
| 2 | | **Approve or Reject Shipper Applications** (UC-28) | Administrators review shipper applications through an approval queue that drives role elevation, onboarding, and decision audit. | **Security:**<br>- `shipper` role elevation is admin-only and non-self-service<br>**Reliability:**<br>- An application state machine prevents re-deciding approved or rejected submissions<br>**Auditability:**<br>- Decision history records admin actor, target applicant, reason, and timestamp | [Planned] |
| 3 | | **Suspend or Reactivate Partner Accounts** (UC-29) | Administrators suspend or reactivate partner accounts. Suspension coordinates Better Auth user status, restaurant approval, shipper eligibility, and operational access. | **Security:**<br>- Suspension and reactivation are exposed only through admin-authorized controls<br>**Reliability:**<br>- Suspension rules define effects on `restaurants.isApproved`, shipper eligibility, and in-flight orders explicitly<br>**Auditability:**<br>- Suspension and reactivation history records admin actor, target account, reason, action, and effective timestamp | [Planned] |
| 4 | | **Monitor Orders and Platform Health** (UC-30) | Administrators view a filtered, paginated list of all platform orders across all restaurants together with platform-health KPIs, anomaly flags, and stuck-order diagnostics. | **Performance:**<br>- Query p95 target ≤ 2 s; paginated query layer uses dynamic filters and aggregate subqueries to avoid N+1 list reads<br>**Security:**<br>- Admin role required; all restaurants' orders visible (unlike restaurant-scoped views)<br>**Manageability:**<br>- Filters: `status`, `restaurantId`, `customerId`, `shipperId`, `paymentMethod`, date range; sort: `created_at`, `updated_at`, `total_amount`<br>**Scalability:**<br>- Read-replica or pre-aggregated monitoring views support high-volume monitoring | [Partial] |
| 5 | | **Administrative Order Cancellation & Refund** (UC-32) | Administrators cancel permitted in-progress orders regardless of ownership and can trigger the post-delivery refund transition. VNPay refund compensation is handled by Payment BC through the shared refund event pipeline. | **Security:**<br>- Admin authority encoded in `allowedRoles` entries in the TRANSITIONS map — bypasses customer / restaurant ownership gate without a separate codepath<br>**Reliability:**<br>- Cancellation/refund routed through `TransitionOrderCommand` — same closed TRANSITIONS map as all actors; no state-machine bypass for admin<br>- Post-payment cancellation publishes `OrderCancelledAfterPaymentEvent` for Payment BC compensation (UC-25)<br>**Conceptual Integrity:**<br>- No separate admin cancellation codepath — admin authority is a configuration in `allowedRoles`; single state machine applies to every actor<br>**Auditability:**<br>- Recorded in `order_status_logs` with `triggeredByRole = 'admin'`; mandatory reason note (`requireNote: true` in TRANSITIONS map entry) | [Implemented] |
| 6 | | **View and Export Operational Reports** (UC-33) | Administrators generate operational reports covering order volumes, GMV by restaurant, delivery performance, and promotion effectiveness, exportable as CSV / PDF. | **Performance:**<br>- Asynchronous generation for large date ranges; recent-period summaries p95 ≤ 5 s<br>**Security:**<br>- Admin role required; HTTPS transmission; PII minimized in exports to necessary identifiers<br>**Scalability:**<br>- Long-range reports leverage read-replica or pre-aggregated analytics snapshot tables<br>**Auditability:**<br>- Report access (actor, parameters, timestamp) logged | [Planned] |
| 7 | | **Manage Admin Roles & Permissions** (UC-35) | Administrators assign or revoke privileged roles through dedicated role-management controls with a last-admin safeguard and persistent role-change audit. | **Security:**<br>- Role assignment and revocation are admin-only and prevent self-service privilege escalation<br>- A last-admin safeguard prevents full system lockout<br>**Reliability:**<br>- Last-admin checks and role updates execute atomically<br>**Conceptual Integrity:**<br>- Role management reuses `user.role` plus `hasRole()` OR-logic as the authorization vocabulary<br>**Auditability:**<br>- Role-change audit records actor UUID, target UUID, old role value, new role value, and timestamp | [Planned] |

---

# 5. Architectural Constraints

| ID  | Constraint | Rationale | Implication |
|-----|------------|-----------|-------------|
| C-1 | **Modular Monolith** — single deployable | MVP scale; reduces operational complexity | All BCs live in one process; horizontal scaling = scale the whole app; cross-BC integration uses in-process EventBus + DIP ports |
| C-2 | **PostgreSQL single primary** | Strong transactional semantics needed for order placement & payment | Cross-BC consistency through ACID transactions inside one BC + in-process events between BCs; no distributed transactions |
| C-3 | **In-process synchronous EventBus** (no broker) | Operational simplicity for MVP | Replicated full-application instances are valid for scaling the modular monolith, but separating publishers and listeners into different deployables is not supported without first introducing an external broker — see QA-SC-01 |
| C-4 | **NestJS + Drizzle + Better Auth** | Selected by team; community-supported; type-safe | All modules use NestJS DI; schemas declared via Drizzle; auth routes auto-managed by Better Auth |
| C-5 | **Vietnamese market (VNPay only for MVP)** | Business requirement (BR-4) | VNPay-specific signature, currency in VND, integration adapter; no PCI scope (no card data stored) |
| C-6 | **HTTPS everywhere in production** | OWASP, payment integration | TLS termination at reverse proxy; not enforced inside the Node process |
| C-7 | **Single-region deployment** | Cost / scope for MVP | RTO / RPO and backup automation are not formalized; PostgreSQL-native backup is a deployment responsibility; multi-region failover is post-MVP |
| C-8 | **Mobile and web clients are separate apps** | Distinct UX | Shared OpenAPI / Better Auth contract; backend agnostic to client kind |
| C-9 | **TypeScript end-to-end** | Type-safety, monorepo turborepo | Shared types impossible across packages without explicit publication; current codebase keeps API types internal |
| C-10 | **Cloudinary for images** | Offload storage / CDN | Backend does not store image bytes |
| C-11 | **No personal financial data stored** | Reduces compliance burden | Only payment-gateway references stored in `payment_transactions`; no PAN / CVV |

---

# 6. Cross-Cutting Concerns

## 6.1 Idempotency

- **Order placement**: Redis key (`idempotency:order:{key}`) + DB `UNIQUE(cart_id)` (QA-R-01).
- **VNPay IPN**: terminal-state short-circuit + `UNIQUE(provider_txn_id)` + optimistic lock (QA-R-02).
- **ACL projections**: `ON CONFLICT DO UPDATE` upserts; safe to replay for menu, restaurant, delivery-zone, and notification restaurant snapshots (QA-MA-01 / QA-CI-02).
- **Promotion**: 4-phase reservation protocol with explicit rollback (UC-23 §4.4, row 4).

## 6.2 Event Handling Contract

- Notification and refund event handlers absorb exceptions after logging so provider/payment side effects do not roll back already-committed order state.
- ACL projectors are idempotent upserts but currently log and rethrow on failed snapshot writes; there is no broker/outbox retry in the MVP baseline.
- Side effects in handlers must be idempotent — handlers may be retried in future iterations.

## 6.3 Configuration

- All env vars validated at startup with Zod ([env.schema.ts](../../../src/config/env.schema.ts)) — **fail fast**.
- Secrets (Better Auth, VNPay hash, Cloudinary, SMTP) injected via env vars; never committed.
- Optional notification providers degrade to Noop / Stub when env vars are absent (Email, Push). Cloudinary credentials are mandatory for the image module and fail fast at startup when absent.

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

- Background jobs use `@nestjs/schedule` cron / interval triggers.
- Payment timeout sweeper ([payment-timeout.task.ts](../../../src/module/payment/tasks/payment-timeout.task.ts)) runs every minute; expires `payment_transactions` past `expiresAt` (set from `PAYMENT_SESSION_TIMEOUT_SECONDS` env var); publishes `PaymentFailedEvent`.
- Order timeout sweeper ([order-timeout.task.ts](../../../src/module/ordering/order-lifecycle/tasks/order-timeout.task.ts)) runs every minute; auto-cancels `orders` past `expiresAt` (set from `RESTAURANT_ACCEPT_TIMEOUT_SECONDS` app_setting, default 600 s); dispatches `TransitionOrderCommand` so T-03/T-05 run through the same CQRS path.
- Device-token cleanup ([device-token-cleanup.task.ts](../../../src/module/notification/tasks/device-token-cleanup.task.ts)).
- WebSocket connection metrics (`@Interval` in NotificationGateway) and client-driven heartbeat refresh of Redis presence TTL.
- State-changing timeout/cleanup tasks are designed to be idempotent; WebSocket metrics are observational only.

---

# 7. Traceability to Architecture

> **Scope**: This section traces architecturally significant Use Cases (§4) and Quality-Attribute scenarios (§3) to Architectural Drivers (§2), architectural decisions/tactics, and implementation evidence.
> Architectural Constraints (§5 — C-1 through C-11) are not included in these matrices; they are structural givens, not scenario mappings.
> Trace model: **UC ASR → QA Scenario → Architectural Driver → Decision / Tactic → Implementation Evidence**.

---

## 7.1 UC → QA Traceability Matrix

| UC | Functional Area | Related QA Scenario(s) | Why Related | Architectural Concern |
|----|-----------------|------------------------|-------------|----------------------|
| UC-1 (Sign Up / Sign In / Forgot / Reset / RBAC) | Authentication & Account Management | QA-S-02, QA-S-03, QA-A-01, QA-S-05, QA-S-06, QA-U-01 | Authentication is the session trust boundary; RBAC controls protected surfaces; dev identity middleware creates an open production risk until gated; public auth endpoints need validation, throttling, and usability latency targets | Identity, authorization, input safety, test safety |
| UC-2 (Discover Restaurants & Food) | Foundation & Customer Ordering Core | QA-P-01, QA-SC-01, QA-S-05, QA-U-02 | Public search is the primary read-heavy catalog path; it must be fast, paginated, deterministic, scalable as stateless HTTP traffic, and input-safe | Search latency, throughput, predictable discovery |
| UC-3 (View Restaurant Details) | Foundation & Customer Ordering Core | QA-P-01 | Detail reads are Catalog-owned and must meet the public detail latency target; checkout snapshot propagation is exercised by UC-7, UC-12, and UC-13 rather than by the read-only detail UC | Detail latency |
| UC-4 (Add Item to Cart) | Foundation & Customer Ordering Core | QA-R-04, QA-SC-02, QA-S-02 | Cart writes enforce BR-2 before Redis persistence; cart data is scoped per authenticated customer and must remain O(1) per key | Cart invariant, Redis scaling, session scoping |
| UC-5 (Manage Shopping Cart) | Foundation & Customer Ordering Core | QA-R-04, QA-SC-02, QA-S-02 | Cart mutation and checkout preparation share the same per-customer Redis key and authenticated ownership boundary | Cart consistency, concurrency, access control |
| UC-7 (Manage Delivery Zones) | Foundation & Customer Ordering Core | QA-MA-01, QA-S-03, QA-SUP-02, QA-CI-02 | Zone changes publish delivery-zone snapshot events that Ordering consumes at checkout; owner/admin authorization and event-handler observability are required | Data propagation, authorization, event consistency |
| UC-8 (Place Order) | Foundation & Customer Ordering Core | QA-R-01, QA-P-03, QA-S-02, QA-S-05, QA-FL-01, QA-SUP-01, QA-MA-01, QA-MA-02, QA-T-01, QA-CI-01, QA-CI-02 | Checkout is the highest-risk write path: Redis idempotency, DB unique backstop, ACID writes, promotion port, payment initiation port, audit origin entry, and event publication all converge here | Exactly-once creation, latency, audit, BC boundaries |
| UC-9 (Make Online Payment — VNPay) | Foundation & Customer Ordering Core | QA-S-01, QA-R-02, QA-R-06, QA-FL-01, QA-I-01, QA-MA-02, QA-CI-02 | VNPay URL creation and IPN handling require HMAC verification, idempotency, timeout recovery, schema evolution discipline, and a Payment boundary visible to Ordering only through a port | Payment integrity, gateway interoperability, recovery |
| UC-11 (Restaurant Registration & Profile) | Restaurant & Delivery Operations | QA-S-03, QA-MA-01, QA-SUP-02, QA-CI-02 | Restaurant create/update/approve/unapprove is admin/owner gated and publishes `RestaurantUpdatedEvent` to Ordering and Notification ACL snapshots | Partner gate, ACL propagation, event observability |
| UC-12 (Manage Menu Catalog) | Restaurant & Delivery Operations | QA-P-04, QA-MA-01, QA-I-03, QA-S-03, QA-SUP-02, QA-CI-02 | Menu mutations publish snapshot events for checkout and use Cloudinary for image offload; owner scoping protects catalog ownership | Catalog propagation, image integration, owner authorization |
| UC-13 (Toggle Item & Restaurant Availability) | Restaurant & Delivery Operations | QA-P-04, QA-MA-01, QA-S-03, QA-SUP-02, QA-CI-02 | Availability changes affect checkout eligibility via menu/restaurant snapshot events; `isOpen` and item status remain the implemented source flags | Availability freshness, BC isolation, authorization |
| UC-14 (Accept or Reject Order) | Restaurant & Delivery Operations | QA-R-03, QA-R-07, QA-R-08, QA-P-02, QA-S-03, QA-SUP-01, QA-CI-01 | Restaurant lifecycle decisions use the closed transition map, ownership checks, optimistic locking, timeout auto-cancel, refund-triggering events, notifications, and audit logs | State integrity, timeout recovery, audit, notification |
| UC-15 (Prepare Order for Pickup) | Restaurant & Delivery Operations | QA-R-03, QA-P-02, QA-FL-02, QA-S-03, QA-SUP-01, QA-CI-01, QA-CI-02 | T-06/T-08 are state-machine transitions; T-08 emits status/pickup-ready events and must be audited and authorized | State integrity, pickup readiness, customer notification |
| UC-16 (Shipper Registration) | Restaurant & Delivery Operations | QA-S-03 | Current code has no shipper application workflow; planned onboarding pressure is admin-only role elevation without self-service escalation | Planned partner authorization gate |
| UC-18 (Accept Delivery Assignment) | Restaurant & Delivery Operations | QA-R-03, QA-R-05, QA-P-02, QA-FL-02, QA-S-03, QA-SUP-01, QA-CI-01 | T-09 self-assigns `shipperId` through optimistic locking, preventing dual pickup; online/proximity dispatch remains partial/planned | Assignment atomicity, status integrity, authorization |
| UC-19 (Deliver Order) | Restaurant & Delivery Operations | QA-R-03, QA-P-02, QA-FL-02, QA-S-03, QA-SUP-01, QA-CI-01 | T-10/T-11 require the assigned shipper, update status through the common transition handler, notify customers, and append audit logs | Delivery state integrity, notification, audit |
| UC-20 (Track Order Status) | Customer Interaction, Promotion & Notification | QA-P-02, QA-A-02, QA-S-02, QA-I-02, QA-CI-01 | Tracking consumes committed status events through Notification; durable inbox and mobile on-demand inbox fetch provide recovery paths, while automatic order-detail polling is not implemented across clients and the shared order-status vocabulary controls what customers can observe | Real-time visibility, durable fallback, authenticated status delivery |
| UC-21 (Cancel Order) | Customer Interaction, Promotion & Notification | QA-R-03, QA-R-08, QA-FL-02, QA-S-02, QA-SUP-01, QA-CI-01, QA-CI-02 | Customer cancellation uses the same state machine and audit log; VNPay-paid cancellation emits the refund compensation event without rolling back the order commit | Cancellation integrity, compensation, audit |
| UC-22 (Submit Rating & Review) | Customer Interaction, Promotion & Notification | QA-S-02, QA-S-05 | Review is planned; future implementation must authenticate the customer, validate text input, and gate eligibility on the shared `delivered` order status | Planned review security and status gate |
| UC-23 (Manage Restaurant Promotions) | Customer Interaction, Promotion & Notification | QA-R-08, QA-MA-01, QA-S-03 | Restaurant promotion management is owner-scoped and supplies the promotion port consumed by checkout; reservation confirmation and rollback are compensating reliability behavior when order placement fails or an order is cancelled | Promotion boundary, owner authorization, compensation rollback |
| UC-24 (Manage Platform Promotions) | Customer Interaction, Promotion & Notification | QA-S-03 | Admin promotion management uses the same Promotion schema/state rules as restaurant promotions while enforcing admin-only access and global coupon uniqueness | Admin authorization, promotion consistency |
| UC-25 (Process Payment Refund) | Customer Interaction, Promotion & Notification | QA-R-08, QA-I-01, QA-MA-01, QA-SUP-02, QA-CI-02 | Refund compensation is isolated in Payment BC; the real VNPay refund API is stubbed, but payment state transitions and customer refund notifications are implemented | Compensation isolation, gateway boundary, event handling |
| UC-26 (Manage Real-Time Notifications) | Customer Interaction, Promotion & Notification | QA-I-02, QA-A-02, QA-A-03, QA-P-02, QA-FL-03, QA-S-02, QA-SUP-02, QA-CI-02 | Notification owns durable inbox, WebSocket fan-out, user preferences, provider fallbacks, delivery logs, and channel adapters | Multi-channel dispatch, degradation, observability, scale caveat |
| UC-27 (Approve or Reject Restaurant Applications) | Administration & Governance | QA-S-03, QA-MA-01, QA-SUP-02, QA-CI-02 | Admin approval/unapproval updates Restaurant Catalog and propagates `RestaurantUpdatedEvent` to ACL snapshots; persistent decision audit is partial | Admin authorization, ACL propagation, audit gap |
| UC-28 (Approve or Reject Shipper Applications) | Administration & Governance | QA-S-03 | Shipper application approval is planned; the only current architectural pressure is preserving admin-only role elevation when implemented | Planned shipper approval gate |
| UC-29 (Suspend or Reactivate Partner Accounts) | Administration & Governance | QA-S-03 | Suspension/reactivation is planned; current code has Better Auth ban fields and restaurant unapproval, but no dedicated partner suspension surface | Planned admin authorization |
| UC-30 (Monitor Orders and Platform Health) | Administration & Governance | QA-S-03, QA-SUP-03 | Admin order monitoring is implemented as a cross-tenant read; health KPIs and stuck-order diagnostic surfacing are planned | Admin read scope, scale posture, diagnostics gap |
| UC-32 (Administrative Order Cancellation & Refund) | Administration & Governance | QA-R-03, QA-R-08, QA-FL-02, QA-S-03, QA-SUP-01, QA-CI-01, QA-CI-02 | Admin transitions reuse the same closed state machine and audit log; paid cancellations share the same Payment BC compensation event as customer/restaurant cancellations | State integrity, admin authority, compensation |
| UC-33 (View and Export Operational Reports) | Administration & Governance | QA-S-03 | Reporting/export is planned; the controlling architectural pressure is admin-only access and future PII minimization | Planned report authorization |
| UC-35 (Manage Admin Roles & Permissions) | Administration & Governance | QA-S-03 | Role management is planned; future implementation must reuse `user.role`/`hasRole()` and enforce a last-admin safeguard atomically | Planned privileged role integrity |

---

## 7.2 QA → Driver → Decision → Evidence Matrix

| QA | Related UC(s) | Architectural Driver | Decision / Tactic | Evidence | Status |
|----|---------------|----------------------|-------------------|----------|--------|
| QA-P-01 (Restaurant Search ≤ 2 s) | UC-2, UC-3 | AD-3 | Restaurant Catalog owns public search/detail reads; queries are paginated, filter approved/open restaurants, and use deterministic ordering | [search.repository.ts](../../../src/module/restaurant-catalog/search/search.repository.ts) | Implemented |
| QA-P-02 (Order Status Push ≤ 5 s) | UC-14, UC-15, UC-18, UC-19, UC-20, UC-26 | AD-4 | `OrderStatusChangedEvent` after commit → Notification handler → durable notification rows → WebSocket `room:user:{userId}` / push dispatch | [order-status-changed.handler.ts](../../../src/module/notification/events/order-status-changed.handler.ts); [notification.gateway.ts](../../../src/module/notification/gateway/notification.gateway.ts) | Partial |
| QA-P-03 (Checkout p95 ≤ 3 s) | UC-8 | AD-1, AD-7 | Single command handler performs ACL reads, Haversine delivery-radius enforcement, promotion reservation, delivery pricing, ACID order write, and post-commit event publish | [place-order.handler.ts](../../../src/module/ordering/order/commands/place-order.handler.ts); [geo.service.ts](../../../src/lib/geo/geo.service.ts); [delivery-zone-snapshot.repository.ts](../../../src/module/ordering/acl/repositories/delivery-zone-snapshot.repository.ts) | Implemented |
| QA-P-04 (Menu/Availability Propagation Target ≤ 10 s) | UC-12, UC-13 | AD-3 | Catalog mutations publish in-process events; Ordering ACL projectors upsert local snapshots for checkout, and current same-process dispatch is expected to complete faster than the target even though formal latency measurement is pending | [menu-item.projector.ts](../../../src/module/ordering/acl/projections/menu-item.projector.ts); [restaurant-snapshot.projector.ts](../../../src/module/ordering/acl/projections/restaurant-snapshot.projector.ts); [delivery-zone-snapshot.projector.ts](../../../src/module/ordering/acl/projections/delivery-zone-snapshot.projector.ts) | Partial |
| QA-A-01 (Auth Endpoint Availability Objective) | UC-1 | AD-3 | Better Auth sessions are persisted in PostgreSQL; app instances do not hold in-memory auth sessions, but the 99.5 percent figure is a deployment objective rather than a measured service level | [lib/auth.ts](../../../src/lib/auth.ts); [auth.schema.ts](../../../src/module/auth/auth.schema.ts) | Partial |
| QA-A-02 (Real-Time Channel Graceful Degradation) | UC-20, UC-26 | AD-4 | Notifications are durable DB rows; WebSocket is a delivery channel, while REST inbox supports recovery after disconnect | [notification.schema.ts](../../../src/module/notification/domain/notification.schema.ts); [notification.controller.ts](../../../src/module/notification/controllers/notification.controller.ts); [notification.gateway.ts](../../../src/module/notification/gateway/notification.gateway.ts) | Partial |
| QA-A-03 (Optional Notification-Channel Degradation) | UC-26 | AD-9 | SMTP and FCM providers bind to Noop/Stub implementations when credentials are absent; dispatch failures are logged per channel | [notification.module.ts](../../../src/module/notification/notification.module.ts); [channel-dispatcher.service.ts](../../../src/module/notification/services/channel-dispatcher.service.ts) | Implemented |
| QA-R-01 (Order Placement Idempotency) | UC-8 | AD-1 | Redis idempotency key fast path plus DB `UNIQUE(cart_id)` backstop and Redis checkout lock | [place-order.handler.ts](../../../src/module/ordering/order/commands/place-order.handler.ts); [order.schema.ts](../../../src/module/ordering/order/order.schema.ts) | Implemented |
| QA-R-02 (Payment IPN Idempotency) | UC-9 | AD-2 | Signature verification first, terminal-state short-circuit, `payment_transactions.version` optimistic lock, provider transaction uniqueness | [process-ipn.handler.ts](../../../src/module/payment/commands/process-ipn.handler.ts); [payment-transaction.schema.ts](../../../src/module/payment/domain/payment-transaction.schema.ts) | Implemented |
| QA-R-03 (Order State-Machine Integrity) | UC-14, UC-15, UC-18, UC-19, UC-21, UC-32 | AD-5 | Closed `TRANSITIONS` map and `TransitionOrderHandler` enforce allowed roles, ownership, notes, optimistic locking, and post-commit events | [transitions.ts](../../../src/module/ordering/order-lifecycle/constants/transitions.ts); [transition-order.handler.ts](../../../src/module/ordering/order-lifecycle/commands/transition-order.handler.ts) | Implemented |
| QA-R-04 (Single-Restaurant Cart Invariant) | UC-4, UC-5 | AD-6 | `CartService` rejects cross-restaurant additions before Redis persistence and leaves existing cart unchanged | [cart.service.ts](../../../src/module/ordering/cart/cart.service.ts) | Implemented |
| QA-R-05 (Atomic Shipper Assignment) | UC-18 | AD-5 | T-09 self-assignment sets `shipperId` inside the optimistic-lock status update; concurrent losers receive conflict | [transition-order.handler.ts](../../../src/module/ordering/order-lifecycle/commands/transition-order.handler.ts); [order.schema.ts](../../../src/module/ordering/order/order.schema.ts) | Implemented |
| QA-R-06 (Payment Timeout Recovery) | UC-9 | AD-2 | `PaymentTimeoutTask` expires stale pending/awaiting-IPN transactions and emits `PaymentFailedEvent` for Ordering cancellation | [payment-timeout.task.ts](../../../src/module/payment/tasks/payment-timeout.task.ts); [payment-failed.handler.ts](../../../src/module/ordering/order-lifecycle/events/payment-failed.handler.ts) | Implemented |
| QA-R-07 (Restaurant Acceptance Timeout) | UC-14 | AD-5 | `OrderTimeoutTask` scans expired pending/paid orders and dispatches `TransitionOrderCommand` through the same state-machine path | [order-timeout.task.ts](../../../src/module/ordering/order-lifecycle/tasks/order-timeout.task.ts); [app-settings.schema.ts](../../../src/module/ordering/common/app-settings.schema.ts) | Implemented |
| QA-R-08 (Refund and Promotion Compensation Reliability) | UC-8, UC-14, UC-21, UC-23, UC-25, UC-32 | AD-12 | Post-commit compensation events isolate refund and promotion rollback side effects from the committed order lifecycle; Payment BC advances refund state independently, while Promotion BC confirms or rolls back reservations idempotently through `PROMOTION_APPLICATION_PORT`; real VNPay refund call remains stubbed and operational retry is still planned | [order-cancelled-after-payment.handler.ts](../../../src/module/payment/events/order-cancelled-after-payment.handler.ts); [promotion-rollback-on-cancellation.handler.ts](../../../src/module/ordering/order-lifecycle/events/promotion-rollback-on-cancellation.handler.ts); [promotion.service.ts](../../../src/module/promotion/services/promotion.service.ts); [place-order.handler.ts](../../../src/module/ordering/order/commands/place-order.handler.ts) | Partial |
| QA-S-01 (VNPay Callback Integrity) | UC-9 | AD-2 | HMAC-SHA512 canonicalization and constant-time signature comparison before any DB mutation | [vnpay.service.ts](../../../src/module/payment/services/vnpay.service.ts); [process-ipn.handler.ts](../../../src/module/payment/commands/process-ipn.handler.ts) | Implemented |
| QA-S-02 (Authentication & Session Management) | UC-1, UC-4, UC-5, UC-8, UC-20, UC-21, UC-22 | AD-3 | Better Auth bearer sessions with PostgreSQL persistence; session extraction on HTTP and WebSocket paths | [lib/auth.ts](../../../src/lib/auth.ts); [notification.gateway.ts](../../../src/module/notification/gateway/notification.gateway.ts) | Implemented |
| QA-S-03 (Role-Based Authorization) | UC-1, UC-7, UC-11, UC-12, UC-13, UC-14, UC-15, UC-16, UC-18, UC-19, UC-23, UC-24, UC-26, UC-27, UC-28, UC-29, UC-30, UC-32, UC-33, UC-35 | AD-8 | `hasRole()` OR-logic, Better Auth `@Roles`, service-level ownership checks, and transition-map `allowedRoles` enforce role-specific surfaces | [role.util.ts](../../../src/module/auth/role.util.ts); [transitions.ts](../../../src/module/ordering/order-lifecycle/constants/transitions.ts) | Implemented |
| QA-S-05 (Input Validation & Injection Resistance) | UC-1, UC-2, UC-8, UC-12, UC-22, UC-23, UC-24 | AD-3 | Global `ValidationPipe({ transform: true })`, DTO validators, and Drizzle parameterized queries protect implemented request surfaces; Review text validation is planned | [main.ts](../../../src/main.ts); DTO files under [module](../../../src/module) | Implemented / Planned for UC-22 |
| QA-S-06 (Rate Limiting on Public Endpoints) | UC-1 | AD-11 | Edge or `@nestjs/throttler` rate limiting is planned; no Nest throttler module is registered | [app.module.ts](../../../src/app.module.ts) | Planned |
| QA-SC-01 (Horizontal Scaling of API Instances) | UC-2 | AD-4 | HTTP state is externalized to PostgreSQL/Redis; real-time delivery is the limiting architecture pressure because WebSocket room membership remains process-local, so scale-out needs sticky sessions or a Socket.IO Redis adapter | [redis.module.ts](../../../src/lib/redis/redis.module.ts); [notification.gateway.ts](../../../src/module/notification/gateway/notification.gateway.ts) | Partial |
| QA-SC-02 (Cart & Idempotency Storage Scaling) | UC-4, UC-5, UC-8 | AD-6 | Redis per-customer cart key, sliding TTL, idempotency TTL key, and checkout lock keep hot cart/order state out of app memory | [cart.redis-repository.ts](../../../src/module/ordering/cart/cart.redis-repository.ts); [redis.service.ts](../../../src/lib/redis/redis.service.ts) | Implemented |
| QA-FL-01 (Generalizing Payment Provider Integration) | UC-8, UC-9 | AD-3 | Ordering depends on a Payment port token, but the port method is VNPay-specific and must be generalized before adding non-VNPay providers without Ordering changes | [payment-initiation.port.ts](../../../src/shared/ports/payment-initiation.port.ts); [payment.service.ts](../../../src/module/payment/services/payment.service.ts) | Partial |
| QA-FL-02 (Adding a New Order Status) | UC-15, UC-18, UC-19, UC-21, UC-32 | AD-5 | Add/update `orderStatusEnum`, `TRANSITIONS`, and notification mapping to preserve closed lifecycle semantics | [order.schema.ts](../../../src/module/ordering/order/order.schema.ts); [transitions.ts](../../../src/module/ordering/order-lifecycle/constants/transitions.ts); [order-status-changed.handler.ts](../../../src/module/notification/events/order-status-changed.handler.ts) | Implemented |
| QA-FL-03 (Replacing Notification Channel Provider) | UC-26 | AD-9 | `EmailProvider` and `PushProvider` interfaces hide provider implementations behind DI tokens | [email-provider.interface.ts](../../../src/module/notification/channels/email/email-provider.interface.ts); [push-provider.interface.ts](../../../src/module/notification/channels/push/push-provider.interface.ts) | Implemented |
| QA-I-01 (VNPay Gateway Integration) | UC-9, UC-25 | AD-2 | VNPay URL/IPN integration is implemented; refund API call is represented by a stub and TODO-backed state transition | [vnpay.service.ts](../../../src/module/payment/services/vnpay.service.ts); [order-cancelled-after-payment.handler.ts](../../../src/module/payment/events/order-cancelled-after-payment.handler.ts) | Implemented for payment/IPN; Partial for refund |
| QA-I-02 (Push Notification Multi-Channel Dispatch) | UC-20, UC-26 | AD-9 | Channel dispatcher routes in-app, push, and email independently; online users suppress push after WebSocket delivery | [channel-dispatcher.service.ts](../../../src/module/notification/services/channel-dispatcher.service.ts); [notification.service.ts](../../../src/module/notification/services/notification.service.ts) | Implemented |
| QA-I-03 (Image Upload via Cloudinary) | UC-12 | AD-3 | Cloudinary signed-upload provider offloads image bytes; credentials are mandatory, not degraded | [cloudinary.provider.ts](../../../src/module/image/cloudinary.provider.ts); [cloudinary.service.ts](../../../src/module/image/cloudinary.service.ts) | Implemented |
| QA-SUP-01 (Audit Trail for Order Lifecycle) | UC-8, UC-14, UC-15, UC-18, UC-19, UC-21, UC-32 | AD-10 | `order_status_logs` append-only rows are inserted for origin and every transition inside the same transaction as the status update | [order.schema.ts](../../../src/module/ordering/order/order.schema.ts); [transition-order.handler.ts](../../../src/module/ordering/order-lifecycle/commands/transition-order.handler.ts) | Implemented |
| QA-SUP-02 (Structured Logging on Cross-BC Events) | UC-7, UC-11, UC-12, UC-13, UC-25, UC-26, UC-27 | AD-10 | Event handlers use NestJS `Logger`; notification/refund handlers swallow errors, while ACL projectors log and rethrow failed snapshot writes | [notification events](../../../src/module/notification/events); [acl projectors](../../../src/module/ordering/acl/projections); [order-cancelled-after-payment.handler.ts](../../../src/module/payment/events/order-cancelled-after-payment.handler.ts) | Partial |
| QA-SUP-03 (Stuck-Order Diagnostics) | UC-30 | AD-10 | Planned diagnostic surface should flag long-running non-terminal orders; current `OrderTimeoutTask` auto-cancels expired pending/paid orders but does not surface diagnostics | [order-timeout.task.ts](../../../src/module/ordering/order-lifecycle/tasks/order-timeout.task.ts); [order-history.controller.ts](../../../src/module/ordering/order-history/controllers/order-history.controller.ts) | Planned |
| QA-MA-01 (BC Boundary Enforcement) | UC-7, UC-8, UC-11, UC-12, UC-13, UC-23, UC-25, UC-26, UC-27 | AD-3 | Cross-BC reads use ACL snapshots; Ordering depends on Payment/Promotion through ports; Payment owns financial state; Notification owns delivery state | [ordering/acl](../../../src/module/ordering/acl); [promotion-application.port.ts](../../../src/shared/ports/promotion-application.port.ts); [payment-initiation.port.ts](../../../src/shared/ports/payment-initiation.port.ts) | Implemented |
| QA-MA-02 (Schema Evolution via Drizzle Migrations) | UC-8, UC-9, UC-23, UC-26 | AD-3 | Drizzle schemas and migrations govern order, payment, promotion, notification, and ACL tables | [drizzle.config.ts](../../../drizzle.config.ts); [schema.ts](../../../src/drizzle/schema.ts) | Implemented |
| QA-T-01 (Deterministic Order Placement Tests) | UC-8 | AD-1 | Order placement/payment regression tests run against controlled DB/Redis setup and injectable provider boundaries; notification provider stubs keep side effects deterministic | Representative evidence: [order.e2e-spec.ts](../../../test/e2e/order.e2e-spec.ts); [order-lifecycle.e2e-spec.ts](../../../test/e2e/order-lifecycle.e2e-spec.ts); [cart.e2e-spec.ts](../../../test/e2e/cart.e2e-spec.ts); [acl.e2e-spec.ts](../../../test/e2e/acl.e2e-spec.ts); [promotion-checkout.e2e-spec.ts](../../../test/e2e/promotion-checkout.e2e-spec.ts); [payment.e2e-spec.ts](../../../test/payment.e2e-spec.ts); [notification-inbox.e2e-spec.ts](../../../test/e2e/notification-inbox.e2e-spec.ts); [notification.module.ts](../../../src/module/notification/notification.module.ts) | Implemented |
| QA-U-01 (Sub-2-Minute Registration Flow) | UC-1 | AD-3 | Better Auth email/password account creation and session issue provide the backend path; client UX metrics remain partial | [lib/auth.ts](../../../src/lib/auth.ts) | Partial |
| QA-U-02 (Predictable Restaurant Discovery) | UC-2 | AD-3 | Search returns paginated sections with deterministic relevance/distance/date ordering | [search.repository.ts](../../../src/module/restaurant-catalog/search/search.repository.ts) | Implemented |
| QA-CI-01 (Single Order-Status Vocabulary) | UC-8, UC-14, UC-15, UC-18, UC-19, UC-20, UC-21, UC-32 | AD-5 | `orderStatusEnum` and `TRANSITIONS` are the source for lifecycle writes, reads, admin overrides, and future status-gated review eligibility | [order.schema.ts](../../../src/module/ordering/order/order.schema.ts); [transitions.ts](../../../src/module/ordering/order-lifecycle/constants/transitions.ts) | Implemented for order lifecycle; Planned for UC-22 |
| QA-CI-02 (Event Envelope Consistency) | UC-7, UC-8, UC-9, UC-11, UC-12, UC-13, UC-15, UC-21, UC-25, UC-26, UC-27, UC-32 | AD-3 | Shared domain events are immutable POJOs with explicit constructors and barrel exports; current integration is in-process EventBus | [shared/events](../../../src/shared/events) | Implemented |

---

## Appendix A — ASR Confidence Summary

The table below counts only §4 functional rows by implementation status. Architecturally routine UCs (UC-6, UC-10, UC-17, UC-31, UC-34) are excluded from §4 — they involve standard CRUD with no architectural drivers; they are covered by the general constraints in §5 and cross-cutting concerns in §6. QA scenario gaps are listed separately and are not counted as UC rows.

| Confidence | Count | §4 UC Rows |
|------------|------:|------------|
| **Implemented** | 20 | Sign Up (UC-1), Sign In (UC-1), RBAC, Discover Restaurants (UC-2), View Restaurant Details (UC-3), Add Item to Cart (UC-4), Manage Shopping Cart (UC-5), Manage Delivery Zones (UC-7), Place Order (UC-8), Make Online Payment — VNPay (UC-9), Manage Menu Catalog (UC-12), Toggle Availability (UC-13), Accept/Reject Order (UC-14), Prepare for Pickup (UC-15), Deliver Order (UC-19), Cancel Order (UC-21), Manage Restaurant Promotions (UC-23), Manage Platform Promotions (UC-24), Manage Real-Time Notifications (UC-26), Admin Order Cancellation & Refund (UC-32) |
| **Partial** | 7 | Forgot / Reset Password (UC-1), Restaurant Registration & Profile (UC-11), Accept Delivery Assignment (UC-18), Track Order Status (UC-20), Process Payment Refund (UC-25), Approve Restaurant Applications (UC-27), Monitor Orders (UC-30) |
| **Planned** | 6 | Shipper Registration (UC-16), Submit Rating & Review (UC-22), Approve Shipper Applications (UC-28), Suspend / Reactivate Partners (UC-29), View & Export Reports (UC-33), Manage Admin Roles & Permissions (UC-35) |

Total architecturally significant functional rows in §4: **33**.

Open QA scenario gaps not counted in §4 UC statistics:


---

## Appendix B — Out-of-Scope (to prevent overclaiming)

The following are commonly listed in enterprise ASRs but are **deliberately excluded** from the SoLi MVP and must not be assumed present:

- Microservices, service mesh, Kubernetes operators
- Message brokers (Kafka, RabbitMQ, NATS, SQS)
- Distributed transaction coordination
- Cross-service eventual consistency infrastructure
- Service discovery
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
