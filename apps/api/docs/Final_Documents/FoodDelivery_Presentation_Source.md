# FoodDelivery_Presentation_Source

> Slide-ready source for downstream slide generation. Content is sourced strictly from `BRD.md`, `ADR_FoodDelivery.md`, `ADD_FoodDelivery.md`, and `gof-design-pattern-audit-report.md`. No invention, no enrichment, no extra QA, ADR, diagrams, or implementation explanation. Each slide is explicitly numbered.

---

# Slide 1 — Project Overview

**Source:** `BRD.md` § 1 Introduction.

- **Platform.** SoLi Food Delivery Platform — a multi-role marketplace connecting customers, restaurant partners, delivery personnel, and platform administrators.
- **Actors (key roles glossary):**
  - Customer
  - Restaurant Partner
  - Delivery Personnel / Shipper
  - Administrator
- **Release 1 scope (target):**
  - Customer registration, authentication, restaurant discovery, cart, checkout, order history, status tracking
  - Restaurant partner onboarding, approval, menu management, availability control, order reception
  - Delivery personnel onboarding, availability, pickup, delivery progress, delivery confirmation
  - Administrator account governance, partner approval, operational oversight, order intervention, reporting
  - Payment via Cash on Delivery (COD) and VNPay
  - Review and rating baseline after delivery
  - Order-related notification capability across participant roles

---

# Slide 2 — Context Diagram

**Source:** `BRD.md` § 4.1 Context Diagram (Figure 1 — *Business context diagram - roles and external business services*).

- **Platform Participants:** Customer · Restaurant Partner · Delivery Personnel · Administrator.
- **Core Platform:** SoLi Food Delivery Platform.
- **External Integrations:**
  - VNPay Gateway — payment & callback (Release 1)
  - MoMo — digital wallet (Release 2)
  - Maps & Geolocation — address & zone (Release 1)
  - Push & Email Providers — notifications (Release 1)
  - Image Asset Provider — media storage (Release 1)
- **Participant ↔ Platform flows:**
  - Customer → browse · order · pay · track · review
  - Restaurant Partner → menu · availability · orders
  - Delivery Personnel → availability · pickup · delivery
  - Administrator → approval · governance · reports

**Diagram reference:** `apps/api/docs/Final_Documents/BRD.md` § 4.1 (Mermaid `flowchart LR`).

---

# Slide 3 — ADR-001 Problem

**Source:** `ADR_FoodDelivery.md` — ADR-001 *Adopt Modular Monolith Architecture*, Problem / Context.

SoLi Food Delivery is a multi-role marketplace for customers, restaurant owners, shippers, administrators, and developers. The system must support restaurant discovery, cart and checkout, VNPay payment, order lifecycle, promotion application, notifications, image management, and platform governance while remaining understandable for a course-scale and product-scale team.

The architecture issue is choosing a deployment and modularity style that protects domain boundaries while avoiding distributed-systems overhead during the current product stage.

---

# Slide 4 — ADR-001 Option A — Layered Monolith

**Source:** `ADR_FoodDelivery.md` — ADR-001 § Candidate Solutions / Option A.

**Description.** A single application organized primarily by technical layers such as controllers, services, repositories, DTOs, and database models.

**Pros**
- Simple to start and easy for small teams to understand.
- One deployment unit and one local development flow.
- Low operational overhead compared with distributed services.

**Cons**
- Domain ownership becomes blurry as Ordering, Payment, Catalog, Notification, and Promotion logic grow.
- Cross-domain imports are easy to introduce because package boundaries follow technical layers rather than business capability.
- Changes to high-risk workflows such as checkout and payment can spread across shared service layers.

---

# Slide 5 — ADR-001 Option B — Microservices

**Source:** `ADR_FoodDelivery.md` — ADR-001 § Candidate Solutions / Option B.

**Description.** Split Auth, Catalog, Ordering, Payment, Promotion, Notification, Review, and Governance into independently deployed services with separate runtime processes and service-to-service communication.

**Pros**
- Strong physical isolation between bounded contexts.
- Independent deployment and scaling per service.
- Natural path for separate ownership when teams become large.

**Cons**
- Requires message broker, service discovery, deployment automation, distributed tracing, API contracts, network retry policy, and operational maturity.
- Checkout would need distributed consistency patterns across Ordering, Payment, Promotion, Notification, and Catalog snapshots.
- Local development and testing would be heavier than the current CI and Docker setup.

---

# Slide 6 — ADR-001 Option C — Modular Monolith *(Selected)*

**Source:** `ADR_FoodDelivery.md` — ADR-001 § Candidate Solutions / Option C.

**Description.** Keep one backend deployable while organizing the code by bounded contexts, module-owned schemas, in-process events, ACL snapshots, and dependency-inversion ports.

**Pros**
- Preserves a simple deployment topology while providing domain-oriented boundaries.
- Keeps cross-context workflows local and testable in one process.
- Supports horizontal scaling by replicating the full stateless API instance behind a load balancer.
- Matches the implemented NestJS module structure and the ADD Implementation View.

**Cons**
- Module boundaries require discipline, review, and boundary checks because they are logical rather than process-enforced.
- All contexts scale together as one API runtime.
- In-process events require all event publishers and handlers to run in the same application instance.

---

# Slide 7 — ADR-002 Problem

**Source:** `ADR_FoodDelivery.md` — ADR-002 *Adopt Boundary Context Separation*, Problem / Context.

The Food Delivery domain has distinct responsibilities: identity and sessions, restaurant and menu catalog, image metadata and Cloudinary uploads, cart and order lifecycle, payment lifecycle, promotion rules, notifications, review and rating, and platform governance. These concerns change for different reasons and are owned by different business concepts.

The architecture issue is how to decompose the backend so that business concepts remain coherent as the product grows.

---

# Slide 8 — ADR-002 Option A — Technical Layer Separation

**Source:** `ADR_FoodDelivery.md` — ADR-002 § Candidate Solutions / Option A.

**Description.** Organize code by generic technical layers such as all controllers, all services, all repositories, and all schemas.

**Pros**
- Familiar structure for simple CRUD systems.
- Reuse of technical patterns is visible in one place.
- Easy to scaffold early endpoints.

**Cons**
- Ordering logic can easily depend on concrete Catalog, Payment, or Promotion classes.
- Business vocabulary fragments because files are grouped by technology rather than domain ownership.
- High-risk workflow changes become harder to review because they span generic folders.

---

# Slide 9 — ADR-002 Option B — Feature-by-UI or Endpoint Separation

**Source:** `ADR_FoodDelivery.md` — ADR-002 § Candidate Solutions / Option B.

**Description.** Organize backend modules around screen flows or API endpoints, such as checkout page, dashboard page, menu management page, and notifications page.

**Pros**
- Aligns quickly with frontend delivery tasks.
- Makes a single user workflow easy to locate.
- Can reduce short-term coordination between frontend and backend.

**Cons**
- Shared business concepts such as Order, Restaurant, Payment, and Promotion become duplicated across features.
- Backend ownership shifts whenever UI screens change.
- Cross-cutting workflows such as payment confirmation, refunds, and notifications cut across many feature folders.

---

# Slide 10 — ADR-002 Option C — Bounded Context Separation *(Selected)*

**Source:** `ADR_FoodDelivery.md` — ADR-002 § Candidate Solutions / Option C.

**Description.** Organize backend modules around business capabilities: Auth, Restaurant Catalog, Image, Ordering, Payment, Promotion, Notification, Review & Rating, and Admin/Governance.

**Pros**
- Aligns code ownership with business vocabulary and SRS domains.
- Keeps invariants near the module that owns them, such as order transitions in Ordering and payment verification in Payment.
- Enables ports, events, and ACL snapshots as explicit cross-context contracts.
- Supports modular-monolith evolution without requiring immediate service extraction.

**Cons**
- Requires careful contract design between contexts.
- Some workflows need more explicit integration code than direct shared-service calls.
- Review and Governance contexts must remain aligned with implemented surfaces and documented contracts.

---

# Slide 11 — ADR-003 Problem

**Source:** `ADR_FoodDelivery.md` — ADR-003 *Use Database per BC Ownership*, Problem / Context.

