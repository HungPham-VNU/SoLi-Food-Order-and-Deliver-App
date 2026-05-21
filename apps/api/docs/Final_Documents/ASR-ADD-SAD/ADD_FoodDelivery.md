# **ATTRIBUTE-DRIVEN** **DESIGN DOCUMENT**

### SoLi Food Delivery Platform

_Prepared by_

Architecture Team


##### **Table of content**

**1. Design Constraints.....................................................................................................................**

**2. Quality Attribute Requirements...............................................................................................**

2.1. Performance..............................................................................................................................................

2.1.1. Restaurant Search Response Time............................................................................................

2.1.2. Order Status Propagation to Customer....................................................................................

2.1.3. Checkout End-to-End Latency....................................................................................................

2.1.4. Menu / Availability Update Propagation................................................................................

2.2. Availability.................................................................................................................................................

2.2.1. Authentication Endpoint Availability......................................................................................

2.2.2. Real-Time Channel Graceful Degradation...............................................................................

2.2.3. Optional Notification-Channel Degradation...........................................................................

2.3. Reliability...................................................................................................................................................

2.3.1. Order Placement Idempotency...................................................................................................

2.3.2. Payment IPN Webhook Idempotency.......................................................................................

2.3.3. Order State-Machine Integrity...................................................................................................

2.3.4. Single-Restaurant Cart Invariant...............................................................................................

2.3.5. Atomic Shipper Assignment........................................................................................................

2.3.6. Payment Timeout Recovery.........................................................................................................

2.3.7. Restaurant Acceptance Timeout.................................................................................................

2.3.8. Refund and Promotion Compensation Reliability................................................................

2.4. Security.......................................................................................................................................................

2.4.1. VNPay Callback Integrity............................................................................................................

2.4.2. Authentication & Session Management...................................................................................

2.4.3. Role-Based Authorization............................................................................................................

2.4.4. Input Validation & Injection Resistance..................................................................................

2.4.5. Rate Limiting on Public Endpoints...........................................................................................

2.5. Scalability...................................................................................................................................................

2.5.1. Horizontal Scaling of API Instances.........................................................................................

2.5.2. Cart and Idempotency Storage Scaling....................................................................................

2.6. Flexibility....................................................................................................................................................

2.6.1. Generalizing Payment Provider Integration...........................................................................

2.6.2. Adding a New Order Status.........................................................................................................

2.6.3. Replacing a Notification Channel Provider............................................................................

2.7. Interoperability........................................................................................................................................

2.7.1. VNPay Gateway Integration........................................................................................................

2.7.2. Push Notification Multi-Channel Dispatch.............................................................................

2.7.3. Image Upload via Cloudinary.....................................................................................................

2.8. Supportability...........................................................................................................................................

2.8.1. Audit Trail for Order Lifecycle..................................................................................................

2.8.2. Structured Logging on Cross-BC Events.................................................................................

2.8.3. Stuck-Order Diagnostics..............................................................................................................

2.9. Maintainability.........................................................................................................................................

2.9.1. Bounded-Context Boundary Enforcement..............................................................................

2.9.2. Schema Evolution via Drizzle Migrations...............................................................................

2.10. Testability................................................................................................................................................

2.10.1. Deterministic Order Placement Tests.....................................................................................

2.11. Usability...................................................................................................................................................

2.11.1. Sub-2-Minute Registration Flow.............................................................................................

2.11.2. Predictable Restaurant Discovery...........................................................................................

2.12. Conceptual Integrity.............................................................................................................................

2.12.1. Single Order-Status Vocabulary..............................................................................................

2.12.2. Event Envelope Consistency......................................................................................................

**3. Architectural Representation...................................................................................................**

3.1. Logical View..............................................................................................................................................

3.2. Implementation View.............................................................................................................................

3.3. Deployment View....................................................................................................................................

3.4. Data View...................................................................................................................................................


## 1. Design Constraints

In this ADD, **Design Constraints** are expressed as quality drivers: the quality concerns that constrain the architecture and force specific design responsibilities. Technology choices are consequences of these drivers, not the primary constraints.

ー **Performance** :
- **Constraint:** Search, checkout, cart mutation, order-status propagation, and notification delivery must stay responsive during normal mobile/web use.
- **Architectural implication:** Reads are paginated, cart and idempotency state are kept in Redis, checkout is concentrated in one command handler, and non-critical side effects are emitted after commit.
- **Affected modules:** Restaurant Catalog, Ordering, Cart, Payment, Notification, Redis, PostgreSQL.
- **Design pressure:** Avoid chatty cross-context calls, prevent N+1 list reads, keep event handlers lightweight, and preserve p95 targets for the user-visible purchase path.

ー **Availability** :
- **Constraint:** Authentication, ordering, payment confirmation, and notification recovery must remain usable when optional providers or client connections degrade.
- **Architectural implication:** Core business state is persisted in PostgreSQL, sessions are database-backed, notification inbox rows are durable, and SMTP/FCM providers degrade through Noop/Stub adapters.
- **Affected modules:** Auth, Ordering, Payment, Notification, Redis, PostgreSQL, external provider adapters.
- **Design pressure:** Keep optional channels from blocking committed order/payment flows and define fallback reads for disconnected clients.

ー **Reliability** :
- **Constraint:** The platform must prevent duplicate orders, invalid order transitions, duplicate payment updates, and inconsistent promotion/refund side effects.
- **Architectural implication:** Ordering uses Redis idempotency plus a database uniqueness backstop, lifecycle transitions use a closed state machine and optimistic locking, and payment IPN processing verifies terminal states before mutation.
- **Affected modules:** Ordering, Order Lifecycle, Payment, Promotion, Notification, Redis, PostgreSQL.
- **Design pressure:** Put invariants in backend handlers and database constraints, emit events only after commit, and make compensation handlers idempotent.

ー **Security** :
- **Constraint:** Identity, role-based access, payment callback integrity, and public endpoint abuse protection must protect money, orders, and administrative actions.
- **Architectural implication:** Better Auth owns credential/session handling, route guards and service checks enforce roles and ownership, VNPay callbacks are HMAC verified before lookup/mutation, and rate limiting is reserved for the edge or Nest throttling layer.
- **Affected modules:** Auth, Payment, Ordering, Restaurant Catalog, Promotion, Notification, Image, Admin/Governance surfaces.
- **Design pressure:** Keep secrets in validated environment variables, avoid custom cryptography, deny unauthorized access before mutation, and avoid leaking order existence across ownership boundaries.

ー **Scalability** :
- **Constraint:** Browse/search and cart/order traffic must grow beyond one process while respecting the modular-monolith boundary.
- **Architectural implication:** HTTP state is externalized to PostgreSQL and Redis; scaling means replicating the whole API instance, while WebSocket fan-out requires sticky sessions or a Socket.IO Redis adapter before multi-instance correctness.
- **Affected modules:** API runtime, Restaurant Catalog, Cart, Ordering, Notification Gateway, Redis, PostgreSQL.
- **Design pressure:** Keep modules stateless at the process level, isolate hot volatile keys in Redis, and document the EventBus limitation before extracting services.

ー **Flexibility** :
- **Constraint:** Payment providers, notification providers, order statuses, and promotion rules must be changeable without rewriting checkout or lifecycle ownership.
- **Architectural implication:** Ordering depends on Payment and Promotion through ports, notification channels are provider interfaces, and lifecycle states are centralized in one enum/transition matrix.
- **Affected modules:** Ordering, Payment, Promotion, Notification, shared ports, shared events.
- **Design pressure:** Avoid concrete cross-BC imports, keep provider details behind adapters, and update contract tests whenever core vocabularies evolve.

ー **Maintainability** :
- **Constraint:** The backend must remain understandable as bounded contexts with clear data ownership even while deployed as one application.
- **Architectural implication:** Source code is organized by BC modules under `apps/api/src/module`, shared contracts live under `src/shared`, infrastructure helpers stay under `src/lib`, and Drizzle schemas group tables by owner.
- **Affected modules:** All backend BCs, shared events, shared ports, Drizzle schema/migrations.
- **Design pressure:** Prevent boundary erosion, keep routine CRUD inside its owning module, and treat cross-context reads as snapshots or public contracts.

