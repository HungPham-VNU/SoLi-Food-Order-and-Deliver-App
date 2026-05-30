# Slide 55 — QA-S-02 Authentication & Session Management

**Source:** `ADD_FoodDelivery.md` § 2.4.2.

| Element               | Description                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Stimulus              | User sign-in / session validation                                                                                        |
| Stimulus Source       | Customer, restaurant, shipper, admin                                                                                     |
| Environment           | Public endpoints                                                                                                         |
| Artifact              | Better Auth + Drizzle adapter ([lib/auth.ts](../../src/lib/auth.ts)); `session`, `account`, `verification` tables        |
| Response              | Strong session token issued; bearer token validated server-side on each request                                          |
| Response Measure      | Industry-standard password hashing (Better Auth default — scrypt); session secret ≥ 32 chars enforced at startup via Zod |
| Architectural Tactics | Library-managed credential handling; HTTPS-only deployment (deployment constraint); no custom rolling of crypto          |

---

# Slide 56 — QA-S-03 Role-Based Authorization

**Source:** `ADD_FoodDelivery.md` § 2.4.3.

| Element               | Description                                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stimulus              | Unauthorized actor accesses an admin / restaurant / shipper endpoint                                                                                           |
| Stimulus Source       | Any client                                                                                                                                                     |
| Environment           | Any                                                                                                                                                            |
| Artifact              | `user.role` (multi-role CSV); [`hasRole()`](../../src/module/auth/role.util.ts) utility; route guards                                                          |
| Response              | 401 (no session) / 403 (insufficient role); unauthorized attempts observable through server/access logs; order lifecycle mutations write persistent audit rows |
| Response Measure      | Protected endpoints deny missing or mismatched roles before service-layer mutation                                                                             |
| Architectural Tactics | Multi-role bitmap-equivalent (CSV) checked via OR-logic helper; Better Auth `admin()` plugin for admin scoping                                                 |

---

# Slide 57 — QA-S-05 Input Validation & Injection Resistance

**Source:** `ADD_FoodDelivery.md` § 2.4.5.

| Element          | Description                                                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stimulus         | Client submits malformed DTO fields or HTML / JS payloads in catalog, cart, order, promotion, or notification requests                                   |
| Stimulus Source  | Authenticated or public client                                                                                                                           |
| Environment      | Any                                                                                                                                                      |
| Artifact         | Global `ValidationPipe({ transform: true })` in [main.ts](../../src/main.ts); class-validator DTOs                                                       |
| Response         | DTO validation rejects malformed payloads; Drizzle parameterization protects database access; stored review-text sanitization remains planned with UC-22 |
| Response Measure | Invalid DTO payloads rejected before service-layer mutation; SQL injection prevented by Drizzle parameterized queries                                    |

---

# Slide 58 — QA-S-06 Rate Limiting on Public Endpoints

**Source:** `ADD_FoodDelivery.md` § 2.4.6.

| Element               | Description                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| Stimulus              | Burst of unauthenticated requests on login, register, or search endpoints                             |
| Stimulus Source       | Attacker / abusive client                                                                             |
| Environment           | Production                                                                                            |
| Artifact              | Reverse proxy (planned) or `@nestjs/throttler` (not yet integrated)                                   |
| Response              | Excess requests throttled with 429                                                                    |
| Response Measure      | ≤ 100 req/min/IP for login; ≤ 300 req/min/IP for catalog                                              |
| Architectural Tactics | Edge-layer throttling (nginx / cloud LB) OR module-level throttler; not yet implemented in `apps/api` |

---

# Slide 59 — QA-SC-01 Horizontal Scaling of API Instances

**Source:** `ADD_FoodDelivery.md` § 2.5.1.

| Element               | Description                                                                                                                                                                                                                                                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stimulus              | Browse / search traffic and active notification sessions grow beyond the single-instance baseline during peak hour                                                                                                                                                                                                                                   |
| Stimulus Source       | Aggregate customer traffic and active WebSocket sessions                                                                                                                                                                                                                                                                                             |
| Environment           | Peak hour                                                                                                                                                                                                                                                                                                                                            |
| Artifact              | Stateless NestJS API instances behind a load balancer (planned deployment topology); PostgreSQL primary                                                                                                                                                                                                                                              |
| Response              | Additional API instances can absorb stateless HTTP traffic; WebSocket fan-out requires sticky sessions or a Socket.IO Redis adapter before true multi-instance delivery correctness                                                                                                                                                                  |
| Response Measure      | Architecture target: p95 search response ≤ 2 s for stateless HTTP traffic; formal load testing and per-instance CPU thresholds remain pending validation                                                                                                                                                                                             |
| Architectural Tactics | Stateless HTTP design (no in-memory session); Redis-shared cart, idempotency, and presence; database connection pooling; WebSocket room membership remains process-local in the current gateway                                                                                                                                                      |
| Constraint            | **In-process synchronous EventBus** assumes all participating modules live inside the same application instance. Replicated full-instance scaling behind a load balancer remains valid for the modular monolith, but separating publishers and listeners into different deployables would require an external broker before that topology is viable. |