The platform needs durable persistence for users, sessions, restaurants, menus, images, orders, order items, order status logs, ACL snapshots, payments, promotions, notifications, preferences, devices, and delivery logs. These data groups belong to different bounded contexts, but the selected architecture is a modular monolith rather than distributed services.

The architecture issue is balancing data consistency, module ownership, and operational simplicity.

---

# Slide 12 — ADR-003 Option A — Shared Database with Unrestricted Cross-Module Access

**Source:** `ADR_FoodDelivery.md` — ADR-003 § Candidate Solutions / Option A.

**Description.** All modules use one database and can freely join or mutate tables owned by any module.

**Pros**
- Very simple to query.
- Easy to enforce referential constraints globally.
- Minimal data duplication.

**Cons**
- Module boundaries collapse at the database layer.
- Ordering could rely on Catalog table details, making Catalog changes risky.
- Business ownership becomes ambiguous when multiple modules write the same table group.

---

# Slide 13 — ADR-003 Option B — Physical Database per Service or Context

**Source:** `ADR_FoodDelivery.md` — ADR-003 § Candidate Solutions / Option B.

**Description.** Each bounded context owns a separate physical database, even while the backend remains one codebase.

**Pros**
- Strongest persistence isolation.
- Clear data ownership enforced by infrastructure.
- Easier service extraction for contexts that already have isolated storage.

**Cons**
- Cross-context workflows require distributed consistency patterns, replication, or broker-backed events.
- Local development, CI, migrations, backup, and reporting become significantly more complex.
- Checkout and payment flows would need more coordination for a product that currently fits one deployable.

---

# Slide 14 — ADR-003 Option C — Single PostgreSQL with Database per BC Ownership *(Selected)*

**Source:** `ADR_FoodDelivery.md` — ADR-003 § Candidate Solutions / Option C.

**Description.** Use one PostgreSQL database while assigning table groups to bounded contexts. Contexts own their schemas and expose data through repositories, snapshots, ports, or events. Cross-context references are stored as IDs or immutable snapshots where appropriate.

**Pros**
- Fits the modular monolith deployment model.
- Keeps transactions local for high-risk workflows such as order creation.
- Preserves clear ownership through module-scoped schema files.
- Simplifies CI and deployment through one PostgreSQL service.

**Cons**
- Ownership is logical and must be enforced by convention, review, and tooling.
- Reporting queries can be tempted to bypass module boundaries.
- Some read models are duplicated as snapshots to protect runtime boundaries.

---

# Slide 15 — ADR-004 Problem

**Source:** `ADR_FoodDelivery.md` — ADR-004 *Use In-process EventBus Communication*, Problem / Context.

Several workflows need cross-context reactions after business state changes. Restaurant Catalog publishes menu, restaurant, and delivery-zone updates so Ordering and Notification can refresh snapshots. Ordering publishes order placement and lifecycle changes so Notification, Payment, Promotion, Review, and Governance concerns can react. Payment publishes payment confirmed or failed events after VNPay IPN processing. Promotion participates in reservation and rollback behavior around checkout and cancellation.

The architecture issue is selecting an integration mechanism that decouples modules without adding distributed infrastructure.

---

# Slide 16 — ADR-004 Option A — Direct Service Calls Between Modules

**Source:** `ADR_FoodDelivery.md` — ADR-004 § Candidate Solutions / Option A.

**Description.** When Catalog, Ordering, Payment, or Promotion changes state, it directly invokes services in the other contexts that need to react.

**Pros**
- Straightforward control flow and debugging.
- Immediate success/failure feedback from downstream actions.
- No event handler registration required.

**Cons**
- Creates concrete cross-BC dependencies and circular module risk.
- Publisher modules must know all subscribers.
- Non-critical side effects can block critical state changes.

---

# Slide 17 — ADR-004 Option B — External Message Broker

**Source:** `ADR_FoodDelivery.md` — ADR-004 § Candidate Solutions / Option B.

**Description.** Publish domain events to Kafka, RabbitMQ, NATS, SQS, or similar infrastructure for asynchronous subscribers.

**Pros**
- Decouples runtime processes.
- Enables durable asynchronous delivery and service extraction.
- Supports retries, buffering, and independent consumers.

**Cons**
- Requires broker operations, schema governance, dead-letter handling, idempotent consumers, and monitoring.
- Adds eventual consistency and operational complexity to checkout and payment flows.
- Heavier than necessary for a single deployable modular monolith.

---

# Slide 18 — ADR-004 Option C — In-process EventBus *(Selected)*

**Source:** `ADR_FoodDelivery.md` — ADR-004 § Candidate Solutions / Option C.

**Description.** Use NestJS CQRS EventBus inside the same process. Publishers emit domain events after state changes; handlers update snapshots, notifications, lifecycle state, or compensation state.

**Pros**
- Decouples publisher and subscriber code inside one deployable.
- Keeps event flow fast and testable without external infrastructure.
- Supports fan-out, as seen with RestaurantUpdatedEvent consumed by both Ordering and Notification ACL projectors.
- Matches the modular monolith and CI setup.

**Cons**
- Events are not durable once the process terminates.
- Publishers and handlers must run in the same application instance.
- Handler failure policies must be explicit because they run in-process.

---

# Slide 19 — ADR-005 Problem

**Source:** `ADR_FoodDelivery.md` — ADR-005 *Adopt ACL Snapshot Pattern*, Problem / Context.

Ordering must validate restaurant approval/open status, menu item availability, prices, modifiers, and delivery zones during checkout. Notification must know restaurant owner routing information to send restaurant-related messages. These data items are owned by Restaurant Catalog, not Ordering or Notification.

The architecture issue is how a context can consume another context's data without owning it or coupling to its internals.

---

# Slide 20 — ADR-005 Option A — Direct Cross-BC Joins

**Source:** `ADR_FoodDelivery.md` — ADR-005 § Candidate Solutions / Option A.

**Description.** Ordering directly joins Catalog tables at checkout, and Notification directly queries Catalog tables when routing notifications.

**Pros**
- Always reads the latest Catalog database state.
- Fewer duplicated tables.
- Simple SQL for one physical database.

**Cons**
- Ordering becomes dependent on Catalog table structure.
- Catalog schema changes can break checkout.
- Violates BC data ownership by encouraging read coupling across modules.

---

# Slide 21 — ADR-005 Option B — Runtime Service Calls to Source BC

**Source:** `ADR_FoodDelivery.md` — ADR-005 § Candidate Solutions / Option B.

**Description.** Ordering calls RestaurantService, MenuService, or ZoneService at checkout; Notification calls Catalog services during event handling.

**Pros**
- Preserves source BC as the runtime authority.
- Avoids snapshot duplication.
- Keeps business validation close to the owning service.

**Cons**
- Adds synchronous cross-module calls to the critical checkout path.
- Can create circular dependencies between modules.
- Availability or latency issues in a non-owning context can block checkout.

---

# Slide 22 — ADR-005 Option C — ACL Snapshot Pattern *(Selected)*

**Source:** `ADR_FoodDelivery.md` — ADR-005 § Candidate Solutions / Option C.

**Description.** Source contexts publish domain events; consuming contexts store local read models containing only fields they need for their own decisions.

**Pros**
- Checkout reads local Ordering-owned snapshot tables, improving performance and reliability.
- Consumers depend on stable event contracts instead of source table internals.
- Snapshot contents can be minimal and tailored per consumer.
- Supports idempotent replay through upsert behavior.

**Cons**
- Snapshot staleness must be managed through event propagation and monitoring.
- More tables and projectors exist than in direct-query designs.
- Event payloads become part of the architecture contract.

---

# Slide 23 — ADR-006 Problem

**Source:** `ADR_FoodDelivery.md` — ADR-006 *Use Redis Runtime Layer*, Problem / Context.

The platform needs low-latency runtime state for carts, checkout coordination, idempotency, WebSocket presence, unread-count caching, and rate-limit windows. This state is operationally important but differs from durable business truth stored in PostgreSQL.

The architecture issue is choosing where to place fast-changing runtime state without overloading PostgreSQL or relying on per-process memory.

---