ー **Testability** :
- **Constraint:** Critical order, payment, promotion, notification, and lifecycle rules must be verifiable deterministically in CI.
- **Architectural implication:** Command handlers and services use dependency injection, providers can be stubbed, and e2e tests run against controlled PostgreSQL/Redis services.
- **Affected modules:** Ordering, Payment, Promotion, Notification, Cart, ACL projections, test setup.
- **Design pressure:** Keep time, provider calls, and Redis/DB dependencies controllable; preserve small handler contracts that can be tested without full client stacks.

ー **Usability** :
- **Constraint:** Users must receive predictable feedback for discovery, cart conflicts, payment failure, delivery updates, and notification recovery.
- **Architectural implication:** Backend responses include structured error reasons, cart mutations return the full cart payload, order/payment states are durable, and notification inbox reads support recovery after realtime disconnects.
- **Affected modules:** Restaurant Catalog, Cart, Ordering, Payment, Notification, Auth.
- **Design pressure:** Make backend state transitions and error codes explicit so web/mobile clients can present clear next actions without duplicating business logic.

ー **Interoperability** :
- **Constraint:** The platform must integrate predictably with VNPay, Cloudinary, FCM, SMTP, Expo/mobile clients, and web clients.
- **Architectural implication:** External systems are wrapped by adapters, gateway payloads are canonicalized, image bytes remain in Cloudinary, and clients consume backend REST/WebSocket contracts rather than database structures.
- **Affected modules:** Payment, Image, Notification, Auth, client API contracts.
- **Design pressure:** Preserve provider-specific protocol rules at the adapter boundary and keep domain modules free of provider payload formats where possible.

ー **Supportability** :
- **Constraint:** Operators and developers must be able to diagnose lifecycle decisions, payment outcomes, notification failures, and cross-context event issues.
- **Architectural implication:** Order transitions append audit rows, payment transactions preserve provider references/payload metadata, notification delivery attempts are logged, and NestJS loggers mark handler failures.
- **Affected modules:** Ordering, Payment, Notification, Promotion, Admin/Governance surfaces.
- **Design pressure:** Store enough actor/target/outcome context for investigation, and add correlation/central logging before relying on production SLO claims.

ー **Conceptual Integrity** :
- **Constraint:** The architecture must use one shared language for roles, order states, events, data ownership, and BC responsibilities.
- **Architectural implication:** Role vocabulary is centralized in Auth, order lifecycle vocabulary is centralized in Ordering, events are explicit POJOs, and each table group has a single owning BC.
- **Affected modules:** Auth, Ordering, shared events, Restaurant Catalog, Payment, Promotion, Notification, Image, Review & Rating target model.
- **Design pressure:** Avoid parallel meanings for the same business concept, keep Image and Notification independent from Catalog/Review, and treat Review & Rating as its own BC rather than a UI add-on.


## 2. Quality Attribute Requirements

#### 2.1. Performance

##### 2.1.1. QA-P-01 — Restaurant Search Response Time *[Implemented]*

| Element            | Description                                                                                                                                                                                                                                                |
|--------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Customer submits a restaurant / item search query                                                                                                                                                                                                          |
| Stimulus Source    | Customer client                                                                                                                                                                                                                                            |
| Environment        | Normal operational load (≤ 1× projected peak)                                                                                                                                                                                                              |
| Artifact           | `restaurant-catalog/search` controller + repository ([search.repository.ts](../../../src/module/restaurant-catalog/search/search.repository.ts)); PostgreSQL                                                                                              |
| Response           | First page of results returned with pagination metadata                                                                                                                                                                                                    |
| Response Measure   | p95 ≤ 2 s; page size ≤ 20; results ordered deterministically                                                                                                                                                                                              |
| Architectural Tactics | Paginated queries (`offset`/`limit`); approved/open composite index on restaurants; planned Redis read-through caching for hot queries (Cache-Aside)                                                                                                      |

##### 2.1.2. QA-P-02 — Order Status Propagation to Customer *[Partial]*

| Element            | Description                                                                                                                                  |
|--------------------|----------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Order status transitions (e.g., `confirmed → preparing`)                                                                                     |
| Stimulus Source    | Restaurant / shipper / admin HTTP client, or system task                                                                                     |
| Environment        | Normal load; customer device online; WebSocket session active                                                                                |
| Artifact           | [NotificationGateway](../../../src/module/notification/gateway/notification.gateway.ts) → `room:user:{userId}`; Socket.IO `/notifications` ns |
| Response           | Connected notification clients receive `WS_NOTIFICATION_CREATED`; persisted notification rows remain available for REST inbox reloads         |
| Response Measure   | Backend event-to-WebSocket emit latency target ≤ 5 s p95; client screen refresh/rendering behavior is implementation-specific and currently only partial |
| Architectural Tactics | In-process EventBus → event handler → WebSocket emit; Redis-tracked presence enables fan-out only to active sessions                         |

##### 2.1.3. QA-P-03 — Checkout End-to-End Latency *[Implemented]*

| Element            | Description                                                                                                                                       |
|--------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Customer submits Place-Order request                                                                                                              |
| Stimulus Source    | Customer client                                                                                                                                    |
| Environment        | Normal load; payment method = COD                                                                                                                 |
| Artifact           | [PlaceOrderHandler](../../../src/module/ordering/order/commands/place-order.handler.ts); Drizzle transaction over `orders`, `order_items`, `order_status_logs` |
| Response           | Order persisted; `OrderPlacedEvent` dispatched; response returned                                                                                 |
| Response Measure   | p95 ≤ 3 s including ACL snapshot reads, promotion reservation, haversine validation, and DB commit                                                |
| Architectural Tactics | Single ACID transaction; idempotency short-circuit on Redis hit; haversine in-memory; ACL reads from local snapshot tables (no cross-BC RPC)      |

##### 2.1.4. QA-P-04 — Menu / Availability Update Propagation *[Partial]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Restaurant edits menu item price / availability                                                                          |
| Stimulus Source    | Restaurant management client                                                                                             |
| Environment        | Normal load                                                                                                              |
| Artifact           | Restaurant-catalog → publishes `MenuItemUpdatedEvent` ([menu-item-updated.event.ts](../../../src/shared/events/menu-item-updated.event.ts)); Ordering ACL projector |
| Response           | `ordering_menu_item_snapshots` updated; subsequent place-order uses fresh data                                           |
| Response Measure   | Propagation target ≤ 10 s; current same-process event dispatch is expected to complete substantially faster, but formal latency measurement is still pending |

---

#### 2.2. Availability

##### 2.2.1. QA-A-01 — Authentication Endpoint Availability *[Partial]*

| Element            | Description                                                                                                                       |
|--------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Customer / partner submits sign-in or session validation                                                                          |
| Stimulus Source    | Any client                                                                                                                        |
| Environment        | Calendar month, normal + occasional partial outage                                                                                |
| Artifact           | Better Auth integration ([lib/auth.ts](../../../src/lib/auth.ts)); PostgreSQL session store                                       |
| Response           | Successful authentication when PostgreSQL/auth dependencies are available; failures surface as standard HTTP errors without relying on in-memory session state |
| Response Measure   | Availability target: 99.5 percent deployment objective for the authentication path; operational validation and resilience evidence are still pending |
| Architectural Tactics | Stateless app instances (planned horizontal scale); fail-fast at startup on config errors; restart-friendly Docker container       |

##### 2.2.2. QA-A-02 — Real-Time Channel Graceful Degradation *[Partial]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | WebSocket connection lost (network, server restart)                                                                      |
| Stimulus Source    | Customer / shipper / restaurant client                                                                                   |
| Environment        | Mobile network handover, degraded connectivity                                                                            |
| Artifact           | NotificationGateway plus REST NotificationController                                                                      |
| Response           | Backend supports recovery through the REST inbox at `/api/notifications/my`; mobile implements a notification socket and on-demand inbox fetch, while the defined unread-count polling hook is not wired and automatic order-detail polling is not implemented across clients |
| Response Measure   | In-app notifications are persisted with a 90-day `expiresAt`; reconnect re-joins the per-user room and new deliveries remain idempotent by notification key |
| Architectural Tactics | Durable notification store; idempotent `notification.id`; per-user room rejoin on reconnect                              |

