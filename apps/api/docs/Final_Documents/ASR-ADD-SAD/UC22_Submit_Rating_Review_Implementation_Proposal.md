# UC-22 — Submit Rating & Review  
## Implementation Proposal  
**SoLi Food Delivery Platform**

| Field | Value |
|---|---|
| Document ID | PROPOSAL-UC22 |
| Use Case ID | CUS-FR-10 (SRS §4.22), UC-DOM-09 (USE_CASE_SPECIFICATION §12) |
| Status | **Proposal — Ready for Implementation** |
| Priority | P3 — Release R2 |
| Author Role | Senior Software Architect / Technical Lead |
| Source Authority | SRS_FoodDelivery.md, ADD_FoodDelivery.md, ADR_FoodDelivery.md, SAD_FoodDelivery.md, ASR_FoodDelivery.md |
| Codebase Status | **0% implemented — net-new bounded context** |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Requirement Traceability Matrix](#2-requirement-traceability-matrix)
3. [Existing Implementation Analysis](#3-existing-implementation-analysis)
4. [Gap Analysis](#4-gap-analysis)
5. [Proposed Architecture](#5-proposed-architecture)
6. [Bounded Context Ownership](#6-bounded-context-ownership)
7. [Domain Model Design](#7-domain-model-design)
8. [Database Design](#8-database-design)
9. [API Design](#9-api-design)
10. [Backend Implementation Design](#10-backend-implementation-design)
11. [Event Design](#11-event-design)
12. [Security Design](#12-security-design)
13. [Mobile Application Design](#13-mobile-application-design)
14. [Web Application Design](#14-web-application-design)
15. [Notification Integration](#15-notification-integration)
16. [Testing Strategy](#16-testing-strategy)
17. [Risks and Mitigations](#17-risks-and-mitigations)
18. [Implementation Roadmap](#18-implementation-roadmap)
19. [Definition of Done](#19-definition-of-done)
20. [File-by-File Change Plan](#20-file-by-file-change-plan)

---

## 1. Executive Summary

UC-22 — Submit Rating & Review introduces the **Review & Rating bounded context** into the SoLi Food Delivery Platform modular monolith. This is a net-new feature: no review or rating code exists anywhere in the codebase.

The feature allows authenticated customers to submit a star rating (1–5) and an optional text comment for a delivered order. The use case is gated behind order delivery status — only orders with `status = 'delivered'` are eligible — and is restricted to one review per order (enforced by a `UNIQUE` constraint). Upon submission, the system updates the restaurant's aggregate rating in the Restaurant Catalog BC and dispatches a `new_review` notification to the restaurant owner.

**Business impact:** Delivers US-33 (Customer feedback and marketplace trust), feeds `averageRating` into UC-3 restaurant discovery, and satisfies BRD-SM-3 (Satisfaction Metrics). This is a foundational prerequisite for marketplace quality governance.

**Architecture:** The Review BC is implemented as a new NestJS module (`apps/api/src/module/review/`) following the same bounded-context module pattern as Ordering, Notification, and Promotion. It uses Drizzle ORM with a new `reviews` table, CQRS for command handling, the in-process EventBus for post-commit event publication, and cross-BC coordination via the shared events channel and a direct DB read on the Ordering schema (permitted by ADR-003 for same-process read-side access).

**Scope of change:** 22 files to create, 6 files to modify across backend, mobile, and web. One Drizzle migration. Estimated complexity: medium-high.

---

## 2. Requirement Traceability Matrix

### 2.1 Business Objective to Architecture Component

| Business Objective | Business Rule | User Story | Use Case | SRS Ref | Sequence Diagram | ASR | Architecture Component |
|---|---|---|---|---|---|---|---|
| Marketplace trust and quality feedback | BRD-SM-3: post-order customer satisfaction | US-33 | UC-22 / CUS-FR-10 | SRS §4.22 lines 1695–1820 | SD-22 | QA-S-02, QA-S-05, QA-CI-01 | Review & Rating BC |
| Restaurant discoverability (rating display) | BR-22.12 (running average) | US-4, US-33 | UC-3, UC-22 | SRS §4.3, §4.22 | SD-3, SD-22 | QA-P-04 | Restaurant Catalog BC (rating projection) |
| Restaurant owner visibility of feedback | BR-22.11 (notification after review) | US-33 | UC-22, UC-20 | SRS §4.22, §4.20 | SD-22 | QA-S-02 | Notification BC (new_review type) |
| One review per order invariant | BR-22.8 (DB UNIQUE), BR-22.9 (app check) | US-33 | UC-22 | SRS §4.22 | SD-22 | QA-CI-01 | Review BC (UNIQUE constraint) |
| Only delivered orders eligible | BR-22.6 (status gate) | US-33 | UC-22 | SRS §4.22 | SD-22 | QA-CI-01 | Review BC (eligibility check) |
| Input sanitization | BR-22.1 (star range, comment length) | US-33 | UC-22 | SRS §4.22 | SD-22 | QA-S-05 | Review BC (SubmitReviewDto) |
| Review moderation | BR-22.13 (moderationStatus) | US-33 | UC-22 | SRS §4.22 | — | QA-SUP-01 | Review BC (moderation columns) |
| Customer ownership | BR-22.3, BR-22.4, BR-22.5 | US-33 | UC-22 | SRS §4.22 | SD-22 | QA-S-02 | Review BC (ownership assertion) |

### 2.2 Documented Business Rules Mapped to Implementation

| BR | Requirement | Implementation Target | HTTP Response |
|---|---|---|---|
| BR-22.1 | `orderId` UUID required; `stars` int 1–5 required; `comment` optional ≤1000 chars trimmed; `tags` optional array max 5 items | `SubmitReviewDto` class-validator decorators | 400 + MSG-RATE-01 |
| BR-22.2 | Validation errors rejected before DB interaction; DEBUG-level log | NestJS `ValidationPipe` (global) | 400 |
| BR-22.3 | `restaurantId` copied from order onto review row at creation | `SubmitReviewHandler.execute()` reads order then sets `review.restaurantId` | 404 + MSG-HIST-01 (see note¹) |
| BR-22.4 | Ownership = `order.customerId === session.user.id` | Ownership assertion in handler before DB write | 404 + MSG-HIST-01 |
| BR-22.5 | Non-owner access → 404 (not 403) to avoid order existence leak | Return `NotFoundException` for any mismatch | 404 |
> ¹ **BR-22.3 vs BR-22.5 conflict resolution:** SRS BR-22.3 states ownership failure returns HTTP 403 (`MSG-REVIEW-02`). SRS BR-22.5 states "Non-owner access returns HTTP 404 (not 403) to avoid leaking order existence to unauthorized actors." **BR-22.5 is the security-hardened override and takes precedence.** The implementation uses 404 + MSG-HIST-01 for any ownership mismatch (BR-22.4, BR-22.5). MSG-REVIEW-02 (403) is reserved for a future admin-facing path and is not raised in the current submission flow.

| BR-22.6 | `order.status = 'delivered'` required server-side | Status check in `SubmitReviewHandler` after ownership | 422 + MSG-REVIEW-03 |
| BR-22.7 | Non-delivered orders → 422 | `UnprocessableEntityException` with MSG-RATE-02 | 422 + MSG-RATE-02 |
| BR-22.8 | `UNIQUE` constraint on `reviews(order_id)` | `unique()` on `orderId` in Drizzle schema | 409 + MSG-RATE-03 |
| BR-22.9 | Application-side optimistic duplicate check before INSERT | `ReviewRepository.findByOrderId()` before insert | 409 |
| BR-22.10 | HTTP 409 includes timestamp and star count of existing review | `ConflictException` with existing review data | 409 |
| BR-22.11 | Review INSERT + `restaurants` rating projection UPDATE in same transaction; post-commit EventBus publish | DB transaction in handler; `eventBus.publish()` after transaction | 201 + MSG-RATE-04 |
| BR-22.12 | Running average: `avg' = (avg × count + stars) / (count + 1)` | SQL expression in transaction update | — |
| BR-22.13 | `moderationStatus ∈ {visible, hidden, flagged}` default `visible`; nullable `moderationReason` | Schema columns; `hidden` reviews excluded from rating projection | — |

### 2.3 Message Code Registry

| Code | HTTP Status | Message Text | When Raised |
|---|---|---|---|
| MSG-RATE-01 | 400 | "Invalid review payload. Stars must be an integer between 1 and 5; comment must be at most 1000 characters." | `SubmitReviewDto` validation failure |
| MSG-RATE-02 | 422 | "You can only review an order that has been delivered." | `order.status ≠ 'delivered'` |
| MSG-RATE-03 | 409 | "You have already submitted a review for this order." | Duplicate review (app-level or DB constraint) |
| MSG-RATE-04 | 201 | "Thank you for your review." | Review successfully created |
| MSG-RATE-05 | 404 | "Review not found." | `GET /reviews/my/:orderId` — no review exists |
| MSG-RATE-06 | 403 | "You can only edit your own review." | Future review edit endpoint |
| MSG-REVIEW-02 | 403 | "You are not authorized to perform this action." | Reserved per BR-22.3 for future admin-facing ownership failure path; **not raised in R2 submission flow** (superseded by BR-22.5 → 404 + MSG-HIST-01) |
| MSG-REVIEW-03 | 422 | Order not yet in delivered state | Redundant alias for MSG-RATE-02 per SRS |
| MSG-HIST-01 | 404 | "Order not found." | Order not found or not owned by caller |

---

## 3. Existing Implementation Analysis

### 3.1 Current Codebase Coverage for UC-22

**Result: 0% implemented.** A complete audit of `apps/api/src/` confirms no review or rating code exists in any form.

| Component | Expected for UC-22 | Current Status |
|---|---|---|
| `apps/api/src/module/review/` | New NestJS module directory | **ABSENT** |
| `reviews` table in PostgreSQL | Stores review records | **ABSENT** |
| `averageRating`, `ratingSum`, `reviewCount` on `restaurants` table | Denormalized rating columns | **ABSENT** — `restaurant.schema.ts` has no rating columns |
| `ReviewSubmittedEvent` in `shared/events/` | Cross-BC event for notification dispatch | **ABSENT** — `shared/events/index.ts` exports 9 existing events, none review-related |
| `new_review` in `notificationTypeEnum` | Notification type for restaurant owner | **ABSENT** — current enum has 16 types, none review-related |
| Review schema in `src/drizzle/schema.ts` | Barrel export for migration tooling | **ABSENT** |
| `ReviewModule` in `app.module.ts` | Module registration | **ABSENT** |
| `POST /reviews` endpoint | Review submission | **ABSENT** |
| Mobile review submission screen | Rate & Review UI for customer | **ABSENT** |
| Web review display on restaurant detail | Rating display for restaurant | **ABSENT** |

### 3.2 Relevant Existing Patterns (What to Follow)

| Pattern | Source File | Application to Review BC |
|---|---|---|
| CommandHandler with DB transaction + post-commit EventBus | `transition-order.handler.ts` | `SubmitReviewHandler` follows same pattern exactly |
| `@Inject(DB_CONNECTION)` with `NodePgDatabase<typeof schema>` | All repositories | Review repository uses identical injection |
| `@EventsHandler(SomeEvent)` + `IEventHandler` pattern | `notification/events/*.handler.ts` | `ReviewSubmittedNotificationHandler` follows this |
| Drizzle pgTable schema with `uuid().defaultRandom().primaryKey()` | `order.schema.ts`, `restaurant.schema.ts` | `reviews` table schema follows same idiom |
| Cross-BC UUID references without FK constraints | `orders.customerId`, `orders.restaurantId` | `reviews.customerId`, `reviews.restaurantId` are plain UUIDs |
| `unique()` constraint in Drizzle | `order.schema.ts` (`UNIQUE(cartId)`) | `UNIQUE(order_id)` on `reviews` table |
| `apiFetch<T>()` client utility | `apps/mobile/src/lib/api-client.ts` | Mobile review API client uses same helper |
| `index('idx_name').on(col)` in schema | Multiple schemas | Review table has index on `(restaurantId, moderationStatus)` |

### 3.3 Restaurant Catalog BC — Impact Assessment

`apps/api/src/module/restaurant-catalog/restaurant/restaurant.schema.ts` (current):
- **`restaurants` table columns present:** `id`, `ownerId`, `name`, `description`, `address`, `phone`, `isOpen`, `isApproved`, `latitude`, `longitude`, `cuisineType`, `logoUrl`, `coverImageUrl`, `createdAt`, `updatedAt`
- **`averageRating` column:** ABSENT — must be added as `real('average_rating').notNull().default(0)`
- **`ratingSum` column:** ABSENT — must be added as `integer('rating_sum').notNull().default(0)`. Required by SRS UC-22 post-condition. Stores the integer sum of all visible stars, enabling exact moderation-safe recalculation: `averageRating = ratingSum / reviewCount` without floating-point drift.
- **`reviewCount` column:** ABSENT — must be added as `integer('review_count').notNull().default(0)`. Named `reviewCount` (not `ratingCount`) per SRS BR-22.12.

### 3.4 Notification BC — Impact Assessment

`apps/api/src/module/notification/domain/notification.schema.ts` (current):
- `notificationTypeEnum` has 16 values; the value `'new_review'` is **absent**
- Adding `'new_review'` requires: (1) schema update, (2) migration `ALTER TYPE ... ADD VALUE`, (3) new event handler file, (4) `NotificationModule` providers array update

---

## 4. Gap Analysis

The following 16 gaps must be closed to deliver UC-22. Each gap maps to one or more files in the change plan (Section 20).

| Gap ID | Gap Description | Severity | Files Impacted |
|---|---|---|---|
| GAP-01 | No `reviews` table exists in the database | Critical | New `review.schema.ts`, migration |
| GAP-02 | No `ReviewModule`, `ReviewController`, `ReviewService`, `ReviewRepository` exist | Critical | 7 new files under `module/review/` |
| GAP-03 | No `SubmitReviewCommand` and `SubmitReviewHandler` exist | Critical | 2 new files under `module/review/commands/` |
| GAP-04 | No `SubmitReviewDto` / `ReviewResponseDto` exist | Critical | New `review.dto.ts` |
| GAP-05 | `restaurants` table missing `averageRating`, `ratingSum`, and `reviewCount` columns | Critical | `restaurant.schema.ts`, migration |
| GAP-06 | `ReviewSubmittedEvent` absent from `shared/events/` | High | New `review-submitted.event.ts`, `shared/events/index.ts` |
| GAP-07 | `notificationTypeEnum` missing `'new_review'` value | High | `notification.schema.ts`, migration |
| GAP-08 | No `ReviewSubmittedNotificationHandler` in Notification BC | High | New `events/review-submitted.handler.ts` |
| GAP-09 | `NotificationModule` providers array not updated for new handler | High | `notification.module.ts` |
| GAP-10 | `ReviewModule` not registered in `AppModule` | Critical | `app.module.ts` |
| GAP-11 | Review schema not exported from `src/drizzle/schema.ts` barrel | Critical | `drizzle/schema.ts` |
| GAP-12 | Mobile: no review submission API client or rate-order screen | High | New `review.api.ts`, new `rate-order-screen.tsx`, `order-detail-screen.tsx` |
| GAP-13 | Mobile `OrderDetail` type AND backend `GET /orders/my/:id` response missing `hasReview` field — both frontend type and backend service must be updated together | High | `apps/mobile/src/features/orders/types/index.ts`, `apps/api/src/module/ordering/order-history/dto/order-history.dto.ts`, `apps/api/src/module/ordering/order-history/services/order-history.service.ts` |
| GAP-14 | Web: `Restaurant` type missing `averageRating`/`reviewCount`; no review display | Medium | `apps/web/src/features/restaurant/api/restaurant.types.ts` |
| GAP-15 | Expo Router cannot have both `[id].tsx` (file) and `[id]/rate.tsx` (nested route) — existing `apps/mobile/src/app/(customer)/orders/[id].tsx` must be **renamed** to `[id]/index.tsx` before the `rate.tsx` route can be added | High | `apps/mobile/src/app/(customer)/orders/[id].tsx` → rename to `[id]/index.tsx` |
| GAP-16 | `ratingSum` column missing from `restaurants` table — required by SRS UC-22 post-condition for moderation-safe rating recalculation (BR-22.13 hide/unhide scenarios) | Critical | `restaurant.schema.ts`, migration |

---

## 5. Proposed Architecture

### 5.1 Architectural Position

The Review & Rating BC is a new, first-class bounded context inside the NestJS modular monolith. Its authority is established in:

- **SRS:** CUS-FR-10, lines 1695–1820
- **ADD:** Logical View Section 3.1 — Review & Rating BC with 4 sub-components (Eligibility, Reviews, Ratings, Aggregation)
- **ADR-002:** Option C (Bounded Context Separation) — Review & Rating BC explicitly accepted as a separate BC
- **SAD:** Section 3.1.5.1.2 Element Catalog — "Review & Rating BC owns eligibility, review records, rating aggregation"

### 5.2 Module Position in Monolith

```
apps/api/src/
  module/
    review/                          ← NEW bounded context root
      review.module.ts               ← @Module decorator, imports, providers
      domain/
        review.schema.ts             ← Drizzle schema: reviews table + enums
      dto/
        review.dto.ts                ← SubmitReviewDto, ReviewResponseDto
      commands/
        submit-review.command.ts     ← CQRS command POJO
        submit-review.handler.ts     ← @CommandHandler — core business logic
      repositories/
        review.repository.ts         ← Drizzle queries for reviews table
      controllers/
        review.controller.ts         ← POST /reviews, GET /reviews endpoints
      services/
        review.service.ts            ← Orchestration service (CommandBus proxy)
```

### 5.3 Cross-BC Dependency Directions

```
Review BC
  ←── reads ───────────── Ordering BC: orders table (cross-BC read via shared DB)
  ──── writes ──────────→ Restaurant Catalog BC: restaurants.averageRating update
                            (executed in same DB transaction; no port required)
  ──── publishes ──────→  Domain Events Hub: ReviewSubmittedEvent
  ←── subscribes ─────── Domain Events Hub: (none — ReviewBC does not consume events)

Notification BC
  ←── subscribes ──────── Domain Events Hub: ReviewSubmittedEvent
  ──── dispatches ─────→  restaurant owner notification (new_review type)
```

### 5.4 Architecture Decision Alignment

| Decision | Source | How Review BC Complies |
|---|---|---|
| Single backend deployable | ADR-001 | Review BC is a NestJS module inside `apps/api`, not a separate service |
| Bounded context separation | ADR-002 | Review BC owns all review data; does not import from Ordering or Notification module internals |
| No shared domain models | ADR-003 | Cross-BC references are plain UUIDs; `restaurantId` is snapshotted onto review row at creation |
| In-process EventBus | ADR-004 | `eventBus.publish(new ReviewSubmittedEvent(...))` after DB transaction |
| Events published post-commit | ADR-004, TransitionOrderHandler pattern | EventBus publish is called outside the `db.transaction()` block |
| Input validation at system boundary | ADR-005 | `ValidationPipe` on `SubmitReviewDto`; no validation inside repository |
| Provider abstraction | ADR-007 | No external provider needed for R2; moderation engine is future scope |

---

## 6. Bounded Context Ownership

### 6.1 Review BC Owns

| Data | Table / Column | Owned By |
|---|---|---|
| Review records | `reviews` (all columns) | Review BC exclusively |
| Moderation status | `reviews.moderation_status`, `reviews.moderation_reason` | Review BC (future admin governance) |
| Review eligibility decisions | In-memory; not persisted separately | Review BC (`SubmitReviewHandler`) |

### 6.2 Review BC Reads (Without Owning)

| Data | Source | Access Pattern | Justification |
|---|---|---|---|
| Order ownership (`customerId`) | `orders.customer_id` | Direct DB query by `orderId` (UUID) | Same-process DB access; no BC module import; ADR-003 read-side pattern |
| Order delivery status (`status`) | `orders.status` | Same query as above | Only the `id`, `customerId`, `restaurantId`, `status` columns are read |
| Restaurant ID for snapshot | `orders.restaurant_id` | Same query | `restaurantId` is copied to review row (snapshot, not FK) |

### 6.3 Review BC Writes Outside Its Own Table (With Authorization)

| Data | Target | Write Pattern | Justification |
|---|---|---|---|
| `restaurants.average_rating` | Restaurant Catalog schema | SQL UPDATE inside same DB transaction | Rating aggregation is the explicit responsibility of Review Aggregation sub-component per ADD logical view; co-located in same DB makes transactional consistency achievable without distributed transaction |
| `restaurants.rating_count` | Restaurant Catalog schema | Same transaction | Denormalization required by BR-22.12; UC-3 reads these columns |

### 6.4 Review BC Cross-BC Prohibition (What It Must NOT Do)

- Must not import `OrderingModule`, `NotificationModule`, or `RestaurantCatalogModule` TypeScript classes
- Must not use the `PROMOTION_APPLICATION_PORT` or `PAYMENT_INITIATION_PORT`
- Must not subscribe to domain events from other BCs (Review BC is a consumer of orders data only via DB)
- Must not expose its `ReviewRepository` or `ReviewService` as exports (not `@Global()`)

---

## 7. Domain Model Design

### 7.1 Review Aggregate

A **Review** is an aggregate root owned by the Review BC. Its lifecycle:

```
[eligible order identified]
        │
        ▼
[Review created with status = visible]
        │
        ├── moderation flags → status = flagged
        │
        └── admin hides → status = hidden
```

### 7.2 Review State Machine

| State | Meaning | Included in Rating Projection? | Included in Public Listing? |
|---|---|---|---|
| `visible` | Default; public | Yes | Yes |
| `flagged` | Reported by restaurant; awaiting admin | Yes (still visible until actioned) | Yes |
| `hidden` | Admin moderated (removed from view) | No | No |

### 7.3 Review Invariants

1. **One-review-per-order:** A single `orderId` can appear in `reviews` exactly once (DB UNIQUE constraint is the authoritative enforcer).
2. **Eligibility-before-creation:** `order.status = 'delivered'` and `order.customerId = actorId` must hold at the instant of insert.
3. **Stars range:** 1 ≤ `stars` ≤ 5 (integer).
4. **Comment length:** `comment.length ≤ 1000` after trimming (optional field).
5. **Tags:** maximum 5 items from a pre-defined allowlist (validation in DTO).
6. **restaurantId is a snapshot:** The `restaurantId` on the review row is copied from the order at creation time and is immutable afterward.
7. **Rating projection is transactional:** The review row insert and the `restaurants.averageRating` / `ratingSum` / `reviewCount` update happen in the same DB transaction.

---

## 8. Database Design

### 8.1 New Table: `reviews`

```sql
-- Drizzle schema equivalent (see review.schema.ts)
CREATE TYPE review_moderation_status AS ENUM ('visible', 'flagged', 'hidden');

CREATE TABLE reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL UNIQUE,          -- one review per order (BR-22.8)
  customer_id     UUID NOT NULL,                 -- snapshot; no FK to auth.users
  restaurant_id   UUID NOT NULL,                 -- snapshot; no FK to restaurants
  stars           SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment         TEXT,                          -- nullable; max 1000 chars enforced at app layer
  tags            TEXT[],                        -- nullable; max 5 items
  moderation_status review_moderation_status NOT NULL DEFAULT 'visible',
  moderation_reason TEXT,                        -- nullable; populated when flagged/hidden
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Query optimization indices
CREATE INDEX reviews_restaurant_id_moderation_idx ON reviews (restaurant_id, moderation_status);
CREATE INDEX reviews_customer_id_idx ON reviews (customer_id);
```

**Column rationale:**

| Column | Type | Rationale |
|---|---|---|
| `id` | UUID | Consistent with all other BC primary keys |
| `order_id` | UUID UNIQUE | One-review-per-order invariant (BR-22.8); UNIQUE replaces composite `(orderId, customerId)` since one order belongs to one customer by definition |
| `customer_id` | UUID | Snapshot of `orders.customerId` at creation; needed for `GET /reviews/my/:orderId` |
| `restaurant_id` | UUID | Snapshot of `orders.restaurantId` at creation; needed for `GET /reviews/restaurant/:restaurantId` and rating projection |
| `stars` | SMALLINT (1–5) | Small integer; check constraint is secondary enforcement to app-layer DTO |
| `comment` | TEXT nullable | Optional; no DB-length constraint (app enforces 1000 chars) |
| `tags` | TEXT[] nullable | PostgreSQL native array; max 5 items enforced at app layer |
| `moderation_status` | ENUM | BR-22.13 moderation state machine |
| `moderation_reason` | TEXT nullable | Set by admin when hiding/flagging; audit trail |
| `created_at` / `updated_at` | TIMESTAMPTZ | Standard audit columns |

### 8.2 Modified Table: `restaurants`

Three new columns on the existing `restaurants` table (per SRS UC-22 post-condition: `ratingSum`, `reviewCount`, derived `averageRating`):

```sql
ALTER TABLE restaurants
  ADD COLUMN average_rating REAL    NOT NULL DEFAULT 0,
  ADD COLUMN rating_sum     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN review_count   INTEGER NOT NULL DEFAULT 0;
```

**Drizzle schema additions (`restaurant.schema.ts`):**
```typescript
averageRating: real('average_rating').notNull().default(0),
ratingSum:     integer('rating_sum').notNull().default(0),
reviewCount:   integer('review_count').notNull().default(0),
```

> **Column naming:** SRS BR-22.12 explicitly uses `restaurants.reviewCount` — not `ratingCount`. All references in this proposal use `reviewCount`.

**Rating projection formula (BR-22.12) — integer-based for precision:**
```sql
-- Applied atomically in the review insert transaction.
-- Uses integer ratingSum to avoid floating-point accumulation across many reviews.
UPDATE restaurants
SET
  rating_sum     = rating_sum + :stars,
  review_count   = review_count + 1,
  average_rating = (rating_sum + :stars)::real / (review_count + 1),
  updated_at     = NOW()
WHERE id = :restaurantId;
```

> **Precision rationale:** Storing `rating_sum` as an integer and computing `averageRating` from it on every update eliminates cumulative floating-point rounding errors that would occur with the recursive `(avg × count + stars) / (count + 1)` formula. Additionally, when a review is later hidden (admin moderation, BR-22.13), `rating_sum` can be precisely decremented: `rating_sum -= stars`, `review_count -= 1`, re-derive `average_rating`. Without `rating_sum`, moderation recalculation is impossible without re-scanning all reviews.

### 8.3 Migration Strategy

A single Drizzle migration file (`apps/api/src/drizzle/out/XXXX_review_bc.sql`) generated by `pnpm drizzle-kit generate` will contain:
1. `CREATE TYPE review_moderation_status AS ENUM (...)` 
2. `CREATE TABLE reviews (...)` with UNIQUE and check constraints
3. `CREATE INDEX` statements for `reviews`
4. `ALTER TABLE restaurants ADD COLUMN average_rating ...`
5. `ALTER TABLE restaurants ADD COLUMN rating_count ...`
6. `ALTER TYPE notification_type ADD VALUE 'new_review'` (PostgreSQL allows appending to existing enums without table rewrite)

> **Critical migration constraint:** `ALTER TYPE ... ADD VALUE` cannot be executed inside a transaction block in PostgreSQL < 12. The migration runner must execute this statement outside a transaction, or use a separate migration step. The existing codebase uses `apply-migration-XXXX.mjs` scripts for manual migration application — a new `apply-migration-review.mjs` script should be provided for the `new_review` enum addition (matching the pattern of `apply-migration-0011.mjs` and `apply-migration-0013.mjs`).

---

## 9. API Design

### 9.1 Endpoints

#### `POST /reviews` — Submit Review

**Authentication:** Required — Better Auth Bearer session (`@UseGuards(AuthGuard)`, role `'user'`)

**Request Body:**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "stars": 4,
  "comment": "Great food, fast delivery!",
  "tags": ["fast_delivery", "good_packaging"]
}
```

**Allowed `tags` values (pre-defined allowlist):**
`"fast_delivery"`, `"good_packaging"`, `"fresh_food"`, `"accurate_order"`, `"friendly_service"`, `"poor_packaging"`, `"late_delivery"`, `"wrong_order"`, `"cold_food"`, `"missing_items"`

**Success Response — HTTP 201:**
```json
{
  "id": "uuid",
  "orderId": "uuid",
  "restaurantId": "uuid",
  "stars": 4,
  "comment": "Great food, fast delivery!",
  "tags": ["fast_delivery"],
  "moderationStatus": "visible",
  "createdAt": "2025-01-01T12:00:00.000Z",
  "message": "Thank you for your review."
}
```

**Error Responses:**

| HTTP | Code | Condition |
|---|---|---|
| 400 | MSG-RATE-01 | DTO validation failure (invalid stars, comment too long) |
| 401 | — | No valid session |
| 404 | MSG-HIST-01 | Order not found, or `order.customerId ≠ session.user.id` |
| 409 | MSG-RATE-03 | Review already exists for this order |
| 422 | MSG-RATE-02 | Order status is not `'delivered'` |

---

#### `GET /reviews/restaurant/:restaurantId` — List Restaurant Reviews

**Authentication:** Optional (public endpoint — returns only `visible` reviews)

**Query Parameters:**
| Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer | 1 | Page number (1-based) |
| `limit` | integer | 20 | Items per page (max 50) |

**Success Response — HTTP 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "stars": 5,
      "comment": "Amazing!",
      "tags": ["fast_delivery"],
      "createdAt": "2025-01-01T12:00:00.000Z"
    }
  ],
  "total": 142,
  "page": 1,
  "limit": 20
}
```

> **Privacy note:** Customer identity (`customerId`) is NOT exposed on public review listings to protect customer privacy. Only star rating, comment, tags, and timestamp are returned.

---

#### `GET /reviews/my/:orderId` — Get My Review for an Order

**Authentication:** Required (`role = 'user'`)

**Success Response — HTTP 200:** Same shape as the `POST /reviews` 201 body.

**Error Response — HTTP 404 + MSG-RATE-05:** Review does not exist for this order.

---

### 9.2 Route Prefix

All Review BC endpoints are prefixed with `/reviews`. The controller uses `@Controller('reviews')`.

### 9.3 DTO Shape

```typescript
// SubmitReviewDto
class SubmitReviewDto {
  @IsUUID()
  orderId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  stars: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => value?.trim())
  comment?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsIn(ALLOWED_REVIEW_TAGS, { each: true })
  tags?: string[];
}
```

---

## 10. Backend Implementation Design

### 10.1 Module Architecture

```typescript
// review.module.ts
@Module({
  imports: [DatabaseModule, CqrsModule],
  controllers: [ReviewController],
  providers: [
    ReviewService,
    ReviewRepository,
    SubmitReviewHandler,   // @CommandHandler
  ],
  exports: [],  // NOT @Global(); no external consumers need Review internals
})
export class ReviewModule {}
```

**Design rationale:** Review BC does not export any providers because no other BC needs to inject from it. The only cross-BC interaction is via shared events (publish-only) and the shared DB connection (read on `orders` table, write on `restaurants` table). This preserves BC isolation per ADR-002.

### 10.2 Request Lifecycle

```
HTTP POST /reviews
  → AuthGuard (validate Better Auth session → extract user.id, user.role)
  → ReviewController.submitReview(dto, session)
  → ReviewService.submit(dto, customerId)
  → CommandBus.execute(new SubmitReviewCommand(dto, customerId))
  → SubmitReviewHandler.execute(cmd)
      1. ReviewRepository.findByOrderId(orderId)
         → 409 if duplicate (BR-22.9)
      2. DB query: SELECT id, customer_id, restaurant_id, status FROM orders WHERE id = orderId
         → 404 if order not found
         → 404 if order.customerId ≠ cmd.customerId  (BR-22.4, BR-22.5)
         → 422 if order.status ≠ 'delivered'  (BR-22.6, BR-22.7)
      3. db.transaction(tx => {
           INSERT INTO reviews (...)
           UPDATE restaurants SET average_rating = ..., rating_count = rating_count + 1
         })
         → 409 on UniqueConstraintViolation (DB is authoritative, BR-22.8)
      4. eventBus.publish(new ReviewSubmittedEvent(...))
         [post-commit]
  → 201 Created with ReviewResponseDto
```

### 10.3 SubmitReviewHandler — Critical Logic

The handler is the core of the Review BC. The following logic must be implemented exactly as specified:

**Step 1 — Duplicate pre-check (optimistic, BR-22.9):**
```typescript
const existing = await this.reviewRepo.findByOrderId(cmd.orderId);
if (existing) {
  throw new ConflictException({
    message: 'You have already submitted a review for this order.',  // MSG-RATE-03
    code: 'MSG-RATE-03',
    existingReview: {
      createdAt: existing.createdAt,
      stars: existing.stars,
    },
  });
}
```

**Step 2 — Order eligibility check (BR-22.3, BR-22.4, BR-22.5, BR-22.6):**
```typescript
// Direct DB read on orders table — cross-BC read is permitted per ADR-003
const order = await this.db
  .select({
    id: orders.id,
    customerId: orders.customerId,
    restaurantId: orders.restaurantId,
    status: orders.status,
  })
  .from(orders)
  .where(eq(orders.id, cmd.orderId))
  .limit(1);

if (!order.length) {
  throw new NotFoundException('Order not found.');  // MSG-HIST-01
}
const o = order[0];

// BR-22.4 / BR-22.5: ownership — return 404 not 403 to avoid existence leak
if (o.customerId !== cmd.customerId) {
  throw new NotFoundException('Order not found.');
}

// BR-22.6 / BR-22.7
if (o.status !== 'delivered') {
  throw new UnprocessableEntityException(
    'You can only review an order that has been delivered.',  // MSG-RATE-02
  );
}
```

**Step 3 — Transactional insert + rating projection (BR-22.11, BR-22.12):**
```typescript
const review = await this.db.transaction(async (tx) => {
  // Insert review row
  const [inserted] = await tx
    .insert(reviews)
    .values({
      orderId: cmd.orderId,
      customerId: cmd.customerId,
      restaurantId: o.restaurantId,
      stars: cmd.stars,
      comment: cmd.comment ?? null,
      tags: cmd.tags ?? null,
      moderationStatus: 'visible',
    })
    .returning();

  // BR-22.12: rating projection using integer ratingSum for precision
  // Formula: newAvg = (ratingSum + newStars)::real / (reviewCount + 1)
  // ratingSum and reviewCount updated atomically in the same SET clause:
  await tx
    .update(restaurants)
    .set({
      ratingSum:     sql`rating_sum + ${cmd.stars}`,
      reviewCount:   sql`review_count + 1`,
      averageRating: sql`(rating_sum + ${cmd.stars})::real / (review_count + 1)`,
      updatedAt: new Date(),
    })
    .where(eq(restaurants.id, o.restaurantId));

  return inserted;
});
```

**Step 4 — Post-commit event publication (BR-22.11):**
```typescript
// Published OUTSIDE the transaction block — consistent with TransitionOrderHandler pattern
try {
  this.eventBus.publish(
    new ReviewSubmittedEvent(
      review.id,
      review.orderId,
      review.customerId,
      review.restaurantId,
      review.stars,
    ),
  );
} catch (err) {
  this.logger.error('Failed to publish ReviewSubmittedEvent', err);
  // DB state is authoritative; event publication failure is observable but non-fatal
}
```

**Step 5 — DB UniqueConstraintViolation catch (BR-22.8):**

The `db.transaction()` call must be wrapped in a try-catch that intercepts PostgreSQL error code `23505` (unique violation) and rethrows as a `ConflictException`. This handles the race condition between two simultaneous submit requests that both pass the optimistic pre-check.

```typescript
try {
  const review = await this.db.transaction(async (tx) => { /* ... */ });
  // publish event...
  return review;
} catch (err: any) {
  if (err?.code === '23505') {
    throw new ConflictException('You have already submitted a review for this order.');
  }
  throw err;
}
```

### 10.4 ReviewRepository

```typescript
class ReviewRepository {
  findByOrderId(orderId: string): Promise<Review | null>
  findByRestaurantId(restaurantId: string, opts: PaginationOpts): Promise<{ data: Review[]; total: number }>
  findByOrderIdAndCustomerId(orderId: string, customerId: string): Promise<Review | null>
}
```

All queries use parameterized Drizzle ORM expressions (never raw SQL string interpolation).

The `findByRestaurantId` method must include a `WHERE moderation_status = 'visible'` filter (BR-22.13).

### 10.5 ReviewController

```typescript
@Controller('reviews')
export class ReviewController {
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async submitReview(
    @Body() dto: SubmitReviewDto,
    @Session() session: UserSession,
  ): Promise<ReviewResponseDto>

  @Get('restaurant/:restaurantId')
  // Public — no session guard; any caller may read visible reviews
  async getRestaurantReviews(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<ReviewListResponseDto>

  @Get('my/:orderId')
  async getMyReview(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Session() session: UserSession,
  ): Promise<ReviewResponseDto>
}
```

> **Auth pattern note (critical):** The codebase uses `@Session() session: UserSession` from `@thallesp/nestjs-better-auth` — NOT `@UseGuards(AuthGuard)` or a custom `@Roles()` decorator. The `@Session()` decorator automatically throws `401 Unauthorized` when no valid Better Auth session exists. Role enforcement is done inline: `if (!hasRole(session.user.role, 'user')) throw new ForbiddenException()`. This matches the pattern used by all existing controllers (`OrderLifecycleController`, `OrderHistoryCustomerController`, etc.). The `UserSession` import: `import { Session, type UserSession } from '@thallesp/nestjs-better-auth'`.

---

## 11. Event Design

### 11.1 ReviewSubmittedEvent

**File:** `apps/api/src/shared/events/review-submitted.event.ts`

```typescript
/**
 * ReviewSubmittedEvent
 *
 * Published by: Review BC (SubmitReviewHandler) after successful DB commit
 * Consumed by:
 *  - Notification BC — send new_review notification to restaurant owner
 *
 * Published AFTER the DB transaction commits so consumers always see
 * consistent data. Consistent with the pattern established by TransitionOrderHandler.
 */
export class ReviewSubmittedEvent {
  constructor(
    public readonly reviewId: string,
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly restaurantId: string,
    public readonly stars: number,
  ) {}
}
```

**Registration:** Add `export * from './review-submitted.event';` to `shared/events/index.ts`.

### 11.2 Event Consumer: ReviewSubmittedNotificationHandler

**File:** `apps/api/src/module/notification/events/review-submitted.handler.ts`

This handler follows the exact pattern of `order-placed.handler.ts` (the canonical notification handler):

```typescript
@Injectable()
@EventsHandler(ReviewSubmittedEvent)
export class ReviewSubmittedNotificationHandler
  implements IEventHandler<ReviewSubmittedEvent> {

  private readonly logger = new Logger(ReviewSubmittedNotificationHandler.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly restaurantAclRepo: NotificationRestaurantAclRepository,
  ) {}

  async handle(event: ReviewSubmittedEvent): Promise<void> {
    this.logger.log(
      `ReviewSubmittedEvent received: reviewId=${event.reviewId} restaurantId=${event.restaurantId} stars=${event.stars}`,
    );
    try {
      await this.processNotifications(event);
    } catch (err) {
      // Never rethrow from an event handler (CQRS EventBus constraint).
      this.logger.error(
        `ReviewSubmittedNotificationHandler failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  private async processNotifications(event: ReviewSubmittedEvent): Promise<void> {
    // Look up restaurant owner via ACL snapshot
    const snapshot = await this.restaurantAclRepo.findByRestaurantId(event.restaurantId);
    if (!snapshot) {
      this.logger.warn(
        `[ReviewSubmittedNotificationHandler] No ACL snapshot for restaurantId=${event.restaurantId} — owner notification skipped.`,
      );
      return;
    }

    // Send new_review notification to restaurant owner
    // sendFromEvent() signature: SendFromEventParams (see notification.service.ts)
    await this.notificationService.sendFromEvent({
      type: 'new_review',
      recipientId: snapshot.ownerId,
      recipientRole: 'restaurant',
      sourceId: event.reviewId,            // idempotency key: notif:new_review:{reviewId}:{ownerId}:{channel}
      templateData: {
        orderId: event.orderId,
        restaurantName: snapshot.name,
        stars: String(event.stars),
      },
      channels: ['in_app', 'push'],
      orderId: event.orderId,
    });
  }
}
```

> **Interface note:** `notificationService.sendFromEvent()` accepts `SendFromEventParams` (see `apps/api/src/module/notification/services/notification.service.ts`), which requires `type`, `recipientId`, `recipientRole`, `sourceId`, `templateData` (all string values), `channels`, and optionally `orderId`. There is NO `payload` field — template variables are passed as flat `Record<string, string>` via `templateData`. Stars must be converted with `String(event.stars)` since all template data values must be strings.

### 11.3 NotificationModule Update

`ReviewSubmittedNotificationHandler` must be added to `NotificationModule.providers[]`. The `CqrsModule` is already imported in `NotificationModule`, so `@EventsHandler` will be recognized automatically.

### 11.4 Event Flow Diagram

```
Customer HTTP POST /reviews
         │
         ▼
SubmitReviewHandler
         │
         ▼ (DB transaction)
reviews INSERT + restaurants UPDATE
         │
         ▼ (post-commit)
eventBus.publish(ReviewSubmittedEvent)
         │
         ▼
ReviewSubmittedNotificationHandler (Notification BC)
         │
         ├── restaurantAclRepo.findByRestaurantId(event.restaurantId)
         │
         └── notificationService.sendFromEvent({
               type: 'new_review',
               recipientId: ownerInfo.ownerId,
               channels: ['in_app', 'push']
             })
```

---

## 12. Security Design

### 12.1 Authentication and Authorization

| Endpoint | Auth Required | Role Required | Enforcement |
|---|---|---|---|
| `POST /reviews` | Yes | `'user'` (customer) | `@Session() session: UserSession` (auto-throws 401 if no session) + inline `hasRole(session.user.role, 'user')` check (throws 403 if wrong role) |
| `GET /reviews/restaurant/:id` | No (public) | None | No `@Session()` guard — open read endpoint; returns only `visible` moderation-status reviews |
| `GET /reviews/my/:orderId` | Yes | `'user'` | Same as `POST /reviews` |

**Import used in controller:**
```typescript
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { hasRole } from '@/module/auth/role.util';
```

**No `@UseGuards(AuthGuard)` or `@Roles()` decorator is used.** The actual codebase does not implement these patterns — all existing controllers (`OrderLifecycleController`, `OrderHistoryCustomerController`) rely on `@Session()` for authentication and call `hasRole()` inline for authorization.

**Session extraction:** The `session.user.id` is passed as `customerId` to the command — it is never taken from the request body or query parameters.

### 12.2 Ownership Verification (BR-22.4, BR-22.5)

The handler verifies `order.customerId === session.user.id` server-side. A mismatch returns HTTP 404 (not 403) to prevent leaking order existence to non-owners (BR-22.5). This mirrors the pattern used in `OrderHistoryService`.

### 12.3 Input Validation (BR-22.1, QA-S-05)

All incoming data passes through `class-validator` decorators on `SubmitReviewDto`:
- `stars`: `@IsInt() @Min(1) @Max(5)` — prevents non-integer and out-of-range values
- `comment`: `@MaxLength(1000) @IsString()` — length-bound to prevent large payload injection
- `comment`: `@Transform(({ value }) => value?.trim())` — strips leading/trailing whitespace
- `orderId`: `@IsUUID()` — prevents SQL injection through invalid UUID formats (though Drizzle uses parameterized queries)
- `tags`: `@IsIn(ALLOWED_REVIEW_TAGS, { each: true }) @ArrayMaxSize(5)` — allowlist prevents arbitrary tag injection

### 12.4 Injection Resistance

All DB queries use Drizzle ORM parameterized methods (`eq()`, `sql` tagged template). No raw SQL string interpolation is used anywhere in the Review BC. This satisfies QA-S-05 and OWASP A03 (Injection).

### 12.5 Rate Limiting (QA-SUP-01 — Planned)

The endpoint should be subject to the platform rate limiter once the planned NestJS Throttler integration is implemented. The Review BC itself does not implement rate limiting — it relies on the infrastructure-layer throttler (`RateLimiting` component in SAD §3.5).

### 12.6 Cross-Site Scripting (XSS) Prevention

The `comment` field is stored as plain text. The API response serves it as-is. Mobile and web frontends are responsible for escaping/sanitizing before rendering. The web frontend must use `textContent` / React's escaped rendering (not `dangerouslySetInnerHTML`) when displaying review comments. This satisfies OWASP A03 at the persistence layer.

### 12.7 Duplicate Submission (CSRF / Replay)

The `UNIQUE(order_id)` constraint provides a server-side idempotency guarantee. A customer cannot submit a second review for the same order even if the same request is replayed. The HTTP 409 response body (including the existing review's `createdAt` and `stars`) enables the client to detect and display the conflict gracefully.

---

## 13. Mobile Application Design

### 13.1 Current Mobile State

- `Restaurant` type already has `rating?: number` and `reviewCount?: number` as optional fields with the comment "may not be in API yet" — these are ready to be connected
- `OrderDetail` type has no `hasReview` or `review` fields
- There is no review submission screen (`rate-order-screen.tsx` does not exist)
- There is no review API client file in `apps/mobile/src/features/`

### 13.2 New Files Required

#### `apps/mobile/src/features/review/api/review.api.ts`
```typescript
// Uses apiFetch<T> from @/src/lib/api-client
export async function submitReview(dto: SubmitReviewDto): Promise<ReviewResponse>
export async function getMyReview(orderId: string): Promise<ReviewResponse | null>
```

#### `apps/mobile/src/features/review/screen/rate-order-screen.tsx`

A full-screen modal (or sheet) presented when the customer taps "Rate Order" on the order detail screen.

**UI elements:**
- Restaurant name (passed via navigation params)
- 5-star interactive selector (tappable star icons using `react-native-gesture-handler` or equivalent)
- Optional comment text input (`maxLength={1000}`, multiline)
- Optional tag chip selector (grid of pre-defined tags)
- Submit button (`TanStack Mutation` → `submitReview()`)
- Error handling: toast/alert for 409 (already reviewed), 422 (not delivered), 400 (validation)
- Success: navigate back with confirmation toast

#### `apps/mobile/src/app/(customer)/orders/[id]/rate.tsx`

New Expo Router route: `/orders/[id]/rate` — renders `RateOrderScreen`.

> **Critical prerequisite (GAP-15):** Expo Router cannot coexist a **file** `[id].tsx` and a **directory** `[id]/` for the same path segment. The existing file `apps/mobile/src/app/(customer)/orders/[id].tsx` must be **renamed to `apps/mobile/src/app/(customer)/orders/[id]/index.tsx`** before this `rate.tsx` file can be added. The rename preserves the current `/orders/:id` route (file `index.tsx` in a directory is equivalent to the directory route). Without this rename, Expo Router will throw a routing conflict error at startup.

### 13.3 Modified Files

#### `apps/mobile/src/features/orders/types/index.ts`

Add to `OrderDetail` interface:
```typescript
hasReview?: boolean;
review?: {
  stars: number;
  comment?: string;
  tags?: string[];
  createdAt: string;
};
```

> **Backend dependency (GAP-13):** The mobile type only reflects the API response. The backend `GET /orders/my/:id` endpoint must simultaneously be updated so that `order-history.service.ts` queries for an existing review by `orderId` and includes `hasReview` in the mapped `OrderDetailDto`. Without the backend change, `hasReview` will always be absent (see Section 20.3 — backend order-history changes).

#### `apps/mobile/src/app/(customer)/orders/[id].tsx` → **RENAME to `[id]/index.tsx`**

**Action: RENAME (prerequisite — GAP-15).** Expo Router cannot coexist a file `[id].tsx` and a directory `[id]/` at the same path segment. The existing `[id].tsx` must be converted before `rate.tsx` can be added:

1. Create directory `apps/mobile/src/app/(customer)/orders/[id]/`
2. Move file content to `apps/mobile/src/app/(customer)/orders/[id]/index.tsx`
3. Delete `apps/mobile/src/app/(customer)/orders/[id].tsx`

The `/orders/:id` route continues to work — Expo Router resolves `[id]/index.tsx` identically to `[id].tsx`.

#### `apps/mobile/src/features/orders/screen/order-detail-screen.tsx`

Add conditional "Rate & Review" button that appears when:
- `order.status === 'delivered'`
- `order.hasReview === false || order.hasReview === undefined`

Button action: navigate to `/orders/${orderId}/rate` using Expo Router `router.push()`.

After successful review submission (via `useQueryClient().invalidateQueries`), the order detail will re-fetch and the button will be replaced with a "Review Submitted ✓" indicator.

### 13.4 TanStack Query Integration

```typescript
// useSubmitReview hook
export function useSubmitReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitReview,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['order', variables.orderId] });
    },
  });
}

// useMyReview hook
export function useMyReview(orderId: string) {
  return useQuery({
    queryKey: ['review', 'my', orderId],
    queryFn: () => getMyReview(orderId),
    enabled: !!orderId,
  });
}
```

---

## 14. Web Application Design

The web application (`apps/web`) is a restaurant-owner dashboard, not a customer app. The primary web impact is:

### 14.1 Restaurant Detail — Show Rating

When restaurant owners view their restaurant dashboard or customers browse via the web (if applicable), the `averageRating` and `reviewCount` from the API should be displayed.

#### `apps/web/src/features/restaurant/api/restaurant.types.ts`

Add to `Restaurant` type:
```typescript
averageRating?: number;  // 0.0 – 5.0
reviewCount?: number;    // total visible reviews
```

### 14.2 Review List on Restaurant Pages (Optional — R2 scope)

A read-only `RestaurantReviews` component can be added to restaurant detail pages to display the public review listing from `GET /reviews/restaurant/:restaurantId`. This is a display-only component and is lower priority than the submission flow.

**Deferred:** Full web review display implementation is scoped to R2. Only type updates are strictly required in R2 to prevent type errors when the API begins returning rating fields.

### 14.3 Admin Review Moderation (Future — R3 scope)

An admin moderation interface for marking reviews as `hidden` or `flagged` is out of scope for this proposal. The `moderationStatus` column and enum are provisioned in the schema to support this future capability without a schema change.

---

## 15. Notification Integration

### 15.1 new_review Notification Type

The `notificationTypeEnum` in `notification.schema.ts` must have `'new_review'` added. This type is used when the Notification BC receives a `ReviewSubmittedEvent` and dispatches a notification to the restaurant owner.

**Recipient:** Restaurant owner (`ownerInfo.ownerId` from `NotificationRestaurantAclRepository`)

**Channels for R2:** `in_app` + `push` (same as `new_order_received`)

**Template payload:**
```typescript
{
  type: 'new_review',
  title: 'New Review Received',
  body: `You received a ${stars}-star review for order #${orderId.slice(-6).toUpperCase()}.`,
  payload: {
    orderId,
    restaurantId,
    stars,
  }
}
```

### 15.2 NotificationModule Registration

The `ReviewSubmittedNotificationHandler` must be added to `NotificationModule.providers[]`:

```typescript
// In notification.module.ts providers array:
ReviewSubmittedNotificationHandler,
```

**Import required:** The handler imports `ReviewSubmittedEvent` from `@/shared/events`. No circular dependency is introduced — the shared events module is a zero-dependency POJO collection.

### 15.3 NotificationTemplateService

The `NotificationTemplateService` in the Notification BC needs a `new_review` template entry. The service's `TEMPLATES` record maps each `NotificationType` to a function `(d: Record<string, string>) => NotificationTemplate`. All interpolation variables are plain strings. Following the existing pattern (e.g., `new_order_received` template), add:

```typescript
// Add immediately after 'new_order_received' entry:
// --- Restaurant owner receives a new customer review ---
new_review: (d) => ({
  title: 'Đánh giá mới!',
  body: `Nhà hàng ${d.restaurantName ?? 'của bạn'} vừa nhận được đánh giá ${d.stars ?? '?'} sao cho đơn #${d.orderId ?? '—'}.`,
}),
```

> **Key constraints from `NotificationTemplateService`:**
> - Template function signature is `(d: Record<string, string>) => NotificationTemplate` — all values are strings.
> - The handler must pass `stars: String(event.stars)` (not the raw number) inside `templateData`.
> - The `NotificationType` union from `notification.schema.ts` must include `'new_review'` before this template is added, or TypeScript will report a key error on the `TEMPLATES` record.

---

## 16. Testing Strategy

### 16.1 Unit Tests

#### `SubmitReviewHandler` (Critical — must cover all business rules)

| Test Case | Input | Expected |
|---|---|---|
| Happy path | Valid delivered order, no existing review | Review created, event published, 201 |
| Duplicate review (app-level) | `findByOrderId` returns existing | `ConflictException` 409 with review details |
| Order not found | DB returns no order rows | `NotFoundException` 404 |
| Order not owned | `order.customerId ≠ cmd.customerId` | `NotFoundException` 404 (not 403) |
| Order not delivered | `order.status = 'confirmed'` | `UnprocessableEntityException` 422 |
| DB unique constraint race | DB throws `code: '23505'` | `ConflictException` 409 |
| Event publish failure | `eventBus.publish()` throws | Error logged; no exception rethrown |

#### `ReviewRepository`

| Test Case | Description |
|---|---|
| `findByOrderId` returns null when no review | Query returns null correctly |
| `findByRestaurantId` excludes hidden reviews | `moderationStatus = 'visible'` filter applied |
| `findByRestaurantId` paginates correctly | `LIMIT` / `OFFSET` applied |

### 16.2 E2E Tests

**File:** `apps/api/test/review.e2e-spec.ts`

```
POST /reviews
  ✓ 201 — creates review for delivered order
  ✓ 400 — rejects stars = 0 (MSG-RATE-01)
  ✓ 400 — rejects comment > 1000 chars (MSG-RATE-01)
  ✓ 400 — rejects invalid UUID orderId (MSG-RATE-01)
  ✓ 401 — rejects unauthenticated request
  ✓ 404 — returns 404 for non-existent order (MSG-HIST-01)
  ✓ 404 — returns 404 when order belongs to other customer (MSG-HIST-01)
  ✓ 409 — returns 409 for duplicate review (MSG-RATE-03)
  ✓ 422 — returns 422 for non-delivered order (MSG-RATE-02)

GET /reviews/restaurant/:restaurantId
  ✓ 200 — returns paginated visible reviews
  ✓ 200 — does not include hidden reviews

GET /reviews/my/:orderId
  ✓ 200 — returns existing review for authenticated customer
  ✓ 404 — returns 404 when no review exists (MSG-RATE-05)
  ✓ 401 — rejects unauthenticated request
```

### 16.3 Integration Notes

- E2E test setup must create a test order in `delivered` status (bypass the full lifecycle by direct DB seed or by running through the lifecycle transitions via the test API)
- The E2E test database must be isolated from the unit test database
- Event publication should be verified using a spy on `eventBus.publish` (mock in unit tests; real EventBus in E2E)

---

## 17. Risks and Mitigations

| Risk ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-01 | Race condition: two simultaneous review submissions for same order both pass optimistic check and hit DB simultaneously | Low | Medium | DB `UNIQUE` constraint is authoritative (BR-22.8); PostgreSQL will reject the second insert with `code 23505`; handler maps this to 409 |
| R-02 | Rating manipulation: customer places order, receives delivery, submits fraudulent 1-star review | Low | Medium | One review per order (UNIQUE); customer must own the order; future admin moderation can hide fraudulent reviews |
| R-03 | `restaurants.averageRating` drift if review is hidden post-moderation | Low | Medium | R2 does not update the rating projection when moderation status changes; a future "recalculate rating" task is needed. Accepted risk for R2 — moderation is expected to be rare |
| R-04 | `ALTER TYPE ... ADD VALUE 'new_review'` cannot execute inside a transaction (PostgreSQL < 12) | Medium | High | Migration must add enum value in a separate step (e.g., `apply-migration-review.mjs`); consistent with existing migration scripts in the repo |
| R-05 | Review BC imports `orders` schema from Ordering BC — creates implicit coupling | Medium | Medium | Managed by importing from `@/drizzle/schema` (the shared Drizzle schema barrel) rather than from `@/module/ordering/order/order.schema.ts` directly; this follows the existing pattern used in `TransitionOrderHandler` |
| R-06 | `ReviewSubmittedEvent` publication fails after DB commit | Low | Low | DB state is authoritative; failure is logged at ERROR level; notification is missed but review is persisted. Observable via Render logs. No retry implemented in R2 |
| R-07 | Mobile star rating UI lacks accessibility support | Low | Low | Add `accessible={true}` and `accessibilityLabel` to star buttons; follow existing accessibility patterns in `order-detail-screen.tsx` |

---

## 18. Implementation Roadmap

### Phase RV-1 — Database Foundation (Prerequisite)

1. Add `averageRating`, `ratingSum`, `reviewCount` columns to `restaurant.schema.ts`
2. Add `reviews` table to new `review.schema.ts`
3. Export `review.schema.ts` from `drizzle/schema.ts`
4. Add `'new_review'` to `notificationTypeEnum` in `notification.schema.ts`
5. Generate Drizzle migration (`pnpm drizzle-kit generate`)
6. Create `apply-migration-review.mjs` for the enum `ADD VALUE` step
7. Apply migration to development database

### Phase RV-2 — Review BC Backend

1. Create `ReviewModule` directory structure
2. Implement `review.schema.ts` (Drizzle schema + TypeScript types)
3. Implement `SubmitReviewCommand` and `SubmitReviewHandler` (core business logic)
4. Implement `ReviewRepository` (findByOrderId, findByRestaurantId, findByOrderIdAndCustomerId)
5. Implement `SubmitReviewDto` + `ReviewResponseDto` with class-validator decorators
6. Implement `ReviewService` (CommandBus proxy)
7. Implement `ReviewController` (3 endpoints)
8. Register `ReviewModule` in `AppModule`
9. Unit tests for `SubmitReviewHandler` and `ReviewRepository`

### Phase RV-3 — Event Integration

1. Create `ReviewSubmittedEvent` in `shared/events/`
2. Add export to `shared/events/index.ts`
3. Publish `ReviewSubmittedEvent` in `SubmitReviewHandler` post-commit
4. Create `ReviewSubmittedNotificationHandler` in Notification BC
5. Register handler in `NotificationModule.providers[]`
6. Add `new_review` template to `NotificationTemplateService`
7. Unit tests for `ReviewSubmittedNotificationHandler`

### Phase RV-4 — E2E Tests and Validation

1. Write `test/review.e2e-spec.ts` (all scenarios in Section 16.2)
2. Validate complete flow: POST /reviews → DB insert → rating updated → event published → notification created
3. Verify 409 race condition handling with concurrent requests test

### Phase RV-5 — Mobile UI

1. Add `hasReview` and `review` fields to `OrderDetail` type
2. Create `review.api.ts` with `submitReview()` and `getMyReview()`
3. Create TanStack Query hooks (`useSubmitReview`, `useMyReview`)
4. Create `RateOrderScreen` with star selector, comment input, tag chips
5. Add Expo Router route `app/(customer)/orders/[id]/rate.tsx`
6. Add conditional "Rate & Review" button to `order-detail-screen.tsx`

### Phase RV-6 — Web UI (Minimal R2 Scope)

1. Update `restaurant.types.ts` to include `averageRating` and `reviewCount`
2. Display `averageRating` on restaurant detail pages (if applicable to web scope)

---

## 19. Definition of Done

The UC-22 implementation is complete when ALL of the following criteria are satisfied:

### Backend

- [ ] `reviews` table exists in production database with all columns and constraints (UNIQUE on `order_id`, CHECK on `stars`, index on `(restaurant_id, moderation_status)`)
- [ ] `restaurants.average_rating` and `restaurants.rating_count` columns exist in production database
- [ ] `POST /reviews` endpoint is operational and returns correct HTTP status codes for all documented scenarios
- [ ] `GET /reviews/restaurant/:restaurantId` endpoint returns paginated visible reviews
- [ ] `GET /reviews/my/:orderId` endpoint returns a customer's own review
- [ ] All 7 unit test scenarios for `SubmitReviewHandler` pass
- [ ] All 13 E2E test scenarios pass
- [ ] `ReviewSubmittedEvent` is published after successful review creation
- [ ] Restaurant owner receives `new_review` notification after review submission

### Data Integrity

- [ ] Submitting two reviews for the same order returns 409 (tested concurrently)
- [ ] Submitting a review for a non-delivered order returns 422
- [ ] Submitting a review for another customer's order returns 404
- [ ] `averageRating` on `restaurants` table is correct after multiple review submissions
- [ ] `reviewCount` increments correctly with each new visible review
- [ ] `ratingSum` increments by `stars` value with each new visible review
- [ ] `averageRating` equals `ratingSum / reviewCount` after multiple reviews

### Security

- [ ] Unauthenticated `POST /reviews` returns 401
- [ ] Session user ID is never taken from request body (always from AuthGuard session)
- [ ] No SQL injection vector in review text (all queries parameterized)
- [ ] `comment` longer than 1000 characters is rejected with 400

### Mobile

- [ ] "Rate & Review" button appears on delivered orders without a review
- [ ] Button is absent on non-delivered orders
- [ ] Button is absent if customer has already reviewed the order
- [ ] Review submission from mobile returns success toast
- [ ] 409 error is handled gracefully (shows existing review)

### Architecture

- [ ] `ReviewModule` does not import `OrderingModule`, `NotificationModule`, or `RestaurantCatalogModule` TypeScript classes
- [ ] `ReviewModule` is not `@Global()`
- [ ] Cross-BC reads use `@Inject(DB_CONNECTION)` with raw Drizzle queries, not injected services from other BCs
- [ ] `ReviewSubmittedEvent` is published strictly OUTSIDE the DB transaction

---

## 20. File-by-File Change Plan

### 20.1 New Files to Create (Backend)

---

#### `apps/api/src/module/review/domain/review.schema.ts`

**Action:** CREATE  
**Purpose:** Drizzle ORM schema for the `reviews` table and the `review_moderation_status` enum.

```typescript
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  smallint,
  timestamp,
  index,
  unique,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const reviewModerationStatusEnum = pgEnum(
  'review_moderation_status',
  ['visible', 'flagged', 'hidden'],
);

export type ReviewModerationStatus =
  (typeof reviewModerationStatusEnum.enumValues)[number];

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id').notNull(),            // UNIQUE enforced via unique() below
    customerId: uuid('customer_id').notNull(),
    restaurantId: uuid('restaurant_id').notNull(),
    stars: smallint('stars').notNull(),             // 1–5; app-layer validated + DB constraint below
    comment: text('comment'),                       // nullable; max 1000 chars app-enforced
    tags: text('tags').array(),                     // nullable; max 5 items app-enforced
    moderationStatus: reviewModerationStatusEnum('moderation_status')
      .notNull()
      .default('visible'),
    moderationReason: text('moderation_reason'),    // nullable; set by admin
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    unique('reviews_order_id_unique').on(table.orderId),
    index('reviews_restaurant_id_moderation_idx').on(
      table.restaurantId,
      table.moderationStatus,
    ),
    index('reviews_customer_id_idx').on(table.customerId),
    // DB-level guard: stars must be 1–5 regardless of app-layer validation
    check('reviews_stars_check', sql`${table.stars} BETWEEN 1 AND 5`),
  ],
);

export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
```

---

#### `apps/api/src/module/review/dto/review.dto.ts`

**Action:** CREATE  
**Purpose:** Input DTO with class-validator decorators (BR-22.1, QA-S-05), response DTO shape, and the allowed tags allowlist.

**Key contents:**
- `ALLOWED_REVIEW_TAGS` constant (string array of 10 pre-defined tag values)
- `SubmitReviewDto` with `@IsUUID()`, `@IsInt() @Min(1) @Max(5)`, `@IsOptional() @IsString() @MaxLength(1000) @Transform(trim)`, `@IsOptional() @IsArray() @ArrayMaxSize(5) @IsIn(ALLOWED_REVIEW_TAGS, { each: true })`
- `ReviewResponseDto` matching the 201 response shape (plain class, not using `@Expose()` unless the project uses `class-transformer` exclusion globally — check existing DTOs; prefer matching the pattern in `order-history.dto.ts`)

---

#### `apps/api/src/module/review/commands/submit-review.command.ts`

**Action:** CREATE  
**Purpose:** CQRS command POJO carrying the validated submission inputs plus the authenticated `customerId`.

```typescript
export class SubmitReviewCommand {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly stars: number,
    public readonly comment: string | undefined,
    public readonly tags: string[] | undefined,
  ) {}
}
```

---

#### `apps/api/src/module/review/commands/submit-review.handler.ts`

**Action:** CREATE  
**Purpose:** Core business logic handler. Implements the complete flow described in Section 10.3: duplicate pre-check, order eligibility check, DB transaction with rating projection, post-commit event publication, and UniqueConstraintViolation catch.

**Key imports:**
- `@Inject(DB_CONNECTION)` + `NodePgDatabase<typeof schema>` from `@/drizzle`
- `reviews` and `reviewModerationStatusEnum` from `../domain/review.schema`
- `orders` from `@/drizzle/schema` (the shared barrel — not from `@/module/ordering/...`)
- `restaurants` from `@/drizzle/schema`
- `ReviewSubmittedEvent` from `@/shared/events`
- `ReviewRepository` from `../repositories/review.repository`
- `sql`, `eq` from `drizzle-orm`

---

#### `apps/api/src/module/review/repositories/review.repository.ts`

**Action:** CREATE  
**Purpose:** Data access layer for the `reviews` table. Three methods: `findByOrderId`, `findByRestaurantId` (with pagination + `moderationStatus = 'visible'` filter), `findByOrderIdAndCustomerId`.

**Injection pattern:** `constructor(@Inject(DB_CONNECTION) private readonly db: NodePgDatabase<typeof schema>)`

---

#### `apps/api/src/module/review/controllers/review.controller.ts`

**Action:** CREATE  
**Purpose:** Three endpoints (`POST /reviews`, `GET /reviews/restaurant/:id`, `GET /reviews/my/:orderId`). Uses `ReviewService` for the submit path, `ReviewRepository` directly for read paths.

---

#### `apps/api/src/module/review/services/review.service.ts`

**Action:** CREATE  
**Purpose:** Thin orchestration service that converts the controller call into a `SubmitReviewCommand` and dispatches it via `CommandBus`. Follows the pattern of `OrderLifecycleService` (controller → service → CommandBus).

---

#### `apps/api/src/module/review/review.module.ts`

**Action:** CREATE  
**Purpose:** `@Module` decorator wiring all Review BC providers, importing `DatabaseModule` and `CqrsModule`.

---

#### `apps/api/src/shared/events/review-submitted.event.ts`

**Action:** CREATE  
**Purpose:** `ReviewSubmittedEvent` POJO (see Section 11.1). Five constructor properties: `reviewId`, `orderId`, `customerId`, `restaurantId`, `stars`.

---

#### `apps/api/src/module/notification/events/review-submitted.handler.ts`

**Action:** CREATE  
**Purpose:** `@EventsHandler(ReviewSubmittedEvent)` in Notification BC. Looks up restaurant owner via `NotificationRestaurantAclRepository`, calls `notificationService.sendFromEvent()` with the complete `SendFromEventParams` shape:

```typescript
await this.notificationService.sendFromEvent({
  type: 'new_review',
  recipientId: snapshot.ownerId,
  recipientRole: 'restaurant',
  sourceId: event.reviewId,
  templateData: {
    orderId: event.orderId,
    restaurantName: snapshot.name,
    stars: String(event.stars),   // all templateData values must be string
  },
  channels: ['in_app', 'push'],
  orderId: event.orderId,
});
```

See Section 11.2 for the complete handler class with error handling.

---

### 20.2 New Files to Create (Mobile)

---

#### `apps/mobile/src/features/review/api/review.api.ts`

**Action:** CREATE  
**Purpose:** API client using `apiFetch<T>()`. Two functions: `submitReview(dto)` → `POST /reviews`, `getMyReview(orderId)` → `GET /reviews/my/:orderId`.

---

#### `apps/mobile/src/features/review/hooks/useReview.ts`

**Action:** CREATE  
**Purpose:** TanStack Query hooks: `useSubmitReview()` (mutation with query invalidation on success), `useMyReview(orderId)` (query).

---

#### `apps/mobile/src/features/review/screen/rate-order-screen.tsx`

**Action:** CREATE  
**Purpose:** Full rating submission screen with 5-star selector, optional comment text input, optional tag chip grid, and submit button. Uses `useSubmitReview()` hook.

---

#### `apps/mobile/src/app/(customer)/orders/[id]/rate.tsx`

**Action:** CREATE  
**Purpose:** Expo Router file-based route for `/orders/[id]/rate`. Renders `RateOrderScreen`.

---

### 20.3 Files to Modify (Backend)

---

#### `apps/api/src/drizzle/schema.ts`

**Action:** MODIFY  
**Change:** Add one export line:
```typescript
export * from '../module/review/domain/review.schema';
```
This makes the `reviews` table and `reviewModerationStatusEnum` visible to Drizzle Kit for migration generation and to the `SubmitReviewHandler` import via `@/drizzle/schema`.

---

#### `apps/api/src/shared/events/index.ts`

**Action:** MODIFY  
**Change:** Add one export line:
```typescript
export * from './review-submitted.event';
```
**Location:** Append after the existing 9 export lines.

---

#### `apps/api/src/app.module.ts`

**Action:** MODIFY  
**Change:** Import `ReviewModule` and add it to the `imports` array.

```typescript
import { ReviewModule } from './module/review/review.module';

// In @Module({ imports: [...] })
// Add: ReviewModule
```

**Registration order:** `ReviewModule` should be placed after `OrderingModule` (it reads from the orders table) and before `NotificationModule` is not required, but after all its dependencies resolve. A safe position is after `PromotionModule`.

---

#### `apps/api/src/module/restaurant-catalog/restaurant/restaurant.schema.ts`

**Action:** MODIFY  
**Change:** Add `averageRating`, `ratingSum`, and `reviewCount` columns to the `restaurants` table definition:
```typescript
averageRating: real('average_rating').notNull().default(0),
ratingSum:     integer('rating_sum').notNull().default(0),
reviewCount:   integer('review_count').notNull().default(0),
```
**Location:** After the `coverImageUrl` column, before `createdAt`.

**TypeScript import addition:** `integer` and `real` are already imported in this file — no new imports required.

---

#### `apps/api/src/module/notification/domain/notification.schema.ts`

**Action:** MODIFY  
**Change:** Add `'new_review'` to the `notificationTypeEnum` values array.

```typescript
// In the notificationTypeEnum pgEnum values array, add:
'new_review',  // Restaurant owner: a customer submitted a review
```

**Location:** After `'new_order_received'` and before `'pickup_request'`.

---

#### `apps/api/src/module/notification/notification.module.ts`

**Action:** MODIFY  
**Change:** Import and register `ReviewSubmittedNotificationHandler`:

```typescript
import { ReviewSubmittedNotificationHandler } from './events/review-submitted.handler';

// In providers array: add ReviewSubmittedNotificationHandler
```

---

#### `apps/api/src/module/ordering/order-history/dto/order-history.dto.ts`

**Action:** MODIFY  
**Purpose (GAP-13):** The mobile "Rate & Review" button visibility depends on `hasReview` being returned by `GET /orders/my/:id`. Without this backend change, the mobile type field is permanently `undefined`.

**Change:** Add `hasReview` to `OrderDetailDto`:
```typescript
@ApiPropertyOptional({
  description: 'Whether the authenticated customer has already submitted a review for this order',
})
hasReview?: boolean;
```

**Location:** After the `timeline` field, before the class closing brace.

---

#### `apps/api/src/module/ordering/order-history/services/order-history.service.ts`

**Action:** MODIFY  
**Purpose (GAP-13):** Update `mapOrderToDetail()` to include `hasReview` and pass it from the service method.

**Change 1:** Update `mapOrderToDetail()` signature to accept a `hasReview` flag:
```typescript
function mapOrderToDetail(
  order: Order,
  items: OrderItem[],
  timeline: OrderStatusLog[],
  hasReview: boolean,        // ← add this parameter
): OrderDetailDto {
  return {
    // ... existing fields ...
    hasReview,               // ← add this field
  };
}
```

**Change 2:** In `getCustomerOrderDetail()` (or equivalent method), before calling `mapOrderToDetail()`, execute a lightweight cross-BC review existence check:
```typescript
// Cross-BC read: check if a review row exists for this orderId
// ReviewBC is not injected — this is a direct DB query on the reviews table
// via the shared DB connection (same pattern as Review BC reading orders table)
const reviewExists = await this.db
  .select({ id: reviews.id })
  .from(reviews)
  .where(eq(reviews.orderId, order.id))
  .limit(1);
const hasReview = reviewExists.length > 0;
```

> **Cross-BC read note:** This follows ADR-003 (same-process DB access). The `reviews` table is accessible via the shared Drizzle schema barrel `@/drizzle/schema` once `review.schema.ts` is added to the barrel (GAP-11). `OrderHistoryService` must import `reviews` from `@/drizzle/schema` — it must NOT import from `@/module/review/...` directly.

---

### 20.4 Files to Modify (Mobile)

---

#### `apps/mobile/src/app/(customer)/orders/[id].tsx` → **RENAME to `[id]/index.tsx`**

**Action:** RENAME (prerequisite — GAP-15)  
**Purpose:** Expo Router requires that a path segment be either a file (`[id].tsx`) or a directory (`[id]/`) — not both simultaneously. Converting the existing `[id].tsx` to `[id]/index.tsx` preserves the `/orders/:id` route while enabling the nested `[id]/rate.tsx` route.

**Steps:**
1. Create directory `apps/mobile/src/app/(customer)/orders/[id]/`
2. Copy all content from `[id].tsx` into `[id]/index.tsx` (file content is unchanged)
3. Delete `apps/mobile/src/app/(customer)/orders/[id].tsx`

**No code changes required** — this is a pure filesystem rename. The Expo Router route `/orders/:id` continues to function identically.

---

#### `apps/mobile/src/features/orders/types/index.ts`

**Action:** MODIFY  
**Change:** Add to `OrderDetail` (or equivalent interface):
```typescript
hasReview?: boolean;
review?: {
  stars: number;
  comment?: string;
  tags?: string[];
  createdAt: string;
};
```

---

#### `apps/mobile/src/features/orders/screen/order-detail-screen.tsx`

**Action:** MODIFY  
**Change:** Add conditional "Rate & Review" button section at the bottom of the delivered order view:
```tsx
{order.status === 'delivered' && !order.hasReview && (
  <TouchableOpacity onPress={() => router.push(`/orders/${orderId}/rate`)}>
    <Text>Rate & Review</Text>
  </TouchableOpacity>
)}
{order.status === 'delivered' && order.hasReview && (
  <Text>Review Submitted ✓</Text>
)}
```

---

### 20.5 Files to Modify (Web)

---

#### `apps/web/src/features/restaurant/api/restaurant.types.ts`

**Action:** MODIFY  
**Change:** Add optional `averageRating` and `reviewCount` fields to the `Restaurant` type to prevent type errors once the API starts returning these fields:
```typescript
averageRating?: number;
reviewCount?: number;
```

---

### 20.6 New Migration File

#### `apps/api/src/drizzle/out/XXXX_review_bc.sql` (generated)

**Action:** GENERATE (run `pnpm drizzle-kit generate` after schema changes)

The generated migration will contain:
1. `CREATE TYPE "public"."review_moderation_status" AS ENUM ('visible', 'flagged', 'hidden');`
2. `CREATE TABLE "reviews" (...)` with all columns, UNIQUE, and CHECK constraints
3. `CREATE INDEX "reviews_restaurant_id_moderation_idx" ON "reviews" (...);`
4. `CREATE INDEX "reviews_customer_id_idx" ON "reviews" (...);`
5. `ALTER TABLE "restaurants" ADD COLUMN "average_rating" real DEFAULT 0 NOT NULL;`
6. `ALTER TABLE "restaurants" ADD COLUMN "rating_sum" integer DEFAULT 0 NOT NULL;`
7. `ALTER TABLE "restaurants" ADD COLUMN "review_count" integer DEFAULT 0 NOT NULL;`

**Separate manual step (enum addition cannot be in same transaction):**

#### `apps/api/apply-migration-review.mjs`

**Action:** CREATE (manual apply script)  
**Purpose:** Apply the `notification_type` enum addition separately from the main DDL migration. **Follows the ESM pattern of `apply-migration-0013.mjs`** (not the CJS `require()` pattern of `apply-migration-0011.mjs`):

```javascript
import pg from 'pg';
const { Client } = pg;
const client = new Client({ connectionString: 'postgresql://food_order:foodordersecret@localhost:5432/food_order_db' });
async function run() {
  await client.connect();
  try {
    // ALTER TYPE ... ADD VALUE cannot run inside a transaction in PostgreSQL < 12
    // The AFTER clause positions the value immediately after new_order_received in the enum
    await client.query(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_review' AFTER 'new_order_received'`);
    console.log('Migration review: new_review enum value added to notification_type');
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}
run();
```

> **AFTER clause:** The SQL uses `AFTER 'new_order_received'` so the enum value is positioned logically with other restaurant-facing events. Without an `AFTER`/`BEFORE` clause, PostgreSQL appends to the end of the enum (which is also acceptable since enum order does not affect application logic).

---

### 20.7 Change Summary

| # | File Path | Action | Criticality |
|---|---|---|---|
| 1 | `apps/api/src/module/review/domain/review.schema.ts` | CREATE | Critical |
| 2 | `apps/api/src/module/review/dto/review.dto.ts` | CREATE | Critical |
| 3 | `apps/api/src/module/review/commands/submit-review.command.ts` | CREATE | Critical |
| 4 | `apps/api/src/module/review/commands/submit-review.handler.ts` | CREATE | Critical |
| 5 | `apps/api/src/module/review/repositories/review.repository.ts` | CREATE | Critical |
| 6 | `apps/api/src/module/review/controllers/review.controller.ts` | CREATE | Critical |
| 7 | `apps/api/src/module/review/services/review.service.ts` | CREATE | Critical |
| 8 | `apps/api/src/module/review/review.module.ts` | CREATE | Critical |
| 9 | `apps/api/src/shared/events/review-submitted.event.ts` | CREATE | High |
| 10 | `apps/api/src/module/notification/events/review-submitted.handler.ts` | CREATE | High |
| 11 | `apps/api/src/drizzle/schema.ts` | MODIFY (add 1 export line) | Critical |
| 12 | `apps/api/src/shared/events/index.ts` | MODIFY (add 1 export line) | High |
| 13 | `apps/api/src/app.module.ts` | MODIFY (add ReviewModule import) | Critical |
| 14 | `apps/api/src/module/restaurant-catalog/restaurant/restaurant.schema.ts` | MODIFY (add 3 columns: averageRating, ratingSum, reviewCount) | Critical |
| 15 | `apps/api/src/module/notification/domain/notification.schema.ts` | MODIFY (add 'new_review' enum value) | High |
| 16 | `apps/api/src/module/notification/notification.module.ts` | MODIFY (add handler to providers) | High |
| 17 | `apps/api/src/module/ordering/order-history/dto/order-history.dto.ts` | MODIFY (add hasReview to OrderDetailDto) | High |
| 18 | `apps/api/src/module/ordering/order-history/services/order-history.service.ts` | MODIFY (add hasReview cross-BC query to mapOrderToDetail) | High |
| 19 | `apps/api/src/drizzle/out/XXXX_review_bc.sql` | GENERATE (drizzle-kit) | Critical |
| 20 | `apps/api/apply-migration-review.mjs` | CREATE (ESM manual apply script) | Critical |
| 21 | `apps/api/test/review.e2e-spec.ts` | CREATE | High |
| 22 | `apps/mobile/src/app/(customer)/orders/[id].tsx` | RENAME → `[id]/index.tsx` (prerequisite for nested route) | High |
| 23 | `apps/mobile/src/features/review/api/review.api.ts` | CREATE | High |
| 24 | `apps/mobile/src/features/review/hooks/useReview.ts` | CREATE | High |
| 25 | `apps/mobile/src/features/review/screen/rate-order-screen.tsx` | CREATE | High |
| 26 | `apps/mobile/src/app/(customer)/orders/[id]/rate.tsx` | CREATE | High |
| 27 | `apps/mobile/src/features/orders/types/index.ts` | MODIFY (add hasReview, review) | Medium |
| 28 | `apps/mobile/src/features/orders/screen/order-detail-screen.tsx` | MODIFY (add Rate button) | High |
| 29 | `apps/web/src/features/restaurant/api/restaurant.types.ts` | MODIFY (add averageRating, reviewCount) | Medium |

---

## Self-Review Passes

### Pass 1 — Requirement Completeness

All 13 BRs (BR-22.1 through BR-22.13) are addressed:
- BR-22.1: `SubmitReviewDto` (Section 10.5, 20.1) — `tags` field confirmed present in SRS BR-22.1. ✓
- BR-22.2: NestJS `ValidationPipe` global (Section 12.3). ✓
- BR-22.3: `restaurantId` snapshotted from order onto review row (Section 10.3 Step 2); BR-22.3/BR-22.5 conflict resolved in favour of 404 per security note in Section 2.2. ✓
- BR-22.4: `order.customerId === cmd.customerId` assertion (Section 10.3 Step 2). ✓
- BR-22.5: 404 not 403 for non-owner (Section 10.3, Section 12.2). ✓
- BR-22.6: `order.status === 'delivered'` check (Section 10.3 Step 2). ✓
- BR-22.7: `UnprocessableEntityException` 422 (Section 10.3). ✓
- BR-22.8: `UNIQUE(order_id)` constraint (Section 8.1). ✓
- BR-22.9: App-level pre-check before insert (Section 10.3 Step 1). ✓
- BR-22.10: 409 includes existing review `createdAt` and `stars` (Section 10.3 Step 1). ✓
- BR-22.11: Review insert + rating update in same transaction; event post-commit (Section 10.3 Steps 3, 4). ✓
- BR-22.12: Running average using integer `ratingSum` formula (Section 10.3 Step 3). ✓
- BR-22.13: `moderationStatus` ENUM default `visible`; `hidden` reviews excluded from public listing (Sections 8.1, 9.1, 10.4). ✓

All message codes (MSG-RATE-01 through MSG-HIST-01) mapped. MSG-REVIEW-02 reserved per SRS BR-22.3; not raised in R2 flow (superseded by BR-22.5). ✓

### Pass 2 — Architecture Alignment

- ADR-001 (single deployable): Review BC is a NestJS module, not a service. ✓
- ADR-002 (BC separation): Review BC owns all review data; does not import from other BC modules. ✓
- ADR-003 (no shared domain models): Cross-BC references are UUIDs; `restaurantId` is snapshotted. ✓
- ADR-004 (in-process EventBus): `ReviewSubmittedEvent` uses `eventBus.publish()` post-commit. ✓
- ADD Logical View: Review BC has 4 sub-components (Eligibility, Reviews, Ratings, Aggregation) — all addressed in the handler's 4-step flow. ✓
- SAD Runtime Packet 4 (Delivery to Review): Sequence follows SD-22 step-by-step. ✓
- Event post-commit pattern: `eventBus.publish()` called OUTSIDE `db.transaction()` block. ✓
- SRS UC-22 post-condition `ratingSum` column: added to `restaurants` schema in Section 8.2. ✓

### Pass 3 — Security Completeness

- Authentication: `@Session() session: UserSession` from `@thallesp/nestjs-better-auth` — throws 401 automatically when no valid session. ✓
- Authorization: `hasRole(session.user.role, 'user')` inline check — throws 403 if wrong role. ✓
- Controller uses no `@UseGuards(AuthGuard)` or `@Roles()` — matches actual codebase pattern. ✓
- Ownership check: server-side from session, never from request body. ✓
- 404 not 403 for ownership mismatch (information leakage prevention). ✓
- Input validation: all fields validated via class-validator on `SubmitReviewDto`. ✓
- Injection resistance: parameterized Drizzle queries only. ✓
- Tag allowlist: `@IsIn(ALLOWED_REVIEW_TAGS)` prevents arbitrary values. ✓
- OWASP A01 (Broken Access Control): session-based auth + inline role check. ✓
- OWASP A03 (Injection): Drizzle ORM parameterized queries, no string interpolation. ✓
- OWASP A07 (Identification and Authentication Failures): Better Auth `@Session()` decorator. ✓

### Pass 4 — Database Design Correctness

- `UNIQUE(order_id)` on `order_id` alone — correct because one order belongs to one customer. ✓
- `stars` is `smallint` (2 bytes) — correct for a 1–5 integer. ✓
- `tags` is `text[]` — PostgreSQL native array, avoids a join table for simple tag list. ✓
- Rating projection uses integer `ratingSum` column — eliminates floating-point accumulation drift. ✓
- `ratingSum` enables moderation-safe recalculation (hide/unhide review without full re-scan). ✓
- `moderationStatus` defaults to `'visible'` at DB level. ✓
- `average_rating` defaults to `0` at DB level for restaurants with no reviews. ✓
- Migration `ALTER TYPE ... ADD VALUE` handled separately in `apply-migration-review.mjs` using ESM pattern. ✓
- Migration script uses `AFTER 'new_order_received'` for clean enum positioning. ✓

### Pass 5 — Cross-BC Boundary Integrity

- Review BC reads `orders` table via `@Inject(DB_CONNECTION)` with Drizzle query — no import from `OrderingModule`. ✓
- Review BC writes `restaurants` table inside the same DB transaction — no import from `RestaurantCatalogModule`. ✓
- Both reads use the shared schema barrel `@/drizzle/schema`, not BC-specific imports. ✓
- `OrderHistoryService` cross-BC `hasReview` read uses `@/drizzle/schema` barrel — no direct Review BC import. ✓
- `ReviewModule` does not export any providers (no other BC depends on it). ✓
- `ReviewModule` is not `@Global()` — no global side effects. ✓
- Notification BC handler imports `ReviewSubmittedEvent` from `@/shared/events` (zero-dependency POJO) — no circular dependency. ✓

### Pass 6 — Implementation Pattern Consistency

- Module structure (`module/review/domain/, commands/, repositories/, controllers/, services/`) matches Notification and Ordering BC patterns. ✓
- `@CommandHandler` pattern matches `TransitionOrderHandler`. ✓
- `@EventsHandler` with full error handling (never rethrow) matches `OrderPlacedNotificationHandler`. ✓
- `@Inject(DB_CONNECTION)` injection matches all existing repositories. ✓
- `eventBus.publish()` after `db.transaction()` matches `TransitionOrderHandler` post-commit pattern. ✓
- `notificationService.sendFromEvent()` called with complete `SendFromEventParams` including `recipientRole`, `sourceId`, `templateData` (all strings), `orderId`. ✓
- `NotificationTemplateService.TEMPLATES['new_review']` follows `(d: Record<string, string>) => NotificationTemplate` signature. ✓
- Controller uses `@Session() session: UserSession` — matches `OrderLifecycleController` and `OrderHistoryCustomerController`. ✓
- Mobile `apiFetch<T>()` usage matches `order-history.ts` pattern. ✓
- Mobile TanStack Query hooks match existing order hooks pattern. ✓

### Pass 7 — Completeness of File-by-File Change Plan

All 29 files are accounted for with CREATE / MODIFY / RENAME action, criticality, and purpose. The plan maps to:
- 8 new backend BC files (Review module)
- 1 new shared events file
- 1 new notification handler
- 1 new migration apply script (ESM)
- 1 new e2e test file
- 4 new mobile files
- 2 new backend order-history modifications (DTO + service for `hasReview`)
- 1 mobile file rename (`[id].tsx` → `[id]/index.tsx`)
- 5 other modified existing files
- 1 generated migration SQL

No orphaned files. No missing registrations. `ReviewModule` is registered in `AppModule`. `ReviewSubmittedNotificationHandler` is registered in `NotificationModule`. `review.schema.ts` is exported from the Drizzle schema barrel. `ReviewSubmittedEvent` is exported from `shared/events/index.ts`. Migration covers `reviews` table, `restaurants` additions (3 columns), and the separate `notification_type` enum extension. ✓

### Pass 8 — Post-Audit Corrections Summary

This pass documents the 8 substantive corrections applied during the Phase 3 architecture/implementation audit:

| Correction # | Area | Issue Found | Fix Applied |
|---|---|---|---|
| C-01 | Notification Handler (§11.2, §20.1) | `sendFromEvent()` called with non-existent `payload` field; missing `recipientRole`, `sourceId`, `templateData` | Rewrote handler to use correct `SendFromEventParams` interface: `{ type, recipientId, recipientRole, sourceId, templateData: Record<string,string>, channels, orderId }` |
| C-02 | Controller (§10.5, §12.1) | `@UseGuards(AuthGuard)` + `@Roles()` decorators do not exist in codebase; `SessionUser` type wrong | Changed to `@Session() session: UserSession` + inline `hasRole()` check; correct import from `@thallesp/nestjs-better-auth` |
| C-03 | Database Schema (§8.2) | `ratingCount` column misnamed vs SRS BR-22.12 (`reviewCount`); `ratingSum` column missing vs SRS UC-22 post-condition | Renamed to `reviewCount`, added `ratingSum integer`; updated rating formula to use integer arithmetic |
| C-04 | RTM (§2.2) | BR-22.3 listed HTTP 403; contradicts BR-22.5 (which mandates 404) | Updated to 404 + MSG-HIST-01; added conflict resolution note |
| C-05 | MSG Codes (§2.3) | MSG-REVIEW-02 described as "Auth failure" — incorrect per SRS BR-22.3 | Updated: reserved for ownership failure per BR-22.3; not raised in R2 (superseded by BR-22.5) |
| C-06 | Gap Analysis (§4) | GAP-13 was mobile-only; backend order-history service also needs updating. GAP-15 (route rename) and GAP-16 (ratingSum) missing entirely | Expanded GAP-13; added GAP-15 (Expo Router rename), GAP-16 (ratingSum) |
| C-07 | Mobile Routing (§13.3, §20.4) | `[id].tsx` file/directory conflict with `[id]/rate.tsx` not addressed | Added explicit RENAME step: `[id].tsx` → `[id]/index.tsx` as prerequisite |
| C-08 | Backend `hasReview` (§20.3) | `GET /orders/my/:id` backend not updated to return `hasReview`; mobile type would always be undefined | Added modifications to `order-history.dto.ts` and `order-history.service.ts` |

---

*End of Proposal — UC-22 Submit Rating & Review (v2.0 — Post-Audit)*  
*Source authority: SRS_FoodDelivery.md, ADD_FoodDelivery.md, ADR_FoodDelivery.md, SAD_FoodDelivery.md, ASR_FoodDelivery.md, USE_CASE_SPECIFICATION.md, and direct codebase analysis of 20+ source files.*