# Slide 24 — ADR-006 Option A — PostgreSQL-Only Runtime State

**Source:** `ADR_FoodDelivery.md` — ADR-006 § Candidate Solutions / Option A.

**Description.** Store carts, idempotency keys, locks, presence, and rate-limit counters in PostgreSQL tables.

**Pros**
- One data store for all state.
- Strong durability and SQL queryability.
- Backup and operations are consolidated.

**Cons**
- Higher write overhead for high-frequency mutable state such as carts and presence heartbeats.
- Locks and TTL cleanup require extra schema and jobs.
- Presence and rate-limit windows are less natural in relational tables.

---

# Slide 25 — ADR-006 Option B — In-Memory Process State

**Source:** `ADR_FoodDelivery.md` — ADR-006 § Candidate Solutions / Option B.

**Description.** Store carts, locks, idempotency, presence, and counters inside the NestJS process memory.

**Pros**
- Fastest local access.
- No additional infrastructure.
- Simple for a single development instance.

**Cons**
- State is lost on restart.
- Multiple API instances cannot share state.
- Idempotency, cart consistency, and WebSocket presence become unreliable under horizontal scaling.

---

# Slide 26 — ADR-006 Option C — Redis Runtime Layer *(Selected)*

**Source:** `ADR_FoodDelivery.md` — ADR-006 § Candidate Solutions / Option C.

**Description.** Use Redis / Valkey for volatile, TTL-based, shared runtime state while PostgreSQL remains the durable business store.

**Pros**
- O(1) key-based cart, idempotency, lock, and presence operations.
- TTL semantics match carts, session-like presence, checkout locks, and retry windows.
- Shared across replicated API instances.
- Supports atomic primitives such as SET NX, INCR, DECR, EXPIRE, and sorted sets.

**Cons**
- Requires another infrastructure service and availability monitoring.
- Redis data model is less self-describing than relational tables.
- Code must handle Redis errors gracefully where state is advisory.

---

# Slide 27 — ADR-007 Problem

**Source:** `ADR_FoodDelivery.md` — ADR-007 *Use Ports and Adapters Integration Pattern*, Problem / Context.

SoLi integrates with external systems and cross-context capabilities: VNPay for online payment, Cloudinary for image storage, FCM and SMTP for notifications, Better Auth for session handling, and Promotion/Payment business capabilities consumed by Ordering during checkout.

The architecture issue is how domain workflows can use external and cross-context capabilities without becoming coupled to implementation details.

---

# Slide 28 — ADR-007 Option A — Direct Provider SDK Imports in Business Logic

**Source:** `ADR_FoodDelivery.md` — ADR-007 § Candidate Solutions / Option A.

**Description.** Ordering, Catalog, and Notification services directly import SDKs or concrete services such as VNPay, Cloudinary, Firebase, Nodemailer, PaymentService, or PromotionService.

**Pros**
- Very direct and quick to implement.
- Fewer interfaces and DI tokens.
- Easy to trace for one integration.

**Cons**
- Business logic becomes coupled to provider protocols.
- Testing requires provider-specific stubs at many call sites.
- Replacing providers or changing cross-BC contracts forces changes in core workflows.

---

# Slide 29 — ADR-007 Option B — Shared Integration Services

**Source:** `ADR_FoodDelivery.md` — ADR-007 § Candidate Solutions / Option B.

**Description.** Create shared services such as PaymentGatewayService, StorageService, or NotificationProviderService and inject them wherever needed.

**Pros**
- Centralizes provider code.
- Reduces duplicate SDK usage.
- Easier than fully defined ports for simple integrations.

**Cons**
- Shared services can become cross-domain utility hubs with unclear ownership.
- Business contexts may still depend on concrete methods shaped by provider details.
- Harder to express which context owns a capability, especially Payment and Promotion.

---

# Slide 30 — ADR-007 Option C — Ports and Adapters *(Selected)*

**Source:** `ADR_FoodDelivery.md` — ADR-007 § Candidate Solutions / Option C.

**Description.** Define ports at domain or shared-contract boundaries and bind concrete adapters in owning modules. Business logic depends on ports; infrastructure and external protocols live behind adapters.

**Pros**
- Ordering depends on Payment and Promotion capabilities, not concrete implementations.
- VNPay, Cloudinary, email, and push provider details stay at adapter boundaries.
- Tests can substitute ports and providers cleanly.
- Supports provider replacement and contract evolution.

**Cons**
- Adds interfaces, symbols, provider binding, and module registration rules.
- Poorly named ports can leak provider-specific vocabulary.
- Requires architecture review to keep ports stable and cohesive.

---

# Slide 31 — ADR-008 Problem

**Source:** `ADR_FoodDelivery.md` — ADR-008 *Adopt Drizzle Type-safe Persistence Layer*, Problem / Context.

The backend needs a persistence layer for PostgreSQL that supports schema ownership by bounded context, explicit SQL visibility, migrations, type safety, transactional checkout, optimistic locking, indexes, uniqueness constraints, and integration with Better Auth.

The architecture issue is selecting a persistence technology that keeps SQL clear, domain schemas close to modules, and type safety high without hiding database behavior.

---

# Slide 32 — ADR-008 Option A — Raw SQL with `pg`

**Source:** `ADR_FoodDelivery.md` — ADR-008 § Candidate Solutions / Option A.

**Description.** Use handwritten SQL strings and the PostgreSQL driver directly for all queries and migrations.

**Pros**
- Maximum SQL control and visibility.
- No ORM abstraction overhead.
- Easy to use database-specific features.

**Cons**
- Manual type mapping is error-prone.
- Refactors can break queries without compile-time feedback.
- Repeated boilerplate for inserts, selects, transactions, and result mapping.

---

# Slide 33 — ADR-008 Option B — Prisma

**Source:** `ADR_FoodDelivery.md` — ADR-008 § Candidate Solutions / Option B.

**Description.** Use Prisma schema, Prisma Client, and Prisma migrations as the ORM and migration system.

**Pros**
- Strong generated client experience.
- Productive relational modeling and query API.
- Mature migration workflow and tooling.

**Cons**
- Prisma schema centralization can pull schema ownership away from module folders.
- Generated abstraction can hide SQL shape more than desired for performance-sensitive paths.
- Some PostgreSQL-specific constructs and custom migration edits can be less direct.

---

# Slide 34 — ADR-008 Option C — Drizzle ORM and Drizzle Kit *(Selected)*

**Source:** `ADR_FoodDelivery.md` — ADR-008 § Candidate Solutions / Option C.

**Description.** Use Drizzle TypeScript schema definitions, typed query builders, Drizzle Kit migrations, and the PostgreSQL driver.

**Pros**
- Schema definitions live near owning modules and remain TypeScript-native.
- SQL-like query builder keeps generated SQL understandable.
- Strong typed inserts/selects reduce mapping errors.
- Supports explicit constraints, indexes, enums, transactions, and migration control.
- Works with Better Auth Drizzle adapter.

**Cons**
- Requires more explicit repository code than high-level ORMs.
- Some advanced migration details may need manual SQL after generation.
- Developers must understand PostgreSQL and Drizzle query semantics.

---

# Slide 35 — Logical View

**Source:** `ADD_FoodDelivery.md` § 3.1 Logical View.

**Short description.** Domain-only view of the modular-monolith NestJS API boundary. Shows nine bounded contexts (Auth, Restaurant Catalog, Image, Ordering, Payment, Promotion, Notification, Review & Rating, Admin/Governance), the two Ordering-defined ports (`PAYMENT_INITIATION_PORT`, `PROMOTION_APPLICATION_PORT`) implemented by Payment and Promotion, and the Domain Events Hub that routes Catalog/Ordering/Payment/Promotion events to Notification, Review, and Governance subscribers. No persistence, infrastructure, or external integration detail is shown at this level.

**Diagram reference:** `ADD_FoodDelivery.md` § 3.1 (PlantUML `SoLi_Logical_View`).

---

# Slide 36 — Implementation View

**Source:** `ADD_FoodDelivery.md` § 3.2 Implementation View.