##### 2.2.3. QA-A-03 — Optional Notification-Channel Degradation *[Implemented]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | SMTP or FCM unreachable / credentials absent                                                                             |
| Stimulus Source    | External provider outage                                                                                                 |
| Environment        | Provider degraded                                                                                                        |
| Artifact           | `EmailChannel`, `PushChannel` providers                                                                                  |
| Response           | Core flows (order placement, payment) continue; the affected notification channel logs failure to `notification_delivery_logs` |
| Response Measure   | Zero impact on order-state correctness; failed dispatches retried by future iteration (currently logged, not auto-retried) |

---

#### 2.3. Reliability

##### 2.3.1. QA-R-01 — Order Placement Idempotency *[Implemented]*

| Element            | Description                                                                                                                                                          |
|--------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Client retries Place-Order request after timeout or unknown response                                                                                                  |
| Stimulus Source    | Customer client                                                                                                                                     |
| Environment        | Network instability                                                                                                                                                  |
| Artifact           | [PlaceOrderHandler](../../../src/module/ordering/order/commands/place-order.handler.ts); Redis `idempotency:order:{key}`; `orders.cart_id` UNIQUE constraint         |
| Response           | Identical `orderId` returned; no duplicate `orders` row; no double-charge                                                                                            |
| Response Measure   | Zero duplicate orders across retries with identical `X-Idempotency-Key` within `ORDER_IDEMPOTENCY_TTL_SECONDS` (fallback 300 s)                                      |
| Architectural Tactics | D5-A Redis idempotency key (fast path); D5-B DB `UNIQUE(cart_id)` (backstop); transactional commit before publishing `OrderPlacedEvent`                              |

##### 2.3.2. QA-R-02 — Payment IPN Webhook Idempotency *[Implemented]*

| Element            | Description                                                                                                                            |
|--------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | VNPay retries the IPN callback                                                                                                         |
| Stimulus Source    | VNPay gateway                                                                                                                          |
| Environment        | VNPay retry policy (until `RspCode=00`)                                                                                                |
| Artifact           | [ProcessIpnHandler](../../../src/module/payment/commands/process-ipn.handler.ts); `payment_transactions.version`                       |
| Response           | First call updates state and publishes `PaymentConfirmedEvent` / `PaymentFailedEvent`; subsequent calls return success without re-emit |
| Response Measure   | Zero duplicate state transitions; zero duplicate downstream events under arbitrary retry counts                                        |
| Architectural Tactics | Signature verification first; lookup by `vnp_TxnRef`; terminal-state short-circuit; optimistic-lock `version` increment                |

##### 2.3.3. QA-R-03 — Order State-Machine Integrity *[Implemented]*

| Element            | Description                                                                                                                                                    |
|--------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Any actor (customer, restaurant, shipper, admin, scheduled task) requests an order status transition                                                            |
| Stimulus Source    | Any of the above                                                                                                                                               |
| Environment        | Normal + concurrent operation                                                                                                                                  |
| Artifact           | [TRANSITIONS map](../../../src/module/ordering/order-lifecycle/constants/transitions.ts) (closed transition matrix); [TransitionOrderHandler](../../../src/module/ordering/order-lifecycle/commands/transition-order.handler.ts) (enforcement + optimistic lock); [OrderLifecycleService](../../../src/module/ordering/order-lifecycle/services/order-lifecycle.service.ts) (ownership checks); `orders.version`; `order_status_logs` |
| Response           | Disallowed transitions rejected with a typed error; allowed transitions commit atomically and append an audit log                                              |
| Response Measure   | 100 % of disallowed transitions rejected; 100 % committed transitions logged; concurrent transition attempts fail-safe via optimistic-lock retry / rejection   |
| Architectural Tactics | Hand-crafted TRANSITIONS map (D6-A) in `constants/transitions.ts`; `TransitionOrderHandler` enforces via `@CommandHandler`; optimistic locking on `version`; transactional INSERT into `order_status_logs` |

##### 2.3.4. QA-R-04 — Single-Restaurant Cart Invariant *[Implemented]*

| Element            | Description                                                                                                                |
|--------------------|----------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Customer adds an item from Restaurant B to a cart already containing items from Restaurant A                                |
| Stimulus Source    | Customer client                                                                                                            |
| Environment        | Normal                                                                                                                     |
| Artifact           | [CartService](../../../src/module/ordering/cart/cart.service.ts)                                                            |
| Response           | Request rejected with a structured error (`CART_RESTAURANT_CONFLICT`); existing cart left unchanged                         |
| Response Measure   | 100 % rejection in unit / e2e tests; cart store remains consistent                                                          |
| Architectural Tactics | BR-2 enforcement in service before Redis write                                                                              |

##### 2.3.5. QA-R-05 — Atomic Shipper Assignment *[Implemented]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Two shippers concurrently accept the same dispatch                                                                       |
| Stimulus Source    | Shipper mobile clients                                                                                                   |
| Environment        | Concurrent acceptance                                                                                                    |
| Artifact           | T-09 (`ready_for_pickup → picked_up`) in [TransitionOrderHandler](../../../src/module/ordering/order-lifecycle/commands/transition-order.handler.ts); `orders.version`; `orders.shipperId` |
| Response           | At most one shipper bound to the order; loser receives a typed conflict response                                         |
| Response Measure   | Logical guarantee: at most one shipper assignment per successful optimistic-lock commit on the same order row; concurrent validation remains operational work |
| Architectural Tactics | Shipper self-assignment occurs inside the same optimistic-lock status update that advances T-09; losing concurrent requests receive `ConflictException` |

##### 2.3.6. QA-R-06 — Payment Timeout Recovery *[Implemented]*

| Element            | Description                                                                                                                                                                     |
|--------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | A payment transaction remains in `pending` or `awaiting_ipn` state beyond the configured `expiresAt` deadline                                                                   |
| Stimulus Source    | Customer inactivity, gateway delay, or payment abandonment                                                                                                                      |
| Environment        | Normal scheduled execution (`@Cron(EVERY_MINUTE)`)                                                                                                                              |
| Artifact           | [PaymentTimeoutTask](../../../src/module/payment/tasks/payment-timeout.task.ts); `payment_transactions.expiresAt`; `PaymentFailedEvent`                                          |
| Response           | Expired transaction transitioned to `failed` via optimistic lock; `PaymentFailedEvent` published; Ordering BC handler auto-cancels the order through the CQRS path              |
| Response Measure   | Expired transactions are selected by the every-minute sweeper; optimistic locking prevents duplicate state changes, but multi-pod duplicate-event behavior requires deployment validation |
| Architectural Tactics | Scheduled sweeper with optimistic-lock concurrency guard; event-driven cancellation cascade; terminal-state protection prevents double-processing                             |

##### 2.3.7. QA-R-07 — Restaurant Acceptance Timeout *[Implemented]*

| Element            | Description                                                                                                                                                                     |
|--------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | A restaurant does not accept or reject an order within the configured acceptance window                                                                                         |
| Stimulus Source    | Restaurant operator inaction                                                                                                                                                    |
| Environment        | Normal scheduled execution (`@Cron(EVERY_MINUTE)`)                                                                                                                              |
| Artifact           | [OrderTimeoutTask](../../../src/module/ordering/order-lifecycle/tasks/order-timeout.task.ts); `RESTAURANT_ACCEPT_TIMEOUT_SECONDS` (from `app_settings`); `TransitionOrderCommand` |
| Response           | Order auto-cancelled via the same CQRS `TransitionOrderCommand` path used by all actors; T-05 fires for paid orders triggering the refund event automatically                   |
| Response Measure   | Eligible expired orders are scanned every minute and routed through `TransitionOrderCommand`; stuck-order diagnostics / alerting remain planned                                    |
| Architectural Tactics | Scheduler scan; reuse of existing CQRS command path (no bespoke cancellation logic); acceptance window configurable at runtime via `app_settings` without redeployment        |