---

# Slide 60 — QA-SC-02 Cart and Idempotency Storage Scaling

**Source:** `ADD_FoodDelivery.md` § 2.5.2.

| Element               | Description                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| Stimulus              | High concurrent cart mutation / order submission                                                         |
| Stimulus Source       | Customer fleet                                                                                           |
| Environment           | Peak                                                                                                     |
| Artifact              | Redis service/instance accessed through an `ioredis` client with capped backoff retry                    |
| Response              | Cart writes complete in O(1) per key; idempotency lookup is O(1)                                         |
| Response Measure      | Target p95 cart operation ≤ 50 ms; benchmark validation remains operational work                         |
| Architectural Tactics | Per-customer cart key; per-idempotency-key set with TTL; lazy-connect + capped exponential backoff retry |

---

# Slide 61 — QA-FL-01 Generalizing Payment Provider Integration

**Source:** `ADD_FoodDelivery.md` § 2.6.1.

| Element               | Description                                                                                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stimulus              | Add a non-VNPay payment provider (e.g., MoMo, ZaloPay)                                                                                                                                                        |
| Stimulus Source       | Product roadmap                                                                                                                                                                                               |
| Environment           | Development                                                                                                                                                                                                   |
| Artifact              | `IPaymentInitiationPort` ([payment-initiation.port.ts](../../src/shared/ports/payment-initiation.port.ts)); Payment module                                                                                    |
| Response              | Ordering is decoupled from the concrete Payment service, but the current port method is VNPay-specific (`initiateVNPayPayment`) and must be generalized before adding MoMo / ZaloPay without Ordering changes |
| Response Measure      | Current state: zero concrete Payment imports in `module/ordering`; target state: provider-neutral initiation contract and provider-selection tests                                                            |
| Architectural Tactics | Ports & Adapters boundary exists; provider strategy and payment-method-neutral port are planned                                                                                                               |

---

# Slide 62 — QA-FL-02 Adding a New Order Status

**Source:** `ADD_FoodDelivery.md` § 2.6.2.

| Element          | Description                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stimulus         | Add a new lifecycle status (e.g., `awaiting_courier`)                                                                                             |
| Stimulus Source  | Operations roadmap                                                                                                                                |
| Environment      | Development                                                                                                                                       |
| Artifact         | `order.schema.ts` enum; `TRANSITIONS` map; notification handlers                                                                                  |
| Response         | New status added to enum, transition matrix, and audit log writer                                                                                 |
| Response Measure | Required changes are concentrated in the order enum, transition map, and notification mapping; transition-matrix tests are recommended validation |

---

# Slide 63 — QA-FL-03 Replacing a Notification Channel Provider

**Source:** `ADD_FoodDelivery.md` § 2.6.3.

| Element          | Description                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Stimulus         | Replace FCM with another push provider                                                                                          |
| Stimulus Source  | Operations / cost decision                                                                                                      |
| Environment      | Development                                                                                                                     |
| Artifact         | `PushProvider` interface ([push-provider.interface.ts](../../src/module/notification/channels/push/push-provider.interface.ts)) |
| Response         | New adapter added; module factory rebinds the token                                                                             |
| Response Measure | Zero changes in event handlers or domain code                                                                                   |

---

# Slide 64 — QA-I-01 VNPay Gateway Integration

**Source:** `ADD_FoodDelivery.md` § 2.7.1.

| Element          | Description                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| Stimulus         | Customer pays online                                                                                         |
| Stimulus Source  | Customer / VNPay return + IPN callbacks                                                                      |
| Environment      | Public Internet                                                                                              |
| Artifact         | [VNPayService](../../src/module/payment/services/vnpay.service.ts); `vnp_*` parameters; `crypto` HMAC-SHA512 |
| Response         | Payment URL generated; return + IPN parsed; signed correctly; result persisted                               |
| Response Measure | Conformance to VNPay spec is verifiable through sandbox/manual tests for signature, ordering, and encoding   |

---

# Slide 65 — QA-I-02 Push Notification Multi-Channel Dispatch