**Short description.** Module-level implementation architecture inside `apps/api`. Each BC reduces to its controller → service → repository → schema chain with each schema connecting directly to PostgreSQL. Cross-context calls originate from internal components only: `CatalogService` → `ImageService`; `OrderingService` reaches Payment/Promotion through shared ports. Shared Kernel exposes validators, ports, and the Domain Events Hub. External integrations terminate at explicit adapters: `CloudinaryAdapter` (Image), `VNPayAdapter` (Payment), `FCMAdapter` + `SMTPAdapter` (Notification). Redis is used only by `OrderingService` and `NotificationService`.

**Diagram reference:** `ADD_FoodDelivery.md` § 3.2 (PlantUML `SoLi_Implementation_View`).

---

# Slide 37 — Deployment View

**Source:** `ADD_FoodDelivery.md` § 3.3 Deployment View.

**Short description.** Production deployment target per QA-SC-01 and availability scenarios, preserving the modular-monolith constraint. GitHub Actions (`ci.yml` → `validate.yml` → `publish-docker.yml` / `publish-mobile.yml`) builds and publishes API/web images to GHCR; Render deploy hooks pull immutable tags. Render runtime exposes a managed HTTPS edge + load balancer in front of a static web service and an API autoscaling group; every API instance runs the same NestJS image with all BCs loaded. Shared Managed PostgreSQL (durable source of truth) and Managed Redis/Valkey (cart, locks, idempotency, presence, rate-limit). External integrations: VNPay, Cloudinary, FCM, SMTP. WebSocket multi-instance correctness requires sticky sessions or a Socket.IO Redis adapter (target). Rate limiting and APM/Prometheus/Grafana monitoring are planned.

**Diagram reference:** `ADD_FoodDelivery.md` § 3.3 (PlantUML `SoLi_Deployment_View`).

---

# Slide 38 — Data View

**Source:** `ADD_FoodDelivery.md` § 3.4 Data View.

**Short description.** Single physical PostgreSQL database with logical schemas grouped by BC ownership (Auth, Catalog, Image, Ordering, Payment, Promotion, Notification, plus ACL snapshot tables and audit/log tables). Cross-BC references are stored as UUID IDs or immutable snapshot rows rather than as cross-BC foreign keys, reflecting the database-per-BC-ownership decision in ADR-003.

**Diagram reference:** `ADD_FoodDelivery.md` § 3.4 (PlantUML `SoLi_Data_View`).

---

# Slide 39 — QA-P-01 Restaurant Search Response Time

**Source:** `ADD_FoodDelivery.md` § 2.1.1.

| Element            | Description                                                                                                                                                                                                                                                |
|--------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Customer submits a restaurant / item search query                                                                                                                                                                                                          |
| Stimulus Source    | Customer client                                                                                                                                                                                                                                            |
| Environment        | Normal operational load (≤ 1× projected peak)                                                                                                                                                                                                              |
| Artifact           | `restaurant-catalog/search` controller + repository ([search.repository.ts](../../src/module/restaurant-catalog/search/search.repository.ts)); PostgreSQL                                                                                              |
| Response           | First page of results returned with pagination metadata                                                                                                                                                                                                    |
| Response Measure   | p95 ≤ 2 s; page size ≤ 20; results ordered deterministically                                                                                                                                                                                              |
| Architectural Tactics | Paginated queries (`offset`/`limit`); approved/open composite index on restaurants; planned Redis read-through caching for hot queries (Cache-Aside)                                                                                                      |

---

# Slide 40 — QA-P-02 Order Status Propagation to Customer

**Source:** `ADD_FoodDelivery.md` § 2.1.2.

| Element            | Description                                                                                                                                  |
|--------------------|----------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Order status transitions (e.g., `confirmed → preparing`)                                                                                     |
| Stimulus Source    | Restaurant / shipper / admin HTTP client, or system task                                                                                     |
| Environment        | Normal load; customer device online; WebSocket session active                                                                                |
| Artifact           | [NotificationGateway](../../src/module/notification/gateway/notification.gateway.ts) → `room:user:{userId}`; Socket.IO `/notifications` ns |
| Response           | Connected notification clients receive `WS_NOTIFICATION_CREATED`; persisted notification rows remain available for REST inbox reloads         |
| Response Measure   | Backend event-to-WebSocket emit latency target ≤ 5 s p95; client screen refresh/rendering behavior is implementation-specific and currently only partial |
| Architectural Tactics | In-process EventBus → event handler → WebSocket emit; Redis-tracked presence enables fan-out only to active sessions                         |

---

# Slide 41 — QA-P-03 Checkout End-to-End Latency

**Source:** `ADD_FoodDelivery.md` § 2.1.3.

| Element            | Description                                                                                                                                       |
|--------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Customer submits Place-Order request                                                                                                              |
| Stimulus Source    | Customer client                                                                                                                                    |
| Environment        | Normal load; payment method = COD                                                                                                                 |
| Artifact           | [PlaceOrderHandler](../../src/module/ordering/order/commands/place-order.handler.ts); Drizzle transaction over `orders`, `order_items`, `order_status_logs` |
| Response           | Order persisted; `OrderPlacedEvent` dispatched; response returned                                                                                 |
| Response Measure   | p95 ≤ 3 s including ACL snapshot reads, promotion reservation, haversine validation, and DB commit                                                |
| Architectural Tactics | Single ACID transaction; idempotency short-circuit on Redis hit; haversine in-memory; ACL reads from local snapshot tables (no cross-BC RPC)      |

---

# Slide 42 — QA-P-04 Menu / Availability Update Propagation

**Source:** `ADD_FoodDelivery.md` § 2.1.4.

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Restaurant edits menu item price / availability                                                                          |
| Stimulus Source    | Restaurant management client                                                                                             |
| Environment        | Normal load                                                                                                              |
| Artifact           | Restaurant-catalog → publishes `MenuItemUpdatedEvent` ([menu-item-updated.event.ts](../../src/shared/events/menu-item-updated.event.ts)); Ordering ACL projector |
| Response           | `ordering_menu_item_snapshots` updated; subsequent place-order uses fresh data                                           |
| Response Measure   | Propagation target ≤ 10 s; current same-process event dispatch is expected to complete substantially faster, but formal latency measurement is still pending |

---

# Slide 43 — QA-A-01 Authentication Endpoint Availability

**Source:** `ADD_FoodDelivery.md` § 2.2.1.

| Element            | Description                                                                                                                       |
|--------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Customer / partner submits sign-in or session validation                                                                          |
| Stimulus Source    | Any client                                                                                                                        |
| Environment        | Calendar month, normal + occasional partial outage                                                                                |
| Artifact           | Better Auth integration ([lib/auth.ts](../../src/lib/auth.ts)); PostgreSQL session store                                       |
| Response           | Successful authentication when PostgreSQL/auth dependencies are available; failures surface as standard HTTP errors without relying on in-memory session state |
| Response Measure   | Availability target: 99.5 percent deployment objective for the authentication path; operational validation and resilience evidence are still pending |
| Architectural Tactics | Stateless app instances (planned horizontal scale); fail-fast at startup on config errors; restart-friendly Docker container       |

---

# Slide 44 — QA-A-02 Real-Time Channel Graceful Degradation

**Source:** `ADD_FoodDelivery.md` § 2.2.2.

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | WebSocket connection lost (network, server restart)                                                                      |
| Stimulus Source    | Customer / shipper / restaurant client                                                                                   |
| Environment        | Mobile network handover, degraded connectivity                                                                            |
| Artifact           | NotificationGateway plus REST NotificationController                                                                      |
| Response           | Backend supports recovery through the REST inbox at `/api/notifications/my`; mobile implements a notification socket and on-demand inbox fetch, while the defined unread-count polling hook is not wired and automatic order-detail polling is not implemented across clients |
| Response Measure   | In-app notifications are persisted with a 90-day `expiresAt`; reconnect re-joins the per-user room and new deliveries remain idempotent by notification key |
| Architectural Tactics | Durable notification store; idempotent `notification.id`; per-user room rejoin on reconnect                              |

---

# Slide 45 — QA-A-03 Optional Notification-Channel Degradation