##### 2.3.8. QA-R-08 — Refund and Promotion Compensation Reliability *[Partial]*

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

#### 2.4. Security

##### 2.4.1. QA-S-01 — VNPay Callback Integrity *[Implemented]*

| Element            | Description                                                                                                                                       |
|--------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Forged or tampered VNPay IPN payload                                                                                                              |
| Stimulus Source    | Attacker / Internet                                                                                                                               |
| Environment        | Public IPN endpoint                                                                                                                               |
| Artifact           | [VNPayService.verifyReturnUrl / verifyIpn](../../../src/module/payment/services/vnpay.service.ts); `crypto.timingSafeEqual`                       |
| Response           | Request rejected; no state mutation; no events emitted                                                                                            |
| Response Measure   | Invalid HMAC-SHA512 payloads are rejected before state mutation; penetration / negative security tests are recommended validation                                                    |
| Architectural Tactics | Signature verification **before** any DB lookup; constant-time comparison; ordered URL-encoded canonicalization per VNPay spec                    |

##### 2.4.2. QA-S-02 — Authentication & Session Management *[Implemented]*

| Element            | Description                                                                                                                  |
|--------------------|------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | User sign-in / session validation                                                                                            |
| Stimulus Source    | Customer, restaurant, shipper, admin                                                                                          |
| Environment        | Public endpoints                                                                                                              |
| Artifact           | Better Auth + Drizzle adapter ([lib/auth.ts](../../../src/lib/auth.ts)); `session`, `account`, `verification` tables          |
| Response           | Strong session token issued; bearer token validated server-side on each request                                              |
| Response Measure   | Industry-standard password hashing (Better Auth default — scrypt); session secret ≥ 32 chars enforced at startup via Zod      |
| Architectural Tactics | Library-managed credential handling; HTTPS-only deployment (deployment constraint); no custom rolling of crypto             |

##### 2.4.3. QA-S-03 — Role-Based Authorization *[Implemented]*

| Element            | Description                                                                                                                                |
|--------------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Unauthorized actor accesses an admin / restaurant / shipper endpoint                                                                       |
| Stimulus Source    | Any client                                                                                                                                 |
| Environment        | Any                                                                                                                                        |
| Artifact           | `user.role` (multi-role CSV); [`hasRole()`](../../../src/module/auth/role.util.ts) utility; route guards                                   |
| Response           | 401 (no session) / 403 (insufficient role); unauthorized attempts observable through server/access logs; order lifecycle mutations write persistent audit rows |
| Response Measure   | Protected endpoints deny missing or mismatched roles before service-layer mutation                                                         |
| Architectural Tactics | Multi-role bitmap-equivalent (CSV) checked via OR-logic helper; Better Auth `admin()` plugin for admin scoping                           |


##### 2.4.4. QA-S-05 — Input Validation & Injection Resistance *[Implemented]*

| Element            | Description                                                                                                                  |
|--------------------|------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Client submits malformed DTO fields or HTML / JS payloads in catalog, cart, order, promotion, or notification requests        |
| Stimulus Source    | Authenticated or public client                                                                                                 |
| Environment        | Any                                                                                                                          |
| Artifact           | Global `ValidationPipe({ transform: true })` in [main.ts](../../../src/main.ts); class-validator DTOs                         |
| Response           | DTO validation rejects malformed payloads; Drizzle parameterization protects database access; stored review-text sanitization remains planned with UC-22 |
| Response Measure   | Invalid DTO payloads rejected before service-layer mutation; SQL injection prevented by Drizzle parameterized queries        |

##### 2.4.5. QA-S-06 — Rate Limiting on Public Endpoints *[Planned]*

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

#### 2.5. Scalability

##### 2.5.1. QA-SC-01 — Horizontal Scaling of API Instances *[Partial]*

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

##### 2.5.2. QA-SC-02 — Cart and Idempotency Storage Scaling *[Implemented]*

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

#### 2.6. Flexibility

##### 2.6.1. QA-FL-01 — Generalizing Payment Provider Integration *[Partial]*

| Element            | Description                                                                                                                                |
|--------------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Add a non-VNPay payment provider (e.g., MoMo, ZaloPay)                                                                                     |
| Stimulus Source    | Product roadmap                                                                                                                            |
| Environment        | Development                                                                                                                                |
| Artifact           | `IPaymentInitiationPort` ([payment-initiation.port.ts](../../../src/shared/ports/payment-initiation.port.ts)); Payment module               |
| Response           | Ordering is decoupled from the concrete Payment service, but the current port method is VNPay-specific (`initiateVNPayPayment`) and must be generalized before adding MoMo / ZaloPay without Ordering changes |
| Response Measure   | Current state: zero concrete Payment imports in `module/ordering`; target state: provider-neutral initiation contract and provider-selection tests |
| Architectural Tactics | Ports & Adapters boundary exists; provider strategy and payment-method-neutral port are planned                                            |

##### 2.6.2. QA-FL-02 — Adding a New Order Status *[Implemented]*

| Element            | Description                                                                                                                          |
|--------------------|--------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Add a new lifecycle status (e.g., `awaiting_courier`)                                                                                |
| Stimulus Source    | Operations roadmap                                                                                                                   |
| Environment        | Development                                                                                                                          |
| Artifact           | `order.schema.ts` enum; `TRANSITIONS` map; notification handlers                                                                  |
| Response           | New status added to enum, transition matrix, and audit log writer                                                                    |
| Response Measure   | Required changes are concentrated in the order enum, transition map, and notification mapping; transition-matrix tests are recommended validation |

##### 2.6.3. QA-FL-03 — Replacing a Notification Channel Provider *[Implemented]*

| Element            | Description                                                                                                          |
|--------------------|----------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Replace FCM with another push provider                                                                               |
| Stimulus Source    | Operations / cost decision                                                                                           |
| Environment        | Development                                                                                                          |
| Artifact           | `PushProvider` interface ([push-provider.interface.ts](../../../src/module/notification/channels/push/push-provider.interface.ts)) |
| Response           | New adapter added; module factory rebinds the token                                                                  |
| Response Measure   | Zero changes in event handlers or domain code                                                                        |

---

#### 2.7. Interoperability

##### 2.7.1. QA-I-01 — VNPay Gateway Integration *[Implemented]*

| Element            | Description                                                                                                                       |
|--------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Customer pays online                                                                                                              |
| Stimulus Source    | Customer / VNPay return + IPN callbacks                                                                                            |
| Environment        | Public Internet                                                                                                                   |
| Artifact           | [VNPayService](../../../src/module/payment/services/vnpay.service.ts); `vnp_*` parameters; `crypto` HMAC-SHA512                   |
| Response           | Payment URL generated; return + IPN parsed; signed correctly; result persisted                                                    |
| Response Measure   | Conformance to VNPay spec is verifiable through sandbox/manual tests for signature, ordering, and encoding                         |

##### 2.7.2. QA-I-02 — Push Notification Multi-Channel Dispatch *[Implemented]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | NotificationService persists a notification row from a domain-event handler                                             |
| Stimulus Source    | Cross-BC event handlers                                                                                                  |
| Environment        | Customer in foreground / background / offline                                                                            |
| Artifact           | [ChannelDispatcherService](../../../src/module/notification/services/channel-dispatcher.service.ts); `InAppChannelService`, `EmailChannelService`, `PushChannelService` |
| Response           | Channels chosen by user preferences and presence; each channel delivers independently                                    |
| Response Measure   | Delivery attempts are recorded in `notification_delivery_logs`; provider success-rate targets require operational monitoring |

##### 2.7.3. QA-I-03 — Image Upload via Cloudinary *[Implemented]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Restaurant uploads a menu-item image                                                                                     |
| Stimulus Source    | Restaurant management client                                                                                             |
| Environment        | Normal                                                                                                                   |
| Artifact           | [Cloudinary provider](../../../src/module/image/cloudinary.provider.ts); signed upload                                   |
| Response           | Image uploaded to Cloudinary; URL persisted in `images` table                                                            |
| Response Measure   | Target upload latency p95 ≤ 5 s for images ≤ 2 MB; actual latency depends on Cloudinary/network conditions               |