**Source:** `ADD_FoodDelivery.md` § 2.7.2.

| Element          | Description                                                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stimulus         | NotificationService persists a notification row from a domain-event handler                                                                                          |
| Stimulus Source  | Cross-BC event handlers                                                                                                                                              |
| Environment      | Customer in foreground / background / offline                                                                                                                        |
| Artifact         | [ChannelDispatcherService](../../src/module/notification/services/channel-dispatcher.service.ts); `InAppChannelService`, `EmailChannelService`, `PushChannelService` |
| Response         | Channels chosen by user preferences and presence; each channel delivers independently                                                                                |
| Response Measure | Delivery attempts are recorded in `notification_delivery_logs`; provider success-rate targets require operational monitoring                                         |

---

# Slide 66 — QA-I-03 Image Upload via Cloudinary

**Source:** `ADD_FoodDelivery.md` § 2.7.3.

| Element          | Description                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| Stimulus         | Restaurant uploads a menu-item image                                                                       |
| Stimulus Source  | Restaurant management client                                                                               |
| Environment      | Normal                                                                                                     |
| Artifact         | [Cloudinary provider](../../src/module/image/cloudinary.provider.ts); signed upload                        |
| Response         | Image uploaded to Cloudinary; URL persisted in `images` table                                              |
| Response Measure | Target upload latency p95 ≤ 5 s for images ≤ 2 MB; actual latency depends on Cloudinary/network conditions |

---

# Slide 67 — QA-SUP-01 Audit Trail for Order Lifecycle

**Source:** `ADD_FoodDelivery.md` § 2.8.1.

| Element          | Description                                                                        |
| ---------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Stimulus         | Any order status transition                                                        |
| Stimulus Source  | Any actor                                                                          |
| Environment      | Any                                                                                |
| Artifact         | `order_status_logs` table                                                          |
| Response         | One row per transition: `{orderId, fromStatus, toStatus, triggeredBy (UUID         | null), triggeredByRole, note, createdAt}`; `fromStatus` is nullable for the initial creation entry |
| Response Measure | 100 % of committed transitions audited; queryable by orderId, actor, or time range |

---

# Slide 68 — QA-SUP-02 Structured Logging on Cross-BC Events

**Source:** `ADD_FoodDelivery.md` § 2.8.2.

| Element          | Description                                                                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stimulus         | An event handler fails (e.g., ACL projection error, channel dispatch error)                                                                                                                          |
| Stimulus Source  | Internal                                                                                                                                                                                             |
| Environment      | Production                                                                                                                                                                                           |
| Artifact         | NestJS `Logger`; handler-specific failure policies in `@EventsHandler` classes                                                                                                                       |
| Response         | Error logged at ERROR level with context (`eventType`, `aggregateId`); notification and refund handlers absorb failures, while ACL projectors currently log and rethrow after failed snapshot writes |
| Response Measure | Handler failures are logged with contextual IDs; ≤ 5 minute detection requires active log monitoring until APM is integrated                                                                         |
| Gap              | No central log aggregation or correlation IDs in the implemented baseline; APM / OpenTelemetry is future work                                                                                        |

---

# Slide 69 — QA-SUP-03 Stuck-Order Diagnostics

**Source:** `ADD_FoodDelivery.md` § 2.8.3.

| Element          | Description                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Stimulus         | An order remains in a non-terminal status beyond a configured threshold                                                         |
| Stimulus Source  | Scheduler                                                                                                                       |
| Environment      | Production                                                                                                                      |
| Artifact         | Future diagnostic task and admin monitoring surface; current `OrderTimeoutTask` only auto-cancels expired pending / paid orders |
| Response         | Order flagged with a reason code and surfaced on the admin monitoring view                                                      |
| Response Measure | Detection latency ≤ 1 minute past threshold                                                                                     |

---

# Slide 70 — QA-MA-01 Bounded-Context Boundary Enforcement

**Source:** `ADD_FoodDelivery.md` § 2.9.1.

| Element          | Description                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Stimulus         | A developer attempts to import a Payment / Promotion concrete class into Ordering                                              |
| Stimulus Source  | Pull request                                                                                                                   |
| Environment      | Development                                                                                                                    |
| Artifact         | Ports (`PAYMENT_INITIATION_PORT`, `PROMOTION_APPLICATION_PORT`); ACL snapshot tables                                           |
| Response         | The compiler permits it, but architectural reviews / planned ESLint boundary rules forbid it; only the port symbol is imported |
| Response Measure | Zero cross-BC concrete imports in `module/ordering` (verified by grep / planned ESLint rule)                                   |