**Source:** `ADD_FoodDelivery.md` § 2.2.3.

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | SMTP or FCM unreachable / credentials absent                                                                             |
| Stimulus Source    | External provider outage                                                                                                 |
| Environment        | Provider degraded                                                                                                        |
| Artifact           | `EmailChannel`, `PushChannel` providers                                                                                  |
| Response           | Core flows (order placement, payment) continue; the affected notification channel logs failure to `notification_delivery_logs` |
| Response Measure   | Zero impact on order-state correctness; failed dispatches retried by future iteration (currently logged, not auto-retried) |

---

# Slide 46 — QA-R-01 Order Placement Idempotency

**Source:** `ADD_FoodDelivery.md` § 2.3.1.

| Element            | Description                                                                                                                                                          |
|--------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Client retries Place-Order request after timeout or unknown response                                                                                                  |
| Stimulus Source    | Customer client                                                                                                                                     |
| Environment        | Network instability                                                                                                                                                  |
| Artifact           | [PlaceOrderHandler](../../src/module/ordering/order/commands/place-order.handler.ts); Redis `idempotency:order:{key}`; `orders.cart_id` UNIQUE constraint         |
| Response           | Identical `orderId` returned; no duplicate `orders` row; no double-charge                                                                                            |
| Response Measure   | Zero duplicate orders across retries with identical `X-Idempotency-Key` within `ORDER_IDEMPOTENCY_TTL_SECONDS` (fallback 300 s)                                      |
| Architectural Tactics | D5-A Redis idempotency key (fast path); D5-B DB `UNIQUE(cart_id)` (backstop); transactional commit before publishing `OrderPlacedEvent`                              |

---

# Slide 47 — QA-R-02 Payment IPN Webhook Idempotency

**Source:** `ADD_FoodDelivery.md` § 2.3.2.

| Element            | Description                                                                                                                            |
|--------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | VNPay retries the IPN callback                                                                                                         |
| Stimulus Source    | VNPay gateway                                                                                                                          |
| Environment        | VNPay retry policy (until `RspCode=00`)                                                                                                |
| Artifact           | [ProcessIpnHandler](../../src/module/payment/commands/process-ipn.handler.ts); `payment_transactions.version`                       |
| Response           | First call updates state and publishes `PaymentConfirmedEvent` / `PaymentFailedEvent`; subsequent calls return success without re-emit |
| Response Measure   | Zero duplicate state transitions; zero duplicate downstream events under arbitrary retry counts                                        |
| Architectural Tactics | Signature verification first; lookup by `vnp_TxnRef`; terminal-state short-circuit; optimistic-lock `version` increment                |

---

# Slide 48 — QA-R-03 Order State-Machine Integrity

**Source:** `ADD_FoodDelivery.md` § 2.3.3.

| Element            | Description                                                                                                                                                    |
|--------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Any actor (customer, restaurant, shipper, admin, scheduled task) requests an order status transition                                                            |
| Stimulus Source    | Any of the above                                                                                                                                               |
| Environment        | Normal + concurrent operation                                                                                                                                  |
| Artifact           | [TRANSITIONS map](../../src/module/ordering/order-lifecycle/constants/transitions.ts) (closed transition matrix); [TransitionOrderHandler](../../src/module/ordering/order-lifecycle/commands/transition-order.handler.ts) (enforcement + optimistic lock); [OrderLifecycleService](../../src/module/ordering/order-lifecycle/services/order-lifecycle.service.ts) (ownership checks); `orders.version`; `order_status_logs` |
| Response           | Disallowed transitions rejected with a typed error; allowed transitions commit atomically and append an audit log                                              |
| Response Measure   | 100 % of disallowed transitions rejected; 100 % committed transitions logged; concurrent transition attempts fail-safe via optimistic-lock retry / rejection   |
| Architectural Tactics | Hand-crafted TRANSITIONS map (D6-A) in `constants/transitions.ts`; `TransitionOrderHandler` enforces via `@CommandHandler`; optimistic locking on `version`; transactional INSERT into `order_status_logs` |

---

# Slide 49 — QA-R-04 Single-Restaurant Cart Invariant

**Source:** `ADD_FoodDelivery.md` § 2.3.4.

| Element            | Description                                                                                                                |
|--------------------|----------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Customer adds an item from Restaurant B to a cart already containing items from Restaurant A                                |
| Stimulus Source    | Customer client                                                                                                            |
| Environment        | Normal                                                                                                                     |
| Artifact           | [CartService](../../src/module/ordering/cart/cart.service.ts)                                                            |
| Response           | Request rejected with a structured error (`CART_RESTAURANT_CONFLICT`); existing cart left unchanged                         |
| Response Measure   | 100 % rejection in unit / e2e tests; cart store remains consistent                                                          |
| Architectural Tactics | BR-2 enforcement in service before Redis write                                                                              |

---

# Slide 50 — QA-R-05 Atomic Shipper Assignment

**Source:** `ADD_FoodDelivery.md` § 2.3.5.

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Two shippers concurrently accept the same dispatch                                                                       |
| Stimulus Source    | Shipper mobile clients                                                                                                   |
| Environment        | Concurrent acceptance                                                                                                    |
| Artifact           | T-09 (`ready_for_pickup → picked_up`) in [TransitionOrderHandler](../../src/module/ordering/order-lifecycle/commands/transition-order.handler.ts); `orders.version`; `orders.shipperId` |
| Response           | At most one shipper bound to the order; loser receives a typed conflict response                                         |
| Response Measure   | Logical guarantee: at most one shipper assignment per successful optimistic-lock commit on the same order row; concurrent validation remains operational work |
| Architectural Tactics | Shipper self-assignment occurs inside the same optimistic-lock status update that advances T-09; losing concurrent requests receive `ConflictException` |

---

# Slide 51 — QA-R-06 Payment Timeout Recovery

**Source:** `ADD_FoodDelivery.md` § 2.3.6.

| Element            | Description                                                                                                                                                                     |
|--------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | A payment transaction remains in `pending` or `awaiting_ipn` state beyond the configured `expiresAt` deadline                                                                   |
| Stimulus Source    | Customer inactivity, gateway delay, or payment abandonment                                                                                                                      |
| Environment        | Normal scheduled execution (`@Cron(EVERY_MINUTE)`)                                                                                                                              |
| Artifact           | [PaymentTimeoutTask](../../src/module/payment/tasks/payment-timeout.task.ts); `payment_transactions.expiresAt`; `PaymentFailedEvent`                                          |
| Response           | Expired transaction transitioned to `failed` via optimistic lock; `PaymentFailedEvent` published; Ordering BC handler auto-cancels the order through the CQRS path              |
| Response Measure   | Expired transactions are selected by the every-minute sweeper; optimistic locking prevents duplicate state changes, but multi-pod duplicate-event behavior requires deployment validation |
| Architectural Tactics | Scheduled sweeper with optimistic-lock concurrency guard; event-driven cancellation cascade; terminal-state protection prevents double-processing                             |

---

# Slide 52 — QA-R-07 Restaurant Acceptance Timeout

**Source:** `ADD_FoodDelivery.md` § 2.3.7.

| Element            | Description                                                                                                                                                                     |
|--------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | A restaurant does not accept or reject an order within the configured acceptance window                                                                                         |
| Stimulus Source    | Restaurant operator inaction                                                                                                                                                    |
| Environment        | Normal scheduled execution (`@Cron(EVERY_MINUTE)`)                                                                                                                              |
| Artifact           | [OrderTimeoutTask](../../src/module/ordering/order-lifecycle/tasks/order-timeout.task.ts); `RESTAURANT_ACCEPT_TIMEOUT_SECONDS` (from `app_settings`); `TransitionOrderCommand` |
| Response           | Order auto-cancelled via the same CQRS `TransitionOrderCommand` path used by all actors; T-05 fires for paid orders triggering the refund event automatically                   |
| Response Measure   | Eligible expired orders are scanned every minute and routed through `TransitionOrderCommand`; stuck-order diagnostics / alerting remain planned                                    |
| Architectural Tactics | Scheduler scan; reuse of existing CQRS command path (no bespoke cancellation logic); acceptance window configurable at runtime via `app_settings` without redeployment        |

---

# Slide 53 — QA-R-08 Refund and Promotion Compensation Reliability