---

#### 2.8. Supportability

##### 2.8.1. QA-SUP-01 — Audit Trail for Order Lifecycle *[Implemented]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Any order status transition                                                                                              |
| Stimulus Source    | Any actor                                                                                                                |
| Environment        | Any                                                                                                                      |
| Artifact           | `order_status_logs` table                                                                                                |
| Response           | One row per transition: `{orderId, fromStatus, toStatus, triggeredBy (UUID|null), triggeredByRole, note, createdAt}`; `fromStatus` is nullable for the initial creation entry |
| Response Measure   | 100 % of committed transitions audited; queryable by orderId, actor, or time range                                       |

##### 2.8.2. QA-SUP-02 — Structured Logging on Cross-BC Events *[Partial]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | An event handler fails (e.g., ACL projection error, channel dispatch error)                                              |
| Stimulus Source    | Internal                                                                                                                 |
| Environment        | Production                                                                                                               |
| Artifact           | NestJS `Logger`; handler-specific failure policies in `@EventsHandler` classes                                            |
| Response           | Error logged at ERROR level with context (`eventType`, `aggregateId`); notification and refund handlers absorb failures, while ACL projectors currently log and rethrow after failed snapshot writes |
| Response Measure   | Handler failures are logged with contextual IDs; ≤ 5 minute detection requires active log monitoring until APM is integrated |
| Gap                | No central log aggregation or correlation IDs in the implemented baseline; APM / OpenTelemetry is future work             |

##### 2.8.3. QA-SUP-03 — Stuck-Order Diagnostics *[Planned]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | An order remains in a non-terminal status beyond a configured threshold                                                  |
| Stimulus Source    | Scheduler                                                                                                                |
| Environment        | Production                                                                                                               |
| Artifact           | Future diagnostic task and admin monitoring surface; current `OrderTimeoutTask` only auto-cancels expired pending / paid orders |
| Response           | Order flagged with a reason code and surfaced on the admin monitoring view                                               |
| Response Measure   | Detection latency ≤ 1 minute past threshold                                                                              |

---

#### 2.9. Maintainability

##### 2.9.1. QA-MA-01 — Bounded-Context Boundary Enforcement *[Implemented]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | A developer attempts to import a Payment / Promotion concrete class into Ordering                                        |
| Stimulus Source    | Pull request                                                                                                             |
| Environment        | Development                                                                                                              |
| Artifact           | Ports (`PAYMENT_INITIATION_PORT`, `PROMOTION_APPLICATION_PORT`); ACL snapshot tables                                     |
| Response           | The compiler permits it, but architectural reviews / planned ESLint boundary rules forbid it; only the port symbol is imported |
| Response Measure   | Zero cross-BC concrete imports in `module/ordering` (verified by grep / planned ESLint rule)                              |

##### 2.9.2. QA-MA-02 — Schema Evolution via Drizzle Migrations *[Implemented]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | New table / column added                                                                                                 |
| Stimulus Source    | Developer                                                                                                                |
| Environment        | Development → staging → production                                                                                       |
| Artifact           | Drizzle Kit migrations; `drizzle.config.ts`                                                                              |
| Response           | Generated migration file applied; existing data preserved                                                                |
| Response Measure   | Migrations are forward-compatible (no destructive rewrites without a coordinated release)                                |

---

#### 2.10. Testability

##### 2.10.1. QA-T-01 — Deterministic Order Placement Tests *[Implemented]*

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

#### 2.11. Usability

> Usability ASRs are owned by the client apps ([mobile](../../../../mobile), [web](../../../../web)), but listed here when they impose backend constraints.

##### 2.11.1. QA-U-01 — Sub-2-Minute Registration Flow *[Partial]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | New customer signs up                                                                                                    |
| Stimulus Source    | Customer (mobile / web)                                                                                                  |
| Environment        | Normal mobile network                                                                                                    |
| Artifact           | Better Auth `emailAndPassword` flow; client UX                                                                            |
| Response           | Account created, session issued, first screen rendered                                                                   |
| Response Measure   | ≥ 90 % of first-time users complete in ≤ 2 minutes; SUS ≥ 80 in usability tests                                          |
| Backend Constraint | Account-creation API response p95 ≤ 2 s                                                                                  |

##### 2.11.2. QA-U-02 — Predictable Restaurant Discovery *[Implemented]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Customer browses restaurants from the home screen                                                                        |
| Stimulus Source    | Customer                                                                                                                  |
| Environment        | Normal                                                                                                                    |
| Artifact           | Restaurant-catalog public endpoints                                                                                      |
| Response           | Stable pagination cursors; consistent ordering across requests                                                            |
| Response Measure   | Deterministic backend ordering is implemented; user task-completion metrics remain a client usability-test target         |

---

#### 2.12. Conceptual Integrity

##### 2.12.1. QA-CI-01 — Single Order-Status Vocabulary *[Implemented]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Any module reads or writes order status                                                                                  |
| Stimulus Source    | Internal modules                                                                                                          |
| Environment        | Any                                                                                                                       |
| Artifact           | `orderStatusEnum` in [order.schema.ts](../../../src/module/ordering/order/order.schema.ts)                               |
| Response           | All modules consume the same enum; cross-BC consumers receive status as a string literal type matching the enum           |
| Response Measure   | Zero parallel status vocabularies across implemented modules; contract tests for the allowed set are recommended validation |

##### 2.12.2. QA-CI-02 — Event Envelope Consistency *[Implemented]*

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | A new domain event is introduced                                                                                         |
| Stimulus Source    | Developer                                                                                                                |
| Environment        | Development                                                                                                              |
| Artifact           | [shared/events](../../../src/shared/events) — all events are immutable POJOs with explicit constructors                  |
| Response           | New event follows the same shape and is exported through the barrel `index.ts`                                           |
| Response Measure   | Code review currently enforces event-shape consistency; automated lint/fitness rules are planned                         |

---

## 3. Architectural Representation

To describe the architecture of the SoLi Food Delivery Platform, the following views are presented:

#### 3.1. Logical View

```plantuml
@startuml SoLi_Logical_View
skinparam backgroundColor #FFFFFF
skinparam shadowing false
skinparam componentStyle rectangle
skinparam packageStyle rectangle
skinparam defaultTextAlignment center
skinparam ArrowColor #334155
left to right direction

actor Customer #DFF7E8
actor "Restaurant Owner" as RestaurantOwner #FFF4D6
actor Shipper #E7F0FF
actor Admin #FCE7F3

rectangle "NestJS API Boundary\nModular Monolith" as API #EEF6FF {
  package "Auth BC" #DBEAFE {
    component "Identity\nSessions\nRBAC" as Auth
  }

  package "Restaurant Catalog BC" #ECFDF5 {
    component "Restaurant Management" as RestaurantMgmt
    component "Menu Catalog" as MenuCatalog
    component "Search" as Search
    component "Delivery Zones" as DeliveryZones
  }

  package "Image BC" #CCFBF1 {
    component "Image Metadata" as ImageMetadata
    component "Cloudinary Adapter" as CloudinaryAdapter
  }

  package "Ordering BC" #FFFBEB {
    component "Cart" as Cart
    component "Checkout / Place Order" as Checkout
    component "Order Lifecycle" as OrderLifecycle
    component "Order History" as OrderHistory
    component "Ordering ACL Snapshots" as OrderingACL
  }

  package "Payment BC" #F5F3FF {
    component "Payment Transactions" as PaymentTransactions
    component "VNPay Adapter" as VNPayAdapter
    component "Refund Compensation" as RefundCompensation
  }

  package "Promotion BC" #FAF5FF {
    component "Promotion Rules" as PromotionRules
    component "Coupon Codes" as CouponCodes
    component "Reservation / Confirm / Rollback" as PromotionReservation
  }

  package "Notification BC" #F0FDFA {
    component "Durable Inbox" as DurableInbox
    component "Socket.IO Gateway" as SocketGateway
    component "FCM / Email Channels" as NotificationChannels
    component "Notification ACL Snapshots" as NotificationACL
  }

  package "Review & Rating BC" #E0F2FE {
    component "Review Eligibility" as ReviewEligibility
    component "Rating / Comment Records" as ReviewRecords
    component "Moderation / Aggregation" as ReviewAggregation
  }

  package "Admin / Governance BC" #FDF2F8 {
    component "Partner Approval" as PartnerApproval
    component "Platform Oversight" as PlatformOversight
    component "Role Governance" as RoleGovernance
  }

  queue "In-process EventBus" as EventBus #E0E7FF
  interface "PAYMENT_INITIATION_PORT" as PaymentPort #DDD6FE
  interface "PROMOTION_APPLICATION_PORT" as PromotionPort #E9D5FF
}

Customer --> Auth
Customer --> Search
Customer --> MenuCatalog
Customer --> Cart
Customer --> Checkout
Customer --> OrderHistory
Customer --> DurableInbox
Customer --> ReviewRecords

RestaurantOwner --> Auth
RestaurantOwner --> RestaurantMgmt
RestaurantOwner --> MenuCatalog
RestaurantOwner --> DeliveryZones
RestaurantOwner --> ImageMetadata
RestaurantOwner --> OrderLifecycle
RestaurantOwner --> PromotionRules

Shipper --> Auth
Shipper --> OrderLifecycle
Shipper --> DurableInbox

Admin --> Auth
Admin --> PartnerApproval
Admin --> PlatformOversight
Admin --> RoleGovernance
Admin --> OrderLifecycle
Admin --> PromotionRules

RestaurantMgmt --> EventBus : restaurant events
MenuCatalog --> EventBus : menu events
DeliveryZones --> EventBus : zone events
Checkout --> EventBus : order placed
OrderLifecycle --> EventBus : status changed
PaymentTransactions --> EventBus : payment events
PromotionReservation --> EventBus : promotion usage events

EventBus --> OrderingACL
EventBus --> NotificationACL
EventBus --> DurableInbox
EventBus --> RefundCompensation

Checkout --> PaymentPort
PaymentPort --> PaymentTransactions
Checkout --> PromotionPort
PromotionPort --> PromotionReservation

MenuCatalog --> ImageMetadata : image id/url reference
ImageMetadata --> CloudinaryAdapter
PaymentTransactions --> VNPayAdapter
DurableInbox --> SocketGateway
DurableInbox --> NotificationChannels
ReviewEligibility ..> OrderHistory : delivered-order UUID reference
ReviewAggregation ..> RestaurantMgmt : rating summary contract
@enduml
```

This view presents the system's bounded contexts as independent ownership units inside one modular monolith. The implemented backend modules are Auth, Restaurant Catalog, Ordering, Payment, Promotion, Notification, and Image. Review & Rating and the broader Admin/Governance capabilities are represented as architecture-owned target bounded contexts because the SRS and business drivers require them, while the current source tree does not expose a dedicated review module or full governance module.

Subsystems:

ーAuthentication BC handles registration, login, bearer sessions, role vocabulary, Better Auth integration, and RBAC enforcement for HTTP and WebSocket entry points.

ーRestaurant Catalog BC handles restaurant management, menu categories/items/modifiers, public search, approval/open-state filters, and delivery-zone configuration.

ーImage BC is separate from Restaurant Catalog. It owns Cloudinary signed upload integration and image metadata (`images.publicId`, `secureUrl`, dimensions), while Catalog stores only references such as `imageUrl`, `logoUrl`, or `coverImageUrl`.

ーOrdering BC handles Redis cart state, checkout, delivery-radius validation, immutable order-item snapshots, order lifecycle, order history, ACL snapshots, idempotency, and audit logs.

ーPayment BC handles VNPay redirect URL creation, IPN verification, payment transaction state, timeout recovery, and refund compensation state.

ーPromotion BC handles restaurant/platform promotions, coupon codes, eligibility preview, checkout reservation, confirmation, rollback, and usage counters through the promotion port.

ーNotification BC handles durable inbox rows, Socket.IO fan-out, FCM push, SMTP email, delivery preferences, device tokens, presence, delivery logs, and notification-specific restaurant snapshots.

ーReview & Rating BC owns delivered-order review eligibility, one-review-per-order integrity, moderation, and rating aggregation. It is not merged with Notification because feedback persistence and notification delivery have different data ownership, lifecycle, and abuse-control requirements.

ーAdmin/Governance BC owns partner approval, platform oversight, privileged role governance, administrative cancellation/refund authority, report/export responsibilities, and operational diagnostics surfaces.

ーEventBus handles synchronous in-process domain event publication between bounded contexts in the modular monolith.

ーPorts isolate Ordering from concrete Payment and Promotion implementations through dependency-inversion contracts.


#### 3.2. Implementation View

```plantuml
@startuml SoLi_Implementation_View
skinparam backgroundColor #FFFFFF
skinparam shadowing false
skinparam componentStyle rectangle
skinparam packageStyle rectangle
skinparam defaultTextAlignment center
skinparam ArrowColor #334155
left to right direction

actor Customer
actor "Restaurant Owner" as RestaurantOwner
actor Shipper
actor Admin

rectangle "Client Applications\n(actors only in this view)" as Clients #F8FAFC {
  component "apps/web\nReact/Vite dashboard" as WebClient #FED7AA
  component "apps/mobile\nExpo mobile app" as MobileClient #99F6E4
}

package "apps/api" #E0F2FE {
  component "main.ts\nHTTP bootstrap\nValidationPipe" as MainTs #BAE6FD
  component "app.module.ts\nmodule composition" as AppModule #BAE6FD

  package "src/config" #DBEAFE {
    component "env.schema.ts" as EnvSchema
    component "vnpay.config.ts" as VnpayConfig
  }

  package "src/lib" #DBEAFE {
    component "auth.ts" as AuthLib
    component "redis" as RedisLib
    component "geo" as GeoLib
    component "dev-test-user.middleware.ts" as DevMiddleware
  }

  package "src/drizzle" #DCFCE7 {
    database "schema.ts\nmodule schema barrel" as SchemaBarrel
    component "migrations / seeds" as Migrations
  }

  package "src/module/auth" #DBEAFE {
    component "auth.schema.ts" as AuthSchema
    component "role.util.ts" as RoleUtil
  }

  package "src/module/restaurant-catalog" #BBF7D0 {
    component "restaurant" as ImplRestaurant
    component "menu + modifiers" as ImplMenu
    component "search" as ImplSearch
    component "restaurant/zones" as ImplZones
  }

  package "src/module/ordering" #FEF3C7 {
    component "cart" as ImplCart
    component "order\nPlaceOrderCommand" as ImplOrder
    component "order-lifecycle\nTransitionOrderCommand" as ImplLifecycle
    component "order-history" as ImplHistory
    component "acl\nrepositories + projectors" as ImplAcl
  }

  package "src/module/payment" #DDD6FE {
    component "controllers" as PaymentControllers
    component "commands\nProcessIpnCommand" as PaymentCommands
    component "domain schema" as PaymentDomain
    component "repositories" as PaymentRepos
    component "services\nVNPay" as PaymentServices
    component "tasks/events" as PaymentTasksEvents
  }

  package "src/module/promotion" #E9D5FF {
    component "controllers" as PromotionControllers
    component "domain schema" as PromotionDomain
    component "engine" as PromotionEngine
    component "repositories" as PromotionRepos
    component "services" as PromotionServices
  }

  package "src/module/notification" #99F6E4 {
    component "controllers" as NotificationControllers
    component "domain schemas" as NotificationDomain
    component "gateway" as NotificationGateway
    component "channels" as NotificationChannelsImpl
    component "repositories" as NotificationRepos
    component "services" as NotificationServices
    component "tasks/events/acl" as NotificationTasksEventsAcl
  }

  package "src/module/image" #CCFBF1 {
    component "controllers/dto" as ImageControllers
    component "service/repository" as ImageServiceRepo
    component "schema" as ImageSchema
    component "Cloudinary provider" as ImageCloudinary
  }

  package "src/shared" #F1F5F9 {
    component "events" as SharedEvents #E0E7FF
    component "ports" as SharedPorts #E9D5FF
    component "validators" as SharedValidators #FDE68A
  }

  package "test" #F3F4F6 {
    component "e2e specs" as E2ETests
    component "helpers/setup" as TestHelpers
  }
}

package "Delivery Artifacts" #F3F4F6 {
  component "apps/api/Dockerfile" as ApiDocker
  component "apps/web/Dockerfile" as WebDocker
  component ".github/workflows\nci / validate / publish" as Workflows
  component "GHCR images" as GHCR
  component "Render image-backed services" as RenderServices
}

Customer --> WebClient
Customer --> MobileClient
RestaurantOwner --> WebClient
RestaurantOwner --> MobileClient
Shipper --> MobileClient
Admin --> WebClient
WebClient --> MainTs : REST API
MobileClient --> MainTs : REST + Socket.IO

MainTs --> AppModule
AppModule --> EnvSchema
AppModule --> AuthLib
AppModule --> RedisLib
AppModule --> GeoLib
AppModule --> SchemaBarrel
AppModule --> AuthSchema
AppModule --> RoleUtil
AppModule --> ImplRestaurant
AppModule --> ImplMenu
AppModule --> ImplSearch
AppModule --> ImplZones
AppModule --> ImplCart
AppModule --> ImplOrder
AppModule --> ImplLifecycle
AppModule --> ImplHistory
AppModule --> ImplAcl
AppModule --> PaymentControllers
AppModule --> PromotionControllers
AppModule --> NotificationControllers
AppModule --> ImageControllers

ImplOrder --> SharedPorts
ImplOrder --> SharedEvents
ImplLifecycle --> SharedEvents
ImplAcl --> SharedEvents
PaymentCommands --> SharedEvents
PaymentServices --> SharedPorts
PromotionServices --> SharedPorts
NotificationTasksEventsAcl --> SharedEvents
ImageServiceRepo --> ImageCloudinary

Workflows --> ApiDocker
Workflows --> WebDocker
ApiDocker --> GHCR
WebDocker --> GHCR
GHCR --> RenderServices
@enduml
```