**Source:** `ADD_FoodDelivery.md` § 2.3.8.

| Element            | Description                                                                                                                                                                     |
|--------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | A VNPay-paid order is cancelled through a refund-triggering transition, or an order with a reserved promotion fails / is cancelled                                               |
| Stimulus Source    | Ordering BC emits `OrderCancelledAfterPaymentEvent` or `OrderStatusChangedEvent(cancelled/refunded)`                                                                             |
| Environment        | Normal; VNPay Refund API stubbed in current implementation (production retry TBD)                                                                                               |
| Artifact           | [OrderCancelledAfterPaymentHandler](../../src/module/payment/events/order-cancelled-after-payment.handler.ts); [PromotionRollbackOnCancellationHandler](../../src/module/ordering/order-lifecycle/events/promotion-rollback-on-cancellation.handler.ts); [PromotionService](../../src/module/promotion/services/promotion.service.ts) |
| Response           | Payment refund state is advanced in Payment BC; promotion reservations/usages are rolled back through the promotion port; failures are logged and do not roll back the already committed order state |
| Response Measure   | Order cancellation / failed checkout correctness is independent of refund or promotion-rollback outcome; real refund retry automation remains planned, while promotion counter rollback is implemented idempotently |
| Architectural Tactics | Event-driven async compensation; failure containment in payment/refund handlers; promotion rollback through `PROMOTION_APPLICATION_PORT` with idempotent counter decrements and usage status updates |

---

# Slide 54 — QA-S-01 VNPay Callback Integrity

**Source:** `ADD_FoodDelivery.md` § 2.4.1.

| Element            | Description                                                                                                                                       |
|--------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Forged or tampered VNPay IPN payload                                                                                                              |
| Stimulus Source    | Attacker / Internet                                                                                                                               |
| Environment        | Public IPN endpoint                                                                                                                               |
| Artifact           | [VNPayService.verifyReturnUrl / verifyIpn](../../src/module/payment/services/vnpay.service.ts); `crypto.timingSafeEqual`                       |
| Response           | Request rejected; no state mutation; no events emitted                                                                                            |
| Response Measure   | Invalid HMAC-SHA512 payloads are rejected before state mutation; penetration / negative security tests are recommended validation                                                    |
| Architectural Tactics | Signature verification **before** any DB lookup; constant-time comparison; ordered URL-encoded canonicalization per VNPay spec                    |

---

# Slide 55 — QA-S-02 Authentication & Session Management

**Source:** `ADD_FoodDelivery.md` § 2.4.2.

| Element            | Description                                                                                                                  |
|--------------------|------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | User sign-in / session validation                                                                                            |
| Stimulus Source    | Customer, restaurant, shipper, admin                                                                                          |
| Environment        | Public endpoints                                                                                                              |
| Artifact           | Better Auth + Drizzle adapter ([lib/auth.ts](../../src/lib/auth.ts)); `session`, `account`, `verification` tables          |
| Response           | Strong session token issued; bearer token validated server-side on each request                                              |
| Response Measure   | Industry-standard password hashing (Better Auth default — scrypt); session secret ≥ 32 chars enforced at startup via Zod      |
| Architectural Tactics | Library-managed credential handling; HTTPS-only deployment (deployment constraint); no custom rolling of crypto             |

---

# Slide 56 — QA-S-03 Role-Based Authorization

**Source:** `ADD_FoodDelivery.md` § 2.4.3.

| Element            | Description                                                                                                                                |
|--------------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Unauthorized actor accesses an admin / restaurant / shipper endpoint                                                                       |
| Stimulus Source    | Any client                                                                                                                                 |
| Environment        | Any                                                                                                                                        |
| Artifact           | `user.role` (multi-role CSV); [`hasRole()`](../../src/module/auth/role.util.ts) utility; route guards                                   |
| Response           | 401 (no session) / 403 (insufficient role); unauthorized attempts observable through server/access logs; order lifecycle mutations write persistent audit rows |
| Response Measure   | Protected endpoints deny missing or mismatched roles before service-layer mutation                                                         |
| Architectural Tactics | Multi-role bitmap-equivalent (CSV) checked via OR-logic helper; Better Auth `admin()` plugin for admin scoping                           |

---

# Slide 57 — QA-S-05 Input Validation & Injection Resistance

**Source:** `ADD_FoodDelivery.md` § 2.4.5.

| Element            | Description                                                                                                                  |
|--------------------|------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Client submits malformed DTO fields or HTML / JS payloads in catalog, cart, order, promotion, or notification requests        |
| Stimulus Source    | Authenticated or public client                                                                                                 |
| Environment        | Any                                                                                                                          |
| Artifact           | Global `ValidationPipe({ transform: true })` in [main.ts](../../src/main.ts); class-validator DTOs                         |
| Response           | DTO validation rejects malformed payloads; Drizzle parameterization protects database access; stored review-text sanitization remains planned with UC-22 |
| Response Measure   | Invalid DTO payloads rejected before service-layer mutation; SQL injection prevented by Drizzle parameterized queries        |

---

# Slide 58 — QA-S-06 Rate Limiting on Public Endpoints

**Source:** `ADD_FoodDelivery.md` § 2.4.6.

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

# Slide 59 — QA-SC-01 Horizontal Scaling of API Instances

**Source:** `ADD_FoodDelivery.md` § 2.5.1.

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

---

# Slide 60 — QA-SC-02 Cart and Idempotency Storage Scaling

**Source:** `ADD_FoodDelivery.md` § 2.5.2.

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

# Slide 61 — QA-FL-01 Generalizing Payment Provider Integration

**Source:** `ADD_FoodDelivery.md` § 2.6.1.

| Element            | Description                                                                                                                                |
|--------------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Add a non-VNPay payment provider (e.g., MoMo, ZaloPay)                                                                                     |
| Stimulus Source    | Product roadmap                                                                                                                            |
| Environment        | Development                                                                                                                                |
| Artifact           | `IPaymentInitiationPort` ([payment-initiation.port.ts](../../src/shared/ports/payment-initiation.port.ts)); Payment module               |
| Response           | Ordering is decoupled from the concrete Payment service, but the current port method is VNPay-specific (`initiateVNPayPayment`) and must be generalized before adding MoMo / ZaloPay without Ordering changes |
| Response Measure   | Current state: zero concrete Payment imports in `module/ordering`; target state: provider-neutral initiation contract and provider-selection tests |
| Architectural Tactics | Ports & Adapters boundary exists; provider strategy and payment-method-neutral port are planned                                            |

---

# Slide 62 — QA-FL-02 Adding a New Order Status

**Source:** `ADD_FoodDelivery.md` § 2.6.2.

| Element            | Description                                                                                                                          |
|--------------------|--------------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Add a new lifecycle status (e.g., `awaiting_courier`)                                                                                |
| Stimulus Source    | Operations roadmap                                                                                                                   |
| Environment        | Development                                                                                                                          |
| Artifact           | `order.schema.ts` enum; `TRANSITIONS` map; notification handlers                                                                  |
| Response           | New status added to enum, transition matrix, and audit log writer                                                                    |
| Response Measure   | Required changes are concentrated in the order enum, transition map, and notification mapping; transition-matrix tests are recommended validation |

---

# Slide 63 — QA-FL-03 Replacing a Notification Channel Provider

**Source:** `ADD_FoodDelivery.md` § 2.6.3.

| Element            | Description                                                                                                          |
|--------------------|----------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Replace FCM with another push provider                                                                               |
| Stimulus Source    | Operations / cost decision                                                                                           |
| Environment        | Development                                                                                                          |
| Artifact           | `PushProvider` interface ([push-provider.interface.ts](../../src/module/notification/channels/push/push-provider.interface.ts)) |
| Response           | New adapter added; module factory rebinds the token                                                                  |
| Response Measure   | Zero changes in event handlers or domain code                                                                        |

---

# Slide 64 — QA-I-01 VNPay Gateway Integration

**Source:** `ADD_FoodDelivery.md` § 2.7.1.