This view outlines the backend implementation structure and deployment artifacts. Web and mobile are intentionally shown only as actors/clients because detailed client feature internals are outside this ADD implementation view.

Structure:

ーThe backend is a NestJS modular monolith under `apps/api`.

ー`app.module.ts` composes Config, Database, Redis, Geo, Schedule, Restaurant Catalog, Promotion, Ordering, Payment, Notification, Image, and Better Auth modules.

ーCritical write paths use selective CQRS command handlers: order placement, order lifecycle transition, and VNPay IPN processing.

ーStandard catalog, menu, image, notification, promotion, and order-history operations use controller/service/repository layering.

ーShared events define immutable domain-event contracts exported through the shared event barrel.

ーShared ports define the dependency-inversion contracts for Ordering to call Payment and Promotion.

ーShared validators keep domain-specific validation such as VND amount rules outside individual controllers.

ーSecurity uses Better Auth sessions, bearer extraction, role decorators, `hasRole()` OR-logic, service-layer ownership checks, and route-level DTO validation.

ーLogging uses NestJS `Logger` instances at module, handler, service, gateway, and task boundaries.

ーNo dedicated backend module currently exists for Review & Rating, full Admin/Governance, OpenTelemetry/Prometheus/Grafana monitoring, or Nest Throttler rate limiting; these remain architecture-owned target surfaces or deployment concerns rather than implemented `apps/api/src/module` packages.

Technologies:

ーBackend: NestJS, TypeScript, Better Auth, `@nestjs/cqrs`, `@nestjs/schedule`.

ーORM: Drizzle ORM and Drizzle Kit.

ーDatabase: PostgreSQL.

ーVolatile state: Redis through `ioredis`.

ーRealtime: Socket.IO.

ーExternal providers: VNPay, Cloudinary, Firebase Cloud Messaging, Nodemailer SMTP.

ーClient stacks: React/Vite for web, Expo React Native for mobile.

ーCI/CD: pnpm, Turbo, GitHub Actions, Docker Buildx, GitHub Container Registry, Render deploy hooks.


#### 3.3. Deployment View

```plantuml
@startuml SoLi_Deployment_View
skinparam backgroundColor #FFFFFF
skinparam shadowing false
skinparam componentStyle rectangle
skinparam packageStyle rectangle
skinparam defaultTextAlignment center
skinparam ArrowColor #334155
left to right direction

cloud "Internet" as Internet #DBEAFE

node "Client Devices" as ClientDevices #F8FAFC {
  component "Browser\nweb dashboard" as Browser #FED7AA
  component "Mobile app\nExpo" as MobileRuntime #99F6E4
}

node "Render Runtime" as Render #E0F2FE {
  component "Web Service\nnginx + static React" as RenderWeb #FED7AA
  component "API Web Service\nNestJS Docker image" as RenderApi #BAE6FD
  database "Render Postgres\nDATABASE_URL" as RenderPostgres #BBF7D0
  database "Render Key Value\nRedis-compatible" as RenderRedis #FDE68A
  component "Render logs / health\nplatform diagnostics" as RenderOps #FECACA
}

cloud "VNPay" as VNPay #DDD6FE
cloud "Cloudinary" as Cloudinary #CCFBF1
cloud "Firebase Cloud Messaging" as FCM #DCFCE7
cloud "SMTP Provider" as SMTP #F5F5F4

node "GitHub" as GitHub #F3F4F6 {
  component "GitHub Actions\nvalidate + publish" as Actions
  component "GHCR\napi/web images" as Registry #E0E7FF
}

cloud "Render Deploy Hooks" as Hooks #DBEAFE

Browser --> Internet
MobileRuntime --> Internet
Internet --> RenderWeb : HTTPS
Internet --> RenderApi : HTTPS REST / Socket.IO
RenderWeb --> RenderApi : API calls
RenderApi --> RenderPostgres
RenderApi --> RenderRedis
RenderApi --> VNPay : HTTPS redirect/IPN integration
RenderApi --> Cloudinary : signed upload / metadata
RenderApi --> FCM : push delivery
RenderApi --> SMTP : email delivery
RenderApi --> RenderOps : logs / health checks
Actions --> Registry
Registry --> Hooks
Hooks --> RenderApi
Hooks --> RenderWeb
@enduml
```

Describes the deployment baseline used by the repository and CD guide.

Environment:

ーCloud deployment is documented for Render using image-backed services.

ーContainers: API and web are packaged as Docker images built from `apps/api/Dockerfile` and `apps/web/Dockerfile`.

ーRuntime: Render pulls prebuilt images from GHCR and runs API and web services.

ーDatabase: Render Postgres provides the PostgreSQL primary database through `DATABASE_URL`.

ーCache: Render Key Value provides a Redis-compatible store for carts, locks, idempotency keys, and WebSocket presence.

ーExternal integrations: VNPay, Cloudinary, SMTP, and FCM are accessed from the API service through provider boundaries.

ーRealtime scaling note: a single API service instance supports the current Socket.IO room model. Multi-instance API scaling must add sticky sessions or a Socket.IO Redis adapter so room membership remains correct.

ーMonitoring baseline: repository evidence supports application logs, health/startup validation, and Render platform diagnostics. Prometheus, Grafana, OpenTelemetry, and distributed tracing are excluded from the current deployment baseline.

Deployment Example:

ーDeveloper pushes to `master`.

ーGitHub Actions runs validation and publish workflows.

ーDocker images for API and web are published to GHCR with branch and short-SHA tags.

ーRender deploy hooks pull the GHCR API and web images.

ーAPI connects to Render Postgres and Render Key Value.

ーWeb dashboard calls the API through the configured `VITE_API_BASE_URL`.


#### 3.4. Data View

```plantuml
@startuml SoLi_Data_View
skinparam backgroundColor #FFFFFF
skinparam shadowing false
skinparam componentStyle rectangle
skinparam packageStyle rectangle
skinparam defaultTextAlignment center
skinparam ArrowColor #334155
left to right direction

rectangle "Logical Owners\n(database-per-service ready)" as Owners #E0F2FE {
  component "AUTH" as DAuth
  component "RESTAURANT_CATALOG" as DCatalog
  component "IMAGE" as DImage
  component "ORDERING" as DOrdering
  component "PAYMENT" as DPayment
  component "PROMOTION" as DPromotion
  component "NOTIFICATION" as DNotification
  component "REVIEW_RATING" as DReview
}

database "PostgreSQL\nsingle physical DB" as PG #DCFCE7 {
  package "AUTH" #DBEAFE {
    component "users\nid, email, name, role, banned\nsessions\nid, userId, token, expiresAt\naccounts / verification" as TAuth
  }

  package "RESTAURANT_CATALOG" #BBF7D0 {
    component "restaurants\nid, ownerId, name, address\nisOpen, isApproved, lat/lng\ncuisineType, logoUrl, coverImageUrl" as TRestaurants
    component "delivery_zones\nid, restaurantId, radiusKm\nbaseFee, perKmRate\nprepTimeMinutes, isActive" as TZones
    component "menu_categories\nid, restaurantId, name\ndisplayOrder" as TCategories
    component "menu_items\nid, restaurantId, name, price\ncategoryId, status, imageUrl, tags" as TMenuItems
    component "modifier_groups / modifier_options\nselection bounds, option price\navailability, displayOrder" as TModifiers
  }

  package "IMAGE" #CCFBF1 {
    component "images\nid, publicId, secureUrl\nwidth, height, createdAt" as TImages
  }

  package "ORDERING" #FEF3C7 {
    component "orders\nid, customerId, restaurantId\nstatus, totalAmount, version\nshipperId, expiresAt" as TOrders
    component "order_items\nid, orderId, menuItemId\nitemName, unitPrice\nquantity, modifiers, subtotal" as TOrderItems
    component "order_status_logs\nid, orderId, fromStatus\ntoStatus, triggeredByRole\nnote, createdAt" as TStatusLogs
    component "app_settings\nkey, value, timestamps" as TAppSettings
    component "ordering_restaurant_snapshots\nrestaurantId, ownerId, name\nisOpen, isApproved" as TORestSnapshots
    component "ordering_menu_item_snapshots\nmenuItemId, restaurantId\nname, price, status" as TOMenuSnapshots
    component "ordering_delivery_zone_snapshots\nzoneId, restaurantId, radiusKm\nfees, prep/buffer minutes" as TOZoneSnapshots
  }

  package "PAYMENT" #DDD6FE {
    component "payment_transactions\nid, orderId, customerId\namount, status, providerTxnId\nrawIpnPayload, expiresAt, version" as TPayments
  }

  package "PROMOTION" #E9D5FF {
    component "promotions\nid, scope, status, trigger\ndiscountValue, usage caps, version" as TPromotions
    component "coupon_codes\nid, promotionId, code\nstatus, maxUses, currentUses" as TCoupons
    component "promotion_usages\nid, promotionId, orderId\ncustomerId, discountAmount, status" as TPromotionUsages
  }

  package "NOTIFICATION" #99F6E4 {
    component "notifications\nid, recipientId, type, channel\nstatus, isRead, idempotencyKey\norderId, expiresAt" as TNotifications
    component "notification_preferences\nuserId, channel, enabled\nquiet hours" as TPreferences
    component "device_tokens\nuserId, token, platform\nlastSeenAt" as TDeviceTokens
    component "notification_delivery_logs\nid, notificationId, channel\nstatus, attemptNumber, error" as TDeliveryLogs
    component "notification_restaurant_snapshots\nrestaurantId, ownerId, name" as TNRestSnapshots
  }

  package "REVIEW_RATING target" #E0F2FE {
    component "reviews\nid, orderId, customerId\ntargetType, targetId, rating\ncomment, moderationStatus" as TReviews
    component "ratings\ntargetType, targetId\navgRating, reviewCount" as TRatings
  }
}

database "Redis" as RedisData #FDE68A {
  component "cart:{customerId}\nitems, restaurantId, totals" as RCart
  component "cart:{customerId}:lock\ncheckout lock" as RLocks
  component "idempotency:order:{key}\norder response cache" as RIdempotency
  component "ws:connections:{userId}\npresence ref-count" as RPresence
  component "rate-limit buckets\nedge/module target" as RRateLimit
}

cloud "External Data Owners" as External #F5F3FF {
  component "VNPay\ngateway transaction refs" as EVNPay
  component "Cloudinary\nimage bytes" as ECloudinary
  component "FCM\ndevice delivery" as EFCM
  component "SMTP\nemail delivery" as ESMTP
}

DAuth --> TAuth
DCatalog --> TRestaurants
DCatalog --> TZones
DCatalog --> TCategories
DCatalog --> TMenuItems
DCatalog --> TModifiers
DImage --> TImages
DImage --> ECloudinary
DOrdering --> TOrders
DOrdering --> TOrderItems
DOrdering --> TStatusLogs
DOrdering --> TAppSettings
DOrdering --> TORestSnapshots
DOrdering --> TOMenuSnapshots
DOrdering --> TOZoneSnapshots
DOrdering --> RCart
DOrdering --> RLocks
DOrdering --> RIdempotency
DPayment --> TPayments
DPayment --> EVNPay
DPromotion --> TPromotions
DPromotion --> TCoupons
DPromotion --> TPromotionUsages
DNotification --> TNotifications
DNotification --> TPreferences
DNotification --> TDeviceTokens
DNotification --> TDeliveryLogs
DNotification --> TNRestSnapshots
DNotification --> RPresence
DNotification --> EFCM
DNotification --> ESMTP
DReview ..> TReviews
DReview ..> TRatings
DReview ..> TOrders : orderId UUID reference
RRateLimit ..> DAuth
RRateLimit ..> DCatalog
@enduml
```

Focuses on data ownership and storage strategy.

Primary Storage:

ーPostgreSQL is one physical database for the modular monolith, but table groups are owned as if each bounded context could later be extracted into an independent service database.

ーAuth owns Better Auth identity/session tables.

ーRestaurant Catalog owns restaurants, delivery zones, menu categories, menu items, modifier groups, and modifier options.

ーImage owns the `images` table and Cloudinary public identifiers. Cloudinary owns image bytes.

ーOrdering owns orders, order items, order status logs, runtime app settings, and Ordering ACL snapshot tables for restaurant/menu/delivery-zone reads.

ーPayment owns payment transactions and stores gateway references, raw IPN payloads, status, expiry, and optimistic-lock version data.

ーPromotion owns promotions, coupon codes, and promotion usage/reservation rows.

ーNotification owns notifications, preferences, device tokens, delivery logs, and notification-specific restaurant snapshots.

ーReview & Rating owns review/rating records as a target data contract derived from the SRS/BRD. The current Drizzle schema does not export review tables, so this group is documented as a separate future extractable ownership boundary rather than as implemented storage.

ーRedis stores short-lived and high-churn state: carts, checkout locks, idempotency keys, WebSocket presence, and future rate-limit buckets.

ーExternal providers own data outside the platform database: VNPay payment authority, Cloudinary image bytes, FCM push delivery, and SMTP delivery.

Security Measures:

ーAll client-server and provider traffic is encrypted using HTTPS/TLS.

ーSecrets are injected through environment variables validated at startup by Zod.

ーPasswords are handled by Better Auth with scrypt hashing.

ーRBAC uses `admin`, `restaurant`, `shipper`, and `user` roles with service-level ownership checks.

ーCross-context identifiers are stored as UUID references to preserve bounded-context autonomy and database-per-service readiness.

ーDrizzle parameterized queries protect database access from SQL injection.

ーNotification rooms are server-assigned from validated sessions and scoped as `room:user:{userId}`.

ーPayment signatures are verified before database lookup or mutation.

ーOrder, payment, promotion, and notification state changes are audited through append-only or lifecycle tables.