| Element            | Description                                                                                                                       |
|--------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Customer pays online                                                                                                              |
| Stimulus Source    | Customer / VNPay return + IPN callbacks                                                                                            |
| Environment        | Public Internet                                                                                                                   |
| Artifact           | [VNPayService](../../src/module/payment/services/vnpay.service.ts); `vnp_*` parameters; `crypto` HMAC-SHA512                   |
| Response           | Payment URL generated; return + IPN parsed; signed correctly; result persisted                                                    |
| Response Measure   | Conformance to VNPay spec is verifiable through sandbox/manual tests for signature, ordering, and encoding                         |

---

# Slide 65 — QA-I-02 Push Notification Multi-Channel Dispatch

**Source:** `ADD_FoodDelivery.md` § 2.7.2.

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | NotificationService persists a notification row from a domain-event handler                                             |
| Stimulus Source    | Cross-BC event handlers                                                                                                  |
| Environment        | Customer in foreground / background / offline                                                                            |
| Artifact           | [ChannelDispatcherService](../../src/module/notification/services/channel-dispatcher.service.ts); `InAppChannelService`, `EmailChannelService`, `PushChannelService` |
| Response           | Channels chosen by user preferences and presence; each channel delivers independently                                    |
| Response Measure   | Delivery attempts are recorded in `notification_delivery_logs`; provider success-rate targets require operational monitoring |

---

# Slide 66 — QA-I-03 Image Upload via Cloudinary

**Source:** `ADD_FoodDelivery.md` § 2.7.3.

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Restaurant uploads a menu-item image                                                                                     |
| Stimulus Source    | Restaurant management client                                                                                             |
| Environment        | Normal                                                                                                                   |
| Artifact           | [Cloudinary provider](../../src/module/image/cloudinary.provider.ts); signed upload                                   |
| Response           | Image uploaded to Cloudinary; URL persisted in `images` table                                                            |
| Response Measure   | Target upload latency p95 ≤ 5 s for images ≤ 2 MB; actual latency depends on Cloudinary/network conditions               |

---

# Slide 67 — QA-SUP-01 Audit Trail for Order Lifecycle

**Source:** `ADD_FoodDelivery.md` § 2.8.1.

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | Any order status transition                                                                                              |
| Stimulus Source    | Any actor                                                                                                                |
| Environment        | Any                                                                                                                      |
| Artifact           | `order_status_logs` table                                                                                                |
| Response           | One row per transition: `{orderId, fromStatus, toStatus, triggeredBy (UUID|null), triggeredByRole, note, createdAt}`; `fromStatus` is nullable for the initial creation entry |
| Response Measure   | 100 % of committed transitions audited; queryable by orderId, actor, or time range                                       |

---

# Slide 68 — QA-SUP-02 Structured Logging on Cross-BC Events

**Source:** `ADD_FoodDelivery.md` § 2.8.2.

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | An event handler fails (e.g., ACL projection error, channel dispatch error)                                              |
| Stimulus Source    | Internal                                                                                                                 |
| Environment        | Production                                                                                                               |
| Artifact           | NestJS `Logger`; handler-specific failure policies in `@EventsHandler` classes                                            |
| Response           | Error logged at ERROR level with context (`eventType`, `aggregateId`); notification and refund handlers absorb failures, while ACL projectors currently log and rethrow after failed snapshot writes |
| Response Measure   | Handler failures are logged with contextual IDs; ≤ 5 minute detection requires active log monitoring until APM is integrated |
| Gap                | No central log aggregation or correlation IDs in the implemented baseline; APM / OpenTelemetry is future work             |

---

# Slide 69 — QA-SUP-03 Stuck-Order Diagnostics

**Source:** `ADD_FoodDelivery.md` § 2.8.3.

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | An order remains in a non-terminal status beyond a configured threshold                                                  |
| Stimulus Source    | Scheduler                                                                                                                |
| Environment        | Production                                                                                                               |
| Artifact           | Future diagnostic task and admin monitoring surface; current `OrderTimeoutTask` only auto-cancels expired pending / paid orders |
| Response           | Order flagged with a reason code and surfaced on the admin monitoring view                                               |
| Response Measure   | Detection latency ≤ 1 minute past threshold                                                                              |

---

# Slide 70 — QA-MA-01 Bounded-Context Boundary Enforcement

**Source:** `ADD_FoodDelivery.md` § 2.9.1.

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | A developer attempts to import a Payment / Promotion concrete class into Ordering                                        |
| Stimulus Source    | Pull request                                                                                                             |
| Environment        | Development                                                                                                              |
| Artifact           | Ports (`PAYMENT_INITIATION_PORT`, `PROMOTION_APPLICATION_PORT`); ACL snapshot tables                                     |
| Response           | The compiler permits it, but architectural reviews / planned ESLint boundary rules forbid it; only the port symbol is imported |
| Response Measure   | Zero cross-BC concrete imports in `module/ordering` (verified by grep / planned ESLint rule)                              |

---

# Slide 71 — QA-MA-02 Schema Evolution via Drizzle Migrations

**Source:** `ADD_FoodDelivery.md` § 2.9.2.

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | New table / column added                                                                                                 |
| Stimulus Source    | Developer                                                                                                                |
| Environment        | Development → staging → production                                                                                       |
| Artifact           | Drizzle Kit migrations; `drizzle.config.ts`                                                                              |
| Response           | Generated migration file applied; existing data preserved                                                                |
| Response Measure   | Migrations are forward-compatible (no destructive rewrites without a coordinated release)                                |

---

# Slide 72 — QA-T-01 Deterministic Order Placement Tests

**Source:** `ADD_FoodDelivery.md` § 2.10.1.

| Element            | Description                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------|
| Stimulus           | A new lifecycle / pricing rule is added                                                                                  |
| Stimulus Source    | Developer                                                                                                                |
| Environment        | CI                                                                                                                       |
| Artifact           | Jest unit + e2e tests; payment e2e ([test/payment.e2e-spec.ts](../../test/payment.e2e-spec.ts))                       |
| Response           | Tests pass deterministically against ephemeral DB + Redis + stub providers                                               |
| Response Measure   | Existing e2e/spec coverage exercises payment, order, cart, ACL, promotion, and notification paths; coverage thresholds are not formalized |
| Architectural Tactics | Provider abstractions allow `NoopEmailProvider` / `StubPushProvider` in tests; injectable `RedisService` permits mocking |

---

# Slide 73 — Design Pattern: Singleton

**Source:** `gof-design-pattern-audit-report.md` § 3.5.

**Intent.** Ensure a class has only one instance and provide a global access point to that instance (GoF definition). Classified as **Framework-Assisted Variant** — scope management performed by the NestJS DI container rather than by a private constructor + static `getInstance()`.

**Participants.**
- Singleton: any `@Injectable()` provider (module-scoped) and `@Global()` modules (application-wide): `RedisService` / `REDIS_CLIENT`, `GeoService`, `PROMOTION_APPLICATION_PORT`, `PAYMENT_INITIATION_PORT`.
- Client: any module/service receiving the singleton via DI.

**Evidence Location.**
- `apps/api/src/lib/redis/redis.module.ts`
- `apps/api/src/module/notification/services/notification.service.ts`
- `apps/api/src/module/ordering/cart/cart.service.ts`
- `GeoModule`, `PromotionModule`, `PaymentModule` (`@Global()` modules exposing application-wide tokens)

---

# Slide 74 — Design Pattern: Strategy

**Source:** `gof-design-pattern-audit-report.md` § 5.9.

**Intent.** Define a family of algorithms, encapsulate each one, and make them interchangeable. Classified as **Canonical GoF**.

**Participants (3 strategy hierarchies).**
- Level 1 (Channel) — Strategy interface `INotificationChannel`; ConcreteStrategies `EmailChannelService`, `PushChannelService`, `InAppChannelService`; Context `ChannelDispatcherService`.
- Level 2a (Email Transport) — Strategy interface `IEmailProvider`; ConcreteStrategies `NodemailerEmailProvider`, `NoopEmailProvider`; Context `EmailChannelService`.
- Level 2b (Push Transport) — Strategy interface `IPushProvider`; ConcreteStrategies `FirebasePushProvider`, `StubPushProvider`; Context `PushChannelService`.

**Evidence Location.**
- `apps/api/src/module/notification/channels/channel.interface.ts`
- `apps/api/src/module/notification/channels/email/email-provider.interface.ts`
- `apps/api/src/module/notification/channels/push/push-provider.interface.ts`

---

# Slide 75 — Design Pattern: Command

**Source:** `gof-design-pattern-audit-report.md` § 5.2.

**Intent.** Encapsulate a request as an object, allowing parameterization, queueing, logging, and undo. Classified as **Framework-Assisted Canonical GoF** via `@nestjs/cqrs`.

**Participants.**
- Command (data-only classes): `TransitionOrderCommand`, `PlaceOrderCommand`, `ProcessIpnCommand`.
- ConcreteCommand / Receiver (handler `execute`): `TransitionOrderHandler`, `PlaceOrderHandler`, `ProcessIpnHandler` (each decorated `@CommandHandler(...)`).
- Invoker: controllers, scheduled tasks, and event handlers calling `commandBus.execute(...)`.

**Evidence Location.**
- `apps/api/src/module/ordering/order-lifecycle/commands/transition-order.command.ts`
- `apps/api/src/module/ordering/order-lifecycle/commands/transition-order.handler.ts`
- `apps/api/src/module/ordering/order/commands/place-order.command.ts`
- `apps/api/src/module/ordering/order/commands/place-order.handler.ts`
- `apps/api/src/module/payment/commands/process-ipn.command.ts`
- `apps/api/src/module/payment/commands/process-ipn.handler.ts`

---

# Slide 76 — Design Pattern: Observer

**Source:** `gof-design-pattern-audit-report.md` § 5.7.

**Intent.** Define a one-to-many dependency between objects so that when one object changes state, all its dependents are notified and updated automatically. Classified as **Framework-Assisted Canonical GoF** via `@nestjs/cqrs` EventBus.

**Participants.**
- Subject (Publishers): `TransitionOrderHandler`, `PlaceOrderHandler`, `ProcessIpnHandler`, restaurant-catalog services publishing `RestaurantUpdatedEvent` / `MenuItemUpdatedEvent` / `DeliveryZoneSnapshotUpdatedEvent`.
- Observers (`@EventsHandler` subscribers):
  - Notification BC — `OrderStatusChangedNotificationHandler`, `OrderPlacedNotificationHandler`, `PaymentConfirmedNotificationHandler`, `PaymentFailedNotificationHandler`, `OrderCancelledAfterPaymentNotificationHandler`, `NotificationRestaurantSnapshotProjector`.
  - Ordering BC — `PaymentConfirmedEventHandler`, `PaymentFailedEventHandler`, `PromotionRollbackOnCancellationHandler`, `MenuItemProjector`, `RestaurantSnapshotProjector`, `DeliveryZoneSnapshotProjector`.
  - Payment BC — `OrderCancelledAfterPaymentHandler`.
- ConcreteSubject mediator: `@nestjs/cqrs` EventBus.

**Evidence Location.**
- `apps/api/src/shared/events/` (event class barrel — e.g., `order-status-changed.event.ts`, `order-placed.event.ts`, `payment-confirmed.event.ts`, `payment-failed.event.ts`, `restaurant-updated.event.ts`, `menu-item-updated.event.ts`)
- `apps/api/src/module/notification/events/`
- `apps/api/src/module/ordering/acl/projections/` (`menu-item.projector.ts`, `restaurant-snapshot.projector.ts`, `delivery-zone-snapshot.projector.ts`)
- `apps/api/src/module/notification/acl/notification-restaurant-snapshot.projector.ts`
- `apps/api/src/module/payment/events/order-cancelled-after-payment.handler.ts`

---

# Slide 77 — Design Pattern: Mediator

**Source:** `gof-design-pattern-audit-report.md` § 5.5.

**Intent.** Define an object that encapsulates how a set of objects interact, so colleagues communicate through the mediator instead of referring to each other directly. Classified as **Framework-Assisted Canonical GoF** via `@nestjs/cqrs` — two mediators recognized: EventBus and CommandBus.

**Participants.**
- Mediator #1 — `EventBus` (cross-BC event mediator): colleagues are publisher handlers (e.g., `TransitionOrderHandler`, `PlaceOrderHandler`, `ProcessIpnHandler`, restaurant-catalog services) and subscriber handlers (Notification, Ordering ACL, Payment refund). Documented fan-out: `RestaurantUpdatedEvent` → `RestaurantSnapshotProjector` (Ordering ACL) + `NotificationRestaurantSnapshotProjector` (Notification ACL).
- Mediator #2 — `CommandBus` (request/handler mediator): colleagues are invokers (`OrderLifecycleController`, `OrderTimeoutTask`, `PaymentConfirmedHandler`) and `TransitionOrderHandler` (handler side).

**Evidence Location.**
- `@nestjs/cqrs` (framework package) provides `EventBus` and `CommandBus`.
- Publisher evidence: `apps/api/src/module/ordering/order-lifecycle/commands/transition-order.handler.ts`, `apps/api/src/module/ordering/order/commands/place-order.handler.ts`, `apps/api/src/module/payment/commands/process-ipn.handler.ts`.
- Subscriber evidence: paths listed under Observer (Slide 76).
- Source note: `ChannelDispatcherService` (`apps/api/src/module/notification/services/channel-dispatcher.service.ts`) is **explicitly excluded** by the audit — it is a Strategy Router, not a GoF Mediator.

---

# Slide 78 — Design Pattern: Facade

**Source:** `gof-design-pattern-audit-report.md` § 4.5.

**Intent.** Provide a unified, simplified interface to a complex subsystem. Classified as **Canonical GoF**.

**Participants (4 facade implementations).**
- `NotificationService` — Mega Facade hiding `NotificationRepository`, `NotificationPreferenceRepository`, `UserEmailRepository`, `DeviceTokenRepository`, `NotificationTemplateService`, `ChannelDispatcherService`, `QuietHoursService`, `NotificationGateway`, `RedisService` behind a `send(dto)` interface.
- `CartService` — Redis + Snapshot Facade hiding `CartRedisRepository`, `MenuItemSnapshotRepository`, `AppSettingsService` behind `addItem` / `removeItem` / `getCart` / `clearCart`.
- `OrderHistoryService` — Query Facade hiding `OrderHistoryRepository` and `RestaurantSnapshotRepository` behind enriched query operations.
- `AclService` — Cross-BC Snapshot Facade hiding `MenuItemSnapshotRepository` and `RestaurantSnapshotRepository` behind controller-friendly methods.

**Evidence Location.**
- `apps/api/src/module/notification/services/notification.service.ts`
- `apps/api/src/module/ordering/cart/cart.service.ts`
- `apps/api/src/module/ordering/order-history/services/order-history.service.ts`
- `apps/api/src/module/ordering/acl/acl.service.ts`

---

# Slide 79 — Design Pattern: Adapter

**Source:** `gof-design-pattern-audit-report.md` § 4.1.

**Intent.** Allow classes with incompatible interfaces to work together by wrapping an existing Adaptee into the Target interface expected by the Client. Classified as **Canonical GoF (2)** plus a separate group of DIP Hexagonal Ports (explicitly noted as *not* GoF Adapter).

**Participants.**
- Canonical Adapter #1 — `CartRedisRepository`: Target = Cart domain interface; Adaptee = `RedisService` (generic `get`/`set`/`del`/`scan`); Adapter = `CartRedisRepository`; Client = `CartService`.
- Canonical Adapter #2 — `drizzleAdapter()` (Better Auth integration): Target = Better Auth DB interface; Adaptee = Drizzle ORM API; Adapter = `drizzleAdapter()` function; Client = `betterAuth()` configuration.
- DIP Ports group (source labels these *not* GoF Adapter): `IPromotionApplicationPort`, `IPaymentInitiationPort`.

**Evidence Location.**
- `apps/api/src/module/ordering/cart/cart.redis-repository.ts`
- `apps/api/src/lib/auth.ts`
- `apps/api/src/shared/ports/promotion-application.port.ts` (DIP port, noted by audit as non-GoF)
- `apps/api/src/shared/ports/payment-initiation.port.ts` (DIP port, noted by audit as non-GoF)
