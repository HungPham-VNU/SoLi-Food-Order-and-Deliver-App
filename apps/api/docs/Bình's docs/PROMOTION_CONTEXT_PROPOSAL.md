# Promotion Context — Architectural Proposal

> **Document Type:** Living Design Document (Pre-Implementation)
> **Author Role:** Senior Software Architect
> **Status:** PR-1 ✅ Implemented | PR-2 ✅ Implemented | PR-3–PR-6 ⏳ Planned
> **Target Project:** `SoLi-Food-Order-and-Deliver-App` / `apps/api`
> **Depends On:** Ordering BC (Phases 0–7), Payment BC (Phase 8), Notification BC (Phase N)
> **Verified Against:** Full codebase audit of all 7 BCs — `order.schema.ts`, `cart.service.ts`, `place-order.handler.ts`, `payment.service.ts`, `notification.service.ts`, `order-placed.handler.ts`, `menu.schema.ts`, `restaurant.schema.ts`

---

## Table of Contents

1. [Domain Analysis](#1-domain-analysis)
2. [Strategic DDD Placement Decision](#2-strategic-ddd-placement-decision)
3. [Promotion Capabilities](#3-promotion-capabilities)
4. [Domain Model](#4-domain-model)
5. [Pricing Engine Design](#5-pricing-engine-design)
6. [Database Design](#6-database-design)
7. [REST API Design](#7-rest-api-design)
8. [Ordering BC Integration](#8-ordering-bc-integration)
9. [Payment BC Integration](#9-payment-bc-integration)
10. [Notification BC Integration](#10-notification-bc-integration)
11. [Event-Driven Architecture](#11-event-driven-architecture)
12. [Admin Capabilities](#12-admin-capabilities)
13. [Fraud & Abuse Prevention](#13-fraud--abuse-prevention)
14. [Scalability & Caching Strategy](#14-scalability--caching-strategy)
15. [Observability & Monitoring](#15-observability--monitoring)
16. [Testing Strategy](#16-testing-strategy)
17. [Phase-by-Phase Roadmap](#17-phase-by-phase-roadmap)
18. [Tradeoff Analysis](#18-tradeoff-analysis)
19. [Final Recommendation](#19-final-recommendation)

---

## 1. Domain Analysis

### 1.1 Problem Statement

The SoLi platform currently has no promotional pricing mechanism. Every order is priced at the raw sum of `(unitPrice + modifiersPrice) × quantity + shippingFee`. To compete in the Vietnamese food delivery market—where Grab Food, Baemin, and ShopeeFood run aggressive promotional campaigns—SoLi must support a flexible, fraud-resistant promotion engine.

### 1.2 Core Promotion Questions

| Question | Answer |
|---|---|
| Who creates promotions? | Platform admins (platform-wide) and restaurant owners (restaurant-scoped) |
| When are they applied? | At cart validation time (preview) and finalized at checkout |
| How is a discount reflected in an order? | Deducted from `totalAmount`; full breakdown stored as JSONB snapshot |
| What happens when payment fails? | Redemption is rolled back; usage counters decremented |
| How are promotions discovered? | Auto-applied (system evaluates eligible promos), or customer-entered coupon code |
| How do we prevent abuse? | Per-customer usage limits, optimistic locking on budgets, fingerprint deduplication |

### 1.3 Current State of Ordering Pricing

The `PlaceOrderHandler.executeWithLock()` flow currently computes:

```
itemsTotal  = Σ (unitPrice + modifiersPrice) × quantity   [from ACL snapshots]
shippingFee = baseFee + round(distanceKm × perKmRate)     [from delivery zone snapshot]
totalAmount = itemsTotal + shippingFee
```

The `orders` table stores `total_amount` and `shipping_fee` as integer VND. There is no `discount_amount` column, no `promotion_breakdown` column, and no promotion concept in any existing schema. This proposal specifies exactly where and how to integrate discounts without breaking existing E2E test coverage (730/730 passing).

### 1.4 Business Drivers

1. **Customer acquisition** — first-order discounts, referral bonuses
2. **Restaurant partnership** — restaurants fund their own promos, increasing order frequency
3. **Revenue management** — flash sales, time-boxed offers to fill off-peak hours
4. **Delivery incentivization** — free delivery above a basket threshold
5. **Loyalty** — repeat customer discounts tied to order history
6. **Geo-targeting** — promos scoped to specific districts or cities

---

## 2. Strategic DDD Placement Decision

### 2.1 Options Considered

#### Option A — Promotion as a Separate Bounded Context (Peer to Ordering)

Promotion lives entirely outside Ordering. Ordering calls it via an event or port.

**Pros:** Maximum isolation, independent deployability  
**Cons:** Promotions must be pre-applied before `totalAmount` is computed — a synchronous call is unavoidable at checkout. If Promotion is a true separate BC, a blocking call from the Core Domain to a Supporting Subdomain is technically correct but architecturally equivalent to Option C. The BC boundary buys nothing in a monolith.

#### Option B — Promotion Module Inside Ordering BC

Promotion logic lives in `src/module/ordering/promotion/` as a sub-module of Ordering.

**Pros:** Tight coupling is explicit, no ports needed  
**Cons:** Ordering BC becomes a "god module" owning pricing rules, coupon CRUD, admin panels, budget tracking, and referral logic. Promotion has its own complex lifecycle, its own admin operations, and its own event publications — it is not a simple sub-service of Ordering.

#### Option C — Promotion as a Supporting Subdomain (Top-Level Module) ✅ SELECTED

Promotion is implemented as `src/module/promotion/` — a top-level NestJS module at the same level as Ordering, Payment, and Notification. Ordering BC accesses it via `IPromotionApplicationPort` (Dependency Inversion Principle), exactly mirroring the `IPaymentInitiationPort` pattern already established.

**Pros:**
- Follows the established DIP port pattern from Payment BC integration
- Promotion owns its own DB tables, services, event publications, and admin endpoints
- Clean extraction boundary for future microservice extraction
- Ordering BC has zero import dependency on `PromotionModule`
- Promotion BC depends on `OrderPlacedEvent`, `OrderCancelledAfterPaymentEvent` for rollback — exactly like Notification BC
- Admin CRUD for promotions lives in `PromotionModule`, not polluting OrderingModule

**Cons:**
- Requires a synchronous DIP call from Ordering at checkout (same tradeoff as Payment — acceptable)
- `orders` table needs new columns for discount data (controlled schema migration)

### 2.2 Confirmed Placement

```
src/module/promotion/
```

Role in the domain map: **Supporting Subdomain** — enriches and supports the Core Domain (Ordering) without owning order state. Promotion never calls Ordering services; results flow back to Ordering via a synchronous port response and, for post-order events, via CQRS EventBus events.

### 2.3 Updated Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         SoLi Platform (Modular Monolith)                       │
│                                                                                │
│   ┌─────────────────────────────────────────────────────────────────────────┐  │
│   │                        ORDERING (Core Domain)                           │  │
│   │                                                                         │  │
│   │  CartModule  ──[IPromotionApplicationPort]──► ┌──────────────────────┐ │  │
│   │  OrderModule ──[IPromotionApplicationPort]──► │   PROMOTION MODULE   │ │  │
│   │                                               │  (Supporting Sub-    │ │  │
│   │  PlaceOrderHandler receives:                  │   domain)            │ │  │
│   │    { discountAmount, breakdown }              │                      │ │  │
│   │    from IPromotionApplicationPort             │  src/module/         │ │  │
│   │                                               │    promotion/        │ │  │
│   └─────────────────────────────────────────────── ──────────┬───────── ┘ │  │
│              │ OrderPlacedEvent                               │             │  │
│              │ OrderCancelledAfterPaymentEvent (rollback)     │ events      │  │
│              ▼                                                ▼             │  │
│   ┌──────────────────────────────────────────────────────────────────────┐  │  │
│   │           Downstream BCs (Payment, Notification, Delivery)           │  │  │
│   │   - Payment BC: receives OrderPlacedEvent, acts on paidAmount        │  │  │
│   │   - Notification BC: receives PromotionAppliedEvent for push         │  │  │
│   └──────────────────────────────────────────────────────────────────────┘  │  │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Dependency Direction Rules

| Rule | Description |
|---|---|
| D-PR1 | `OrderingModule` imports `IPromotionApplicationPort` token only — never `PromotionModule` itself |
| D-PR2 | `PromotionModule` is `@Global()` and registers `PROMOTION_APPLICATION_PORT → PromotionApplicationService` |
| D-PR3 | `PromotionModule` never calls any Ordering service or repository |
| D-PR4 | `PromotionModule` consumes `OrderPlacedEvent` and `OrderCancelledAfterPaymentEvent` from the CQRS EventBus to finalize/rollback redemptions |
| D-PR5 | `PromotionModule` publishes its own events: `PromotionAppliedEvent`, `CouponRedeemedEvent`, `PromotionBudgetExhaustedEvent` |
| D-PR6 | Notification BC consumes `PromotionAppliedEvent` for campaign push notifications |

---

## 3. Promotion Capabilities

### 3.1 Promotion Scope Matrix

| Scope | Funder | Applies To | Examples |
|---|---|---|---|
| `platform` | SoLi admin | All restaurants | New user 20% off, App anniversary flash sale |
| `restaurant` | Restaurant owner | One specific restaurant | "Summer Sale at SoLi Grill", new branch opening |
| `item` | Restaurant owner | Specific menu item IDs | "Buy 2 Combo A get 1 free", item discount |
| `category` | Restaurant owner | Menu category IDs | All drinks 15% off |

### 3.2 Discount Type Matrix

| Type | Code | Description | Example |
|---|---|---|---|
| Percentage | `percentage` | Discount = itemsTotal × (value / 100), capped by `maxDiscountAmount` | 20% off, max 50,000 VND |
| Fixed amount | `fixed_amount` | Discount = fixed value VND from order total | 30,000 VND off |
| Free delivery | `free_delivery` | shippingFee discount = full shippingFee | Free delivery on orders ≥ 100,000 VND |
| Reduced delivery | `reduced_delivery` | shippingFee discount = value VND | 10,000 VND off delivery |
| BOGO | `buy_x_get_y` | Buy X of item A, get Y of item B free (cheapest item) | Buy 2 burgers, get 1 free |
| Item free | `free_item` | Specific item added free above min order | Free drink above 150,000 VND |

> **VND Constraint:** All discount amounts must be integer VND, multiples of 1,000. `@IsVNDAmount()` validator applies to all monetary fields. The pricing engine rounds all computed discounts down to the nearest 1,000 VND before applying.

### 3.3 Condition Types

| Condition | Field | Description |
|---|---|---|
| Minimum basket | `minOrderAmount` | `itemsTotal >= minOrderAmount` |
| Minimum quantity | `minItemQuantity` | At least N items in cart |
| First order | `isFirstOrderOnly` | `ORDER COUNT WHERE customerId = X == 0` |
| New user | `isNewUserOnly` | Account created within `newUserGracePeriodDays` |
| Eligible restaurant | `eligibleRestaurantIds[]` | For platform promos scoped to specific restaurants |
| Eligible item | `eligibleItemIds[]` | Item discount promos |
| Eligible category | `eligibleCategoryIds[]` | Category discount promos |
| Min items from category | `minItemsFromCategory` | At least N items from target category |
| Geo restriction | `eligibleDistricts[]`, `eligibleCities[]` | Applies only in certain delivery zones |
| Day of week | `activeDaysOfWeek[]` | Mon–Sun bitmask |
| Time window | `activeStartHour`, `activeEndHour` | Lunch deal 11:00–14:00 |
| Payment method | `eligiblePaymentMethods[]` | VNPay-exclusive promos |

### 3.4 Trigger Mechanism

| Trigger | Description |
|---|---|
| `auto_apply` | System evaluates all eligible auto-apply promos at cart query and checkout; applies the best one (or all stackable ones) |
| `coupon_code` | Customer enters a code; system validates and applies the linked promotion |

### 3.5 Stacking Rules

| Stacking Mode | Behavior |
|---|---|
| Non-stackable (default) | At most one promotion per order. If multiple are eligible, the system picks the best discount for the customer. |
| Stackable | A promotion marked `isStackable=true` can combine with one other stackable promotion (e.g., item discount + free delivery). Cap: 2 stackable promos max per order. |
| Exclusive | A promotion marked `isExclusive=true` overrides all others when applied (e.g., first-order 50% off). |

---

## 4. Domain Model

### 4.1 Entity Relationship Overview

```
┌────────────────────────┐    1       N    ┌─────────────────────────┐
│       Promotion        │◄────────────────│       CouponCode        │
│                        │                 │  (optional; 1 per promo │
│  id, type, scope       │                 │   or many codes)        │
│  discountType          │                 │  code (UNIQUE)          │
│  discountValue         │                 │  maxUses, usesCount     │
│  maxDiscountAmount     │                 │  expiresAt              │
│  conditions (JSONB)    │                 └─────────────────────────┘
│  schedule (JSONB)      │
│  usageLimits (JSONB)   │    1       N    ┌─────────────────────────┐
│  isAutoApply           │◄────────────────│   PromotionUsage        │
│  isStackable           │                 │                         │
│  isExclusive           │                 │  orderId (cross-BC ref) │
│  status                │                 │  customerId             │
│  restaurantId (null    │                 │  couponCodeId?          │
│    = platform-wide)    │                 │  discountAmount         │
│  createdByRole         │                 │  status (reserved/      │
│  version               │                 │    confirmed/           │
└────────────────────────┘                 │    rolled_back)         │
                                           │  reservedAt             │
                                           │  confirmedAt            │
                                           └─────────────────────────┘
```

### 4.2 `Promotion` Aggregate

```typescript
// Domain aggregate — maps to promotions DB table
interface Promotion {
  id: string;                         // UUID PK
  name: string;                       // display name
  description: string;                // marketing copy
  type: PromotionType;                // 'percentage' | 'fixed_amount' | 'free_delivery' | 'reduced_delivery' | 'buy_x_get_y' | 'free_item'
  scope: PromotionScope;              // 'platform' | 'restaurant' | 'item' | 'category'
  
  // Discount configuration
  discountValue: number;              // integer VND (fixed/reduced_delivery) OR basis points × 100 (percentage, e.g. 2000 = 20%)
  maxDiscountAmount: number | null;   // cap for percentage type; null = uncapped
  
  // Scope targeting
  restaurantId: string | null;        // null = platform-wide
  eligibleItemIds: string[];          // for 'item' scope
  eligibleCategoryIds: string[];      // for 'category' scope
  
  // Conditions (evaluated at application time)
  conditions: PromotionConditions;    // JSONB — see §4.3
  
  // Scheduling
  schedule: PromotionSchedule;        // JSONB — see §4.4
  
  // Usage limits
  maxTotalUses: number | null;        // null = unlimited
  maxPerCustomer: number | null;      // null = unlimited; enforced per customerId
  currentTotalUses: number;           // incremented atomically with optimistic locking
  
  // Stacking behaviour
  isAutoApply: boolean;
  isStackable: boolean;
  isExclusive: boolean;
  
  // Status
  status: 'draft' | 'active' | 'paused' | 'expired' | 'exhausted';
  
  // Audit
  createdByRole: 'admin' | 'restaurant';
  createdByUserId: string;
  version: number;                    // optimistic locking
  createdAt: Date;
  updatedAt: Date;
}
```

### 4.3 `PromotionConditions` (JSONB)

```typescript
interface PromotionConditions {
  minOrderAmount?: number;            // integer VND
  minItemQuantity?: number;
  isFirstOrderOnly?: boolean;
  isNewUserOnly?: boolean;
  newUserGracePeriodDays?: number;    // default 30
  eligibleRestaurantIds?: string[];   // for platform promos limited to specific restaurants
  eligibleDistricts?: string[];
  eligibleCities?: string[];
  activeDaysOfWeek?: number[];        // 0=Sunday, 1=Monday ... 6=Saturday
  activeStartHour?: number;           // 0–23
  activeEndHour?: number;             // 0–23
  eligiblePaymentMethods?: ('cod' | 'vnpay')[];
  // BOGO / buy_x_get_y specific
  buyItemId?: string;
  buyQuantity?: number;
  getItemId?: string;
  getQuantity?: number;
  // free_item specific
  freeItemId?: string;
  freeItemQuantity?: number;
}
```

### 4.4 `PromotionSchedule` (JSONB)

```typescript
interface PromotionSchedule {
  startAt: string;   // ISO8601 UTC
  endAt: string;     // ISO8601 UTC
}
```

### 4.5 `CouponCode` Entity

```typescript
interface CouponCode {
  id: string;
  promotionId: string;     // FK to promotions
  code: string;            // UNIQUE, case-insensitive normalized to UPPERCASE
  maxUses: number | null;  // null = unlimited (per this code)
  currentUses: number;     // optimistic lock target
  maxUsesPerCustomer: number | null;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}
```

### 4.6 `PromotionUsage` Entity

```typescript
interface PromotionUsage {
  id: string;
  promotionId: string;
  couponCodeId: string | null;    // set when a coupon code triggered the promotion
  orderId: string;                // cross-context ref — no FK (D-PR3)
  customerId: string;             // cross-context ref — no FK
  restaurantId: string;
  discountAmount: number;         // integer VND — the actual discount applied
  status: 'reserved' | 'confirmed' | 'rolled_back';
  reservedAt: Date;
  confirmedAt: Date | null;
  rolledBackAt: Date | null;
  rolledBackReason: string | null;
}
```

### 4.7 `PricingBreakdown` Value Object (JSONB in `orders`)

This value object is stored in a new `promotion_breakdown` JSONB column in the `orders` table. It is an **immutable snapshot** of the promotion calculation at checkout time.

```typescript
interface PricingBreakdown {
  // Raw inputs
  itemsSubtotal: number;           // integer VND: Σ (unitPrice + modifiersPrice) × qty
  shippingFee: number;             // integer VND: delivery zone fee
  
  // Applied promotions
  appliedPromotions: AppliedPromotionSnapshot[];
  
  // Totals
  itemsDiscount: number;           // integer VND: total discount on items
  deliveryDiscount: number;        // integer VND: discount on shipping fee
  totalDiscount: number;           // integer VND: itemsDiscount + deliveryDiscount
  finalAmount: number;             // integer VND: itemsSubtotal + shippingFee - totalDiscount
}

interface AppliedPromotionSnapshot {
  promotionId: string;
  promotionName: string;
  couponCode: string | null;
  discountType: PromotionType;
  computedDiscount: number;        // integer VND — the portion of discount this promo contributed
  appliesTo: 'items' | 'delivery';
}
```

---

## 5. Pricing Engine Design

### 5.1 Pricing Engine Responsibilities

The `PromotionPricingEngine` is a **pure, stateless service** within `PromotionModule`. It takes a `PricingContext` and returns a `PricingResult`. It never reads the database — all data is passed in. This makes it fully unit-testable.

```typescript
// Defined in src/module/promotion/engine/promotion-pricing.engine.ts
@Injectable()
export class PromotionPricingEngine {
  compute(ctx: PricingContext, promotions: Promotion[]): PricingResult { ... }
}

interface PricingContext {
  customerId: string;
  restaurantId: string;
  items: Array<{
    menuItemId: string;
    categoryId: string | null;
    unitPrice: number;
    quantity: number;
    modifiersPrice: number;
  }>;
  shippingFee: number;
  orderCount: number;              // for first-order check — queried before engine call
  accountCreatedAt: Date;          // for new-user check
  paymentMethod: 'cod' | 'vnpay';
  deliveryDistrict: string;
  deliveryCity: string;
  appliedCouponCode: string | null;
  now: Date;                       // injected for time-window checks (testable)
}

interface PricingResult {
  itemsSubtotal: number;
  shippingFee: number;
  itemsDiscount: number;
  deliveryDiscount: number;
  totalDiscount: number;
  finalAmount: number;
  appliedPromotions: AppliedPromotionSnapshot[];
  eligiblePromotionIds: string[];  // IDs of promos that matched (for reservation)
}
```

### 5.2 Pricing Pipeline (Step-by-Step)

```
Step 1: Collect active promotions
  PromotionApplicationService fetches eligible promotions from DB:
    - status = 'active'
    - schedule.startAt <= now <= schedule.endAt
    - (restaurantId = ctx.restaurantId OR scope = 'platform')
    - If ctx.appliedCouponCode present: also fetch the promo linked to that code

Step 2: Filter by conditions
  For each promotion P:
    conditionCheck(P.conditions, ctx) → boolean
    Conditions evaluated:
      minOrderAmount     → ctx.itemsSubtotal >= P.conditions.minOrderAmount
      isFirstOrderOnly   → ctx.customerOrderCount == 0
      isNewUserOnly      → daysDiff(ctx.now, ctx.customerAccountCreatedAt) <= gracePeriodDays
      activeDaysOfWeek   → dayOfWeek(ctx.now) in P.conditions.activeDaysOfWeek
      activeStartHour    → hour(ctx.now) in [activeStartHour, activeEndHour)
      eligiblePaymentMethods → ctx.paymentMethod in P.conditions.eligiblePaymentMethods
      eligibleDistricts  → ctx.deliveryDistrict in P.conditions.eligibleDistricts
      eligibleCities     → ctx.deliveryCity in P.conditions.eligibleCities
      eligibleItemIds    → any cart item in P.eligibleItemIds
      eligibleCategoryIds → any cart item.categoryId in P.eligibleCategoryIds
  
  → eligible promotions list

Step 3: Resolve coupon promotion
  If ctx.appliedCouponCode is set:
    Validate coupon code exists, is active, not expired, maxUses not reached
    Promotion linked to coupon must pass condition check
    If invalid → throw BadRequestException (surfaced to client)
    If valid → add to eligible list (or confirm it's already there)

Step 4: Apply stacking rules
  Sort eligible promotions by discount value DESC
  - If any isExclusive=true promo matches → use only that promo
  - Otherwise:
    - Take non-stackable promos: pick the BEST single promo (highest computed discount)
    - Take stackable promos: combine up to 2 (e.g., item discount + free delivery)
    - Never combine non-stackable + stackable
    - The coupon-code promo takes priority within its tier

Step 5: Compute discount amounts
  For each selected promo P:
    switch(P.type):
      'percentage':
        // discountValue stores plain integer percent: e.g. 20 = 20%, 15 = 15%
        raw = floor(ctx.itemsSubtotal × P.discountValue / 100)
        capped = P.maxDiscountAmount ? min(raw, P.maxDiscountAmount) : raw
        discount = roundDownTo1000(capped)
        appliesTo = 'items'
      
      'fixed_amount':
        discount = min(P.discountValue, ctx.itemsSubtotal)
        discount = roundDownTo1000(discount)
        appliesTo = 'items'
      
      'free_delivery':
        discount = ctx.shippingFee
        appliesTo = 'delivery'
      
      'reduced_delivery':
        discount = min(P.discountValue, ctx.shippingFee)
        appliesTo = 'delivery'
      
      'buy_x_get_y':
        qualifying = countQualifyingItems(ctx.items, P.conditions.buyItemId, P.conditions.buyQuantity)
        freeUnits  = floor(qualifying / P.conditions.buyQuantity) × P.conditions.getQuantity
        freeItemPrice = ctx.items.find(i => i.menuItemId == P.conditions.getItemId)?.unitPrice ?? 0
        discount = freeUnits × freeItemPrice
        discount = roundDownTo1000(discount)
        appliesTo = 'items'
      
      'free_item':
        if ctx.itemsSubtotal >= P.conditions.minOrderAmount:
          freeItemPrice = ctx.items.find(i => i.menuItemId == P.conditions.freeItemId)?.unitPrice ?? 0
          discount = freeItemPrice × P.conditions.freeItemQuantity
        appliesTo = 'items'

Step 6: Sum and cap
  itemsDiscount   = Σ discount for appliesTo='items'
  deliveryDiscount = Σ discount for appliesTo='delivery'
  
  // Safety cap: itemsDiscount never exceeds itemsSubtotal
  itemsDiscount    = min(itemsDiscount, ctx.itemsSubtotal)
  // Safety cap: deliveryDiscount never exceeds shippingFee
  deliveryDiscount = min(deliveryDiscount, ctx.shippingFee)
  
  totalDiscount   = itemsDiscount + deliveryDiscount
  finalAmount     = ctx.itemsSubtotal + ctx.shippingFee - totalDiscount

Step 7: Return PricingResult
```

### 5.3 VND Rounding Rule

All computed discounts are rounded DOWN to the nearest 1,000 VND before storage:

```typescript
function roundDownTo1000(amount: number): number {
  return Math.floor(amount / 1000) * 1000;
}
```

This ensures `finalAmount` is always a multiple of 1,000 VND, consistent with the platform's monetary invariant (`@IsVNDAmount()`).

### 5.4 Determinism Guarantee

The pricing engine is deterministic for the same inputs. No randomness, no external calls. The `now: Date` parameter is passed in (not `new Date()` inside the engine), enabling full determinism in tests.

### 5.5 Immutable Checkout Snapshot

**Critical:** The `PricingBreakdown` JSONB written to `orders.promotion_breakdown` is the **authoritative record** of what discount the customer received. Promotion rules, coupon codes, or budget limits may change after order creation — the snapshot is never recalculated. This mirrors the `order_items.modifiers` pattern for modifier snapshots.

---

## 6. Database Design

### 6.1 New Tables

#### `promotions`

```sql
CREATE TYPE promotion_type AS ENUM (
  'percentage', 'fixed_amount', 'free_delivery',
  'reduced_delivery', 'buy_x_get_y', 'free_item'
);

CREATE TYPE promotion_scope AS ENUM ('platform', 'restaurant', 'item', 'category');

CREATE TYPE promotion_status AS ENUM (
  'draft', 'active', 'paused', 'expired', 'exhausted'
);

CREATE TYPE promotion_creator_role AS ENUM ('admin', 'restaurant');

CREATE TABLE promotions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  type                promotion_type NOT NULL,
  scope               promotion_scope NOT NULL,
  
  -- Discount configuration
  -- For 'percentage': plain integer percent 1-100 (e.g. 20 = 20%)
  -- For all other types: integer VND (e.g. 30000 = 30,000 VND)
  discount_value      INTEGER NOT NULL,
  max_discount_amount INTEGER,                           -- NULL = uncapped
  
  -- Scope targeting (cross-context refs — no FK constraints; D-PR3)
  restaurant_id       UUID,                              -- NULL = platform-wide
  eligible_item_ids   UUID[] NOT NULL DEFAULT '{}',
  eligible_category_ids UUID[] NOT NULL DEFAULT '{}',
  eligible_restaurant_ids UUID[] NOT NULL DEFAULT '{}',  -- for platform promos limited to restaurants
  
  -- Conditions (JSONB — see §4.3)
  conditions          JSONB NOT NULL DEFAULT '{}',
  
  -- Schedule (JSONB — start_at, end_at as ISO strings)
  schedule            JSONB NOT NULL,
  
  -- Usage limits
  max_total_uses      INTEGER,                           -- NULL = unlimited
  max_per_customer    INTEGER,                           -- NULL = unlimited
  current_total_uses  INTEGER NOT NULL DEFAULT 0,
  
  -- Stacking
  is_auto_apply       BOOLEAN NOT NULL DEFAULT false,
  is_stackable        BOOLEAN NOT NULL DEFAULT false,
  is_exclusive        BOOLEAN NOT NULL DEFAULT false,
  
  -- Status
  status              promotion_status NOT NULL DEFAULT 'draft',
  
  -- Audit
  created_by_role     promotion_creator_role NOT NULL,
  created_by_user_id  UUID NOT NULL,
  version             INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial index: only query active, non-expired promotions
CREATE INDEX idx_promotions_active_restaurant
  ON promotions (restaurant_id, status)
  WHERE status = 'active';

-- GIN index for array-contains queries (eligible_item_ids, eligible_category_ids)
CREATE INDEX idx_promotions_eligible_items     ON promotions USING GIN (eligible_item_ids);
CREATE INDEX idx_promotions_eligible_categories ON promotions USING GIN (eligible_category_ids);
```

#### `coupon_codes`

```sql
CREATE TABLE coupon_codes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id          UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  code                  TEXT NOT NULL,         -- normalized UPPERCASE in application layer
  max_uses              INTEGER,               -- NULL = unlimited
  current_uses          INTEGER NOT NULL DEFAULT 0,
  max_uses_per_customer INTEGER,               -- NULL = unlimited
  expires_at            TIMESTAMPTZ,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique on normalized code (enforced by app layer to normalize to UPPERCASE)
CREATE UNIQUE INDEX coupon_codes_code_uidx ON coupon_codes (UPPER(code));
CREATE INDEX idx_coupon_codes_promotion ON coupon_codes (promotion_id);
```

#### `promotion_usages`

```sql
CREATE TYPE promotion_usage_status AS ENUM ('reserved', 'confirmed', 'rolled_back');

CREATE TABLE promotion_usages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id        UUID NOT NULL REFERENCES promotions(id),
  coupon_code_id      UUID REFERENCES coupon_codes(id),
  order_id            UUID NOT NULL,           -- cross-context ref, no FK (D-PR3)
  customer_id         UUID NOT NULL,           -- cross-context ref, no FK
  restaurant_id       UUID NOT NULL,           -- cross-context ref, no FK
  discount_amount     INTEGER NOT NULL,        -- integer VND
  status              promotion_usage_status NOT NULL DEFAULT 'reserved',
  reserved_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at        TIMESTAMPTZ,
  rolled_back_at      TIMESTAMPTZ,
  rolled_back_reason  TEXT
);

-- Prevent the same order having two usages for the same promotion
CREATE UNIQUE INDEX promotion_usages_order_promo_uidx
  ON promotion_usages (order_id, promotion_id);

-- For per-customer max enforcement
CREATE INDEX idx_promo_usage_customer ON promotion_usages (promotion_id, customer_id)
  WHERE status != 'rolled_back';

CREATE INDEX idx_promo_usage_order ON promotion_usages (order_id);
```

### 6.2 Modified Tables

#### `orders` — New Columns

```sql
ALTER TABLE orders
  ADD COLUMN discount_amount       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN promotion_breakdown   JSONB;   -- PricingBreakdown JSONB (nullable; null = no promotion applied)
```

`orders.total_amount` is **unchanged** and continues to represent the final payable amount after discounts:

```
total_amount = items_subtotal + shipping_fee - discount_amount
```

`payment_transactions.amount` must equal `orders.total_amount` (already enforced by IPN validation logic).

### 6.3 Cart Redis Type Extension

The `Cart` type in `src/module/ordering/cart/cart.types.ts` gets two optional fields:

```typescript
// In cart.types.ts
export interface Cart {
  cartId: string;
  customerId: string;
  restaurantId: string;
  restaurantName: string;
  items: CartItem[];
  createdAt: number;
  updatedAt: number;
  // NEW: promotion preview fields (optional)
  appliedCouponCode?: string;       // coupon code entered by customer
  pendingDiscountAmount?: number;   // last computed discount (integer VND) — preview only, not authoritative
  appliedPromotionIds?: string[];   // IDs of auto-applied or coupon-linked promotions in preview
}
```

> **Invariant:** `pendingDiscountAmount` in the cart is a **preview only**. The authoritative discount is computed fresh at checkout by `PromotionApplicationService`. This prevents stale cart discounts from inflating/deflating the actual order total.

---

## 7. REST API Design

### 7.1 Customer-Facing Endpoints

#### Apply Coupon to Cart

```
POST /carts/my/coupon
Authorization: Bearer <customer-token>

Body: { "couponCode": "SUMMER20" }

Response 200:
{
  "appliedCouponCode": "SUMMER20",
  "pendingDiscountAmount": 25000,
  "promotionName": "Summer Sale 20% Off",
  "cartTotal": {
    "itemsSubtotal": 125000,
    "shippingFee": 20000,
    "discount": 25000,
    "estimatedTotal": 120000
  }
}

Errors:
  400 Bad Request  — invalid/expired/inactive coupon code
  400 Bad Request  — coupon already used by this customer (max_per_customer reached)
  409 Conflict     — coupon valid but cart conditions not met (min order amount, etc.)
```

#### Remove Coupon from Cart

```
DELETE /carts/my/coupon
Authorization: Bearer <customer-token>

Response 200: { "message": "Coupon removed" }
```

#### Get Applicable Promotions (Cart Preview)

```
GET /carts/my/promotions
Authorization: Bearer <customer-token>

Response 200:
{
  "autoApplied": [
    {
      "promotionId": "...",
      "name": "Free Delivery on orders ≥ 100,000 VND",
      "discountType": "free_delivery",
      "estimatedDiscount": 20000
    }
  ],
  "couponRequired": [],
  "totalEstimatedDiscount": 20000
}
```

#### Browse Active Public Promotions (for promotion banner in app)

```
GET /promotions/active?restaurantId=<uuid>
Authorization: Bearer <any-role>

Response 200: { "promotions": PromotionPublicDto[] }
```

### 7.2 Checkout Integration

`POST /carts/my/checkout` (no change to request body)

The `CheckoutDto` does **not** add a `couponCode` field. The coupon code is already stored in the cart Redis object via `POST /carts/my/coupon`. This avoids coupling the checkout DTO to promotion state and keeps checkout idempotent with respect to the X-Idempotency-Key header.

`CheckoutResponseDto` gains new fields:

```typescript
export class CheckoutResponseDto {
  orderId!: string;
  status!: string;
  totalAmount!: number;           // FINAL amount after discount
  discountAmount!: number;        // NEW: 0 if no promo applied
  promotionBreakdown?: {          // NEW: present when discount > 0
    itemsSubtotal: number;
    shippingFee: number;
    totalDiscount: number;
    appliedPromotions: Array<{
      promotionId: string;
      promotionName: string;
      couponCode: string | null;
      computedDiscount: number;
    }>;
  };
  paymentUrl?: string;
  estimatedDeliveryMinutes?: number;
}
```

### 7.3 Admin Endpoints

```
POST   /admin/promotions             — Create promotion
GET    /admin/promotions             — List all (paginated, filterable)
GET    /admin/promotions/:id         — Get by ID
PATCH  /admin/promotions/:id         — Update (only draft/paused promotions)
DELETE /admin/promotions/:id         — Soft-delete (status → 'paused')
POST   /admin/promotions/:id/activate  — draft → active
POST   /admin/promotions/:id/pause     — active → paused
POST   /admin/promotions/:id/coupon-codes  — Bulk-generate coupon codes
GET    /admin/promotions/:id/usages    — Usage analytics
```

### 7.4 Restaurant Owner Endpoints

```
POST   /restaurant/promotions           — Create restaurant-scoped promotion
GET    /restaurant/promotions           — My promotions (paginated)
GET    /restaurant/promotions/:id       — Get by ID (own restaurant only)
PATCH  /restaurant/promotions/:id       — Update draft/paused promotions
POST   /restaurant/promotions/:id/activate
POST   /restaurant/promotions/:id/pause
GET    /restaurant/promotions/:id/usages — Usage stats for this promotion
```

---

## 8. Ordering BC Integration

### 8.1 IPromotionApplicationPort Interface

Defined in `src/shared/ports/promotion-application.port.ts`:

```typescript
export const PROMOTION_APPLICATION_PORT = Symbol('PROMOTION_APPLICATION_PORT');

export interface IPromotionApplicationPort {
  /**
   * Validates eligible promotions, computes a price breakdown, and creates
   * promotion_usages rows with status='reserved' (atomic budget guard).
   * Called at checkout time (PlaceOrderHandler).
   *
   * Returns { discountAmount: 0, promotionBreakdown: null } when no promotions apply.
   * Never throws for "no applicable promotions" — zero discount is valid.
   * Throws BadRequestException ONLY for invalid/expired/over-limit coupon codes.
   */
  computeAndReserveDiscount(params: DiscountReservationParams): Promise<DiscountReservationResult>;

  /**
   * Read-only preview: computes applicable discounts WITHOUT any DB reservation.
   * Called by CartService for the GET /carts/my/promotions endpoint and the
   * POST /carts/my/coupon validation step. No usage rows are created.
   * Never throws — returns empty result on any internal error.
   */
  previewDiscount(params: DiscountPreviewParams): Promise<DiscountPreviewResult>;

  /**
   * Confirms all reserved usages for an order after successful DB commit.
   * Called after PlaceOrderHandler successfully persists the order.
   * Also called idempotently by PromotionOrderPlacedHandler (event safety net).
   * Idempotent: calling multiple times on the same orderId is safe.
   */
  confirmReservations(orderId: string): Promise<void>;

  /**
   * Rolls back reserved AND confirmed usages for an order.
   * Decrements promotions.current_total_uses AND coupon_codes.current_uses
   * for each usage rolled back.
   * Triggered by OrderStatusChangedEvent(toStatus = 'cancelled' | 'refunded').
   * Idempotent: repeated calls for the same orderId are safe.
   */
  rollbackReservations(orderId: string, reason: string): Promise<void>;
}

export interface DiscountReservationParams {
  orderId: string;                  // the order ID being created (for usage records)
  customerId: string;
  restaurantId: string;
  items: Array<{
    menuItemId: string;
    categoryId: string | null;
    unitPrice: number;
    quantity: number;
    modifiersPrice: number;
  }>;
  shippingFee: number;
  appliedCouponCode: string | null;
  paymentMethod: 'cod' | 'vnpay';
  deliveryDistrict: string;
  deliveryCity: string;
  /**
   * Count of the customer's non-cancelled, non-rolled-back orders.
   * Provided by PlaceOrderHandler (which owns the orders table) so that the
   * Promotion BC never needs to cross-query the Ordering BC's tables (D-PR3).
   * Used to evaluate isFirstOrderOnly conditions.
   */
  customerOrderCount: number;
  /**
   * Customer's account creation timestamp, sourced from the auth schema by
   * PlaceOrderHandler before calling this port.
   * Used to evaluate isNewUserOnly conditions.
   */
  customerAccountCreatedAt: Date;
}

export interface DiscountPreviewParams {
  customerId: string;
  restaurantId: string;
  items: DiscountReservationParams['items'];
  shippingFee: number;
  appliedCouponCode: string | null;
  paymentMethod: 'cod' | 'vnpay';
  deliveryDistrict: string;
  deliveryCity: string;
  customerOrderCount: number;
  customerAccountCreatedAt: Date;
}

export interface DiscountPreviewResult {
  discountAmount: number;
  promotionBreakdown: PricingBreakdown | null;
  couponValidationError: string | null;  // set when coupon code is invalid (non-throwing preview)
}

export interface DiscountReservationResult {
  discountAmount: number;              // integer VND; 0 if no promotions apply
  promotionBreakdown: PricingBreakdown | null; // null when discountAmount = 0
}
```

### 8.2 Integration Points in PlaceOrderHandler

The `PlaceOrderHandler` (in `src/module/ordering/order/commands/place-order.handler.ts`) is modified at **Step 8 (total computation)** and **Step 11 (post-commit cleanup)**. All other steps are unchanged.

```typescript
// Step 8b — NEW: Compute promotion discount
//
// Called AFTER item total and shipping fee are resolved (Step 8),
// BEFORE persisting the order (Step 10).
// This reserves promotion usage records (status='reserved') atomically
// so no other concurrent checkout can exceed budget limits.
//
// Failure handling:
//   If PromotionApplicationPort throws (DB error), we log and continue
//   with discount = 0. The order is placed without a promotion.
//   This is a soft guard — fraud prevention via reservation means we
//   err on the side of placing the order, not rejecting it due to
//   a transient promotion service failure.
//   Exception: BadRequestException (invalid coupon code) IS re-thrown
//   because it is a customer error, not a transient failure.
const { discountAmount, promotionBreakdown } =
  await this.applyPromotion(command, cart!, shippingFee, snapshotedItems);

// Step 8c — Apply discount to totalAmount
const totalAmount = itemsTotal + shippingFee - discountAmount;
// Safety: totalAmount must be > 0 even after discount
if (totalAmount <= MINIMUM_ORDER_TOTAL) {
  throw new UnprocessableEntityException('Order total after promotion must be greater than zero.');
}

// Step 10 — persistOrderAtomically() receives discountAmount + promotionBreakdown
const order = await this.persistOrderAtomically({
  ...existingParams,
  discountAmount,
  promotionBreakdown,
});

// Step 11b — NEW: Confirm promotion reservations (fire-and-forget)
// Must run AFTER order is committed. Failure here does NOT roll back the order.
if (discountAmount > 0) {
  await this.promotionPort.confirmReservations(order.id).catch((err) => {
    this.logger.error(`Failed to confirm promotion reservations for order ${order.id}: ${err.message}`);
  });
}
```

### 8.3 Cart Coupon Endpoints

New endpoints are added to `CartController`:

- `POST /carts/my/coupon` → `CartService.applyCoupon(customerId, couponCode)`
- `DELETE /carts/my/coupon` → `CartService.removeCoupon(customerId)`
- `GET /carts/my/promotions` → `CartService.getApplicablePromotions(customerId)`

`CartService` calls `IPromotionApplicationPort.computeAndReserveDiscount()` in **preview mode** (a separate method that does NOT reserve) at these endpoints to show the customer the estimated discount before checkout.

> **Design note:** Cart coupon preview calls Promotion via a **read-only preview** port method (no reservation, no DB write in Promotion). Only the checkout path performs the actual reservation with DB writes. This avoids phantom reservations from abandoned carts.

### 8.4 Checkout DTO and Response Changes

`CheckoutDto` — **no changes**. The coupon code is stored in the cart, not passed at checkout time.

`CheckoutResponseDto` — gains `discountAmount` and optional `promotionBreakdown` fields as specified in §7.2.

### 8.5 Order History Response

`OrderHistoryService` includes `discount_amount` and `promotion_breakdown` in all order read responses so customers see what discount they received on past orders.

---

## 9. Payment BC Integration

### 9.1 PaymentTransaction Amount

`payment_transactions.amount` is set to `orders.total_amount` — the **final amount after discount**. The Payment BC never knows about promotions; it only cares about the number it must collect. This requires zero changes to the Payment BC.

### 9.2 VNPay Amount Validation

The IPN handler validates `vnp_Amount == paymentTransaction.amount × 100` (VNPay encodes in cents). Since `paymentTransaction.amount = orders.total_amount = itemsSubtotal + shippingFee - discountAmount`, discounted orders are validated correctly with no changes.

### 9.3 Payment Failure → Promotion Rollback

When a VNPay order fails, `PaymentFailedEvent` is published → `PaymentFailedHandler` in Ordering BC cancels the order → `OrderCancelledAfterPaymentEvent` is published. `PromotionModule` subscribes to this event:

```typescript
// src/module/promotion/events/order-cancelled-after-payment.handler.ts
@EventsHandler(OrderCancelledAfterPaymentEvent)
export class PromotionOrderCancelledHandler {
  async handle(event: OrderCancelledAfterPaymentEvent): Promise<void> {
    await this.promotionPort.rollbackReservations(event.orderId, 'payment_failed');
  }
}
```

Rollback decrements `promotions.current_total_uses`, `coupon_codes.current_uses`, and sets `promotion_usages.status = 'rolled_back'`.

### 9.4 Refund Amount

Refunds via VNPay use `orders.total_amount` (the discounted amount). The platform does not refund the notional pre-discount amount. This is consistent with what the customer actually paid.

---

## 10. Notification BC Integration

### 10.1 Existing Events Enriched

`OrderPlacedEvent` is enriched with the discount amount so that notification templates can display "You saved 25,000 VND on this order!":

```typescript
// Existing event — add one new optional field
export class OrderPlacedEvent {
  constructor(
    // ... all existing fields ...
    public readonly discountAmount: number = 0,   // NEW: integer VND
  ) {}
}
```

The `OrderPlacedNotificationHandler` in Notification BC uses this field in the notification template:

```
templateData.discountAmount = String(event.discountAmount);
// Template: "Đặt hàng thành công! Bạn đã tiết kiệm {discountAmount}đ với ưu đãi."
```

### 10.2 New Promotion Events for Notification BC

Notification BC subscribes to two new promotion events:

#### `PromotionAppliedEvent`

```typescript
export class PromotionAppliedEvent {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly promotionId: string,
    public readonly promotionName: string,
    public readonly discountAmount: number,
  ) {}
}
```

Used for push notification: "🎉 Your promotion '{promotionName}' saved you {discountAmount}!"

#### `PromotionBudgetExhaustedEvent`

```typescript
export class PromotionBudgetExhaustedEvent {
  constructor(
    public readonly promotionId: string,
    public readonly promotionName: string,
    public readonly restaurantId: string | null,
    public readonly createdByUserId: string,
  ) {}
}
```

Used to notify the restaurant owner (or admin for platform promos) that their promotion budget has been fully consumed. Delivered as an `in_app` notification via the existing `NotificationService.sendFromEvent()` pattern.

### 10.3 New Notification Types

The `notificationType` enum in `notification.schema.ts` gains:

```
'promotion_applied'           — push to customer when discount applied
'promotion_exhausted'         — in_app to restaurant owner / admin
'coupon_code_applied'         — push/in_app to customer confirming coupon used
```

---

## 11. Event-Driven Architecture

### 11.1 Full Event Flow Diagram

```
CHECKOUT FLOW (synchronous path):
Customer → POST /carts/my/checkout
  → PlaceOrderHandler
    → IPromotionApplicationPort.computeAndReserveDiscount()
      → PromotionApplicationService
        → PromotionPricingEngine.compute()
        → PromotionUsageRepository.createReservations()  [DB write: status='reserved']
        → returns DiscountReservationResult
    → [DB transaction: INSERT orders + order_items + order_status_logs]
    → IPromotionApplicationPort.confirmReservations()   [fire-and-forget]
      → PromotionUsageRepository.confirmReservations()  [update: status='confirmed']
    → EventBus.publish(OrderPlacedEvent { ..., discountAmount })
    → Cart cleared from Redis

EVENT FLOW (async path):
OrderPlacedEvent
  → Payment BC: initiates VNPay session (already exists)
  → Notification BC: OrderPlacedNotificationHandler
      sends "order_placed" push with discountAmount in template
  → Promotion BC: PromotionOrderPlacedHandler
      publishes PromotionAppliedEvent (if discountAmount > 0)

PromotionAppliedEvent
  → Notification BC: sends "promotion_applied" push to customer

PaymentFailedEvent
  → Ordering BC: cancels order → publishes OrderCancelledAfterPaymentEvent
  → Promotion BC: PromotionOrderCancelledHandler
      → rollbackReservations() [decrements usage counters, status='rolled_back']

OrderStatusChangedEvent (status: 'cancelled' for COD orders)
  → Promotion BC: PromotionOrderCancelledHandler (also handles COD cancellation)
```

### 11.2 Event Catalog — New Events

| Event | Publisher | Consumers |
|---|---|---|
| `PromotionAppliedEvent` | Promotion BC | Notification BC |
| `CouponRedeemedEvent` | Promotion BC | Analytics (future) |
| `PromotionBudgetExhaustedEvent` | Promotion BC | Notification BC |
| `PromotionExpiredEvent` | Promotion BC (cron task) | Analytics (future) |

### 11.3 Consumed Events (Promotion BC as listener)

| Event | Published By | Action in Promotion BC |
|---|---|---|
| `OrderPlacedEvent` | Ordering BC | (1) Call `confirmReservations(orderId)` as safety net for fire-and-forget failures; (2) Publish `PromotionAppliedEvent` if `discountAmount > 0` |
| `OrderStatusChangedEvent` (`toStatus = 'cancelled' \| 'refunded'`) | Ordering BC | Rollback reservations; decrement `promotions.current_total_uses` AND `coupon_codes.current_uses` for each usage. Handles all cancellation scenarios: COD cancellation, VNPay payment failure, post-payment refund. |

> **Note:** `OrderCancelledAfterPaymentEvent` also results in an `OrderStatusChangedEvent(toStatus='refunded' or 'cancelled')` being published by Ordering. Therefore the Promotion BC subscribes only to `OrderStatusChangedEvent` with a status filter — no need for a separate `OrderCancelledAfterPaymentEvent` handler. This prevents double-rollback.
>
> **Safety net:** `PromotionOrderPlacedHandler` calls `confirmReservations(orderId)` idempotently. If the synchronous `confirmReservations()` call in `PlaceOrderHandler` succeeded, calling it again is a no-op (`UPDATE ... WHERE status='reserved'` → 0 rows). If it failed, this handler corrects the state from the event stream.

---

## 12. Admin Capabilities

### 12.1 Platform Admin Features

| Feature | Description |
|---|---|
| Create platform-wide promotions | All discount types, all condition types, full scheduling |
| Bulk-generate coupon codes | Generate N unique codes linked to a promotion |
| View promotion performance | Usage count, total discount given, revenue impact |
| Pause/resume promotions | Immediate effect — in-flight orders retain their reserved discount |
| Promote to flash sale | Activate promotion with shortened schedule, max_total_uses |
| View fraud signals | Flag customers with abnormal coupon usage patterns |

### 12.2 Restaurant Owner Features

| Feature | Description |
|---|---|
| Create restaurant-scoped promotions | `percentage`, `fixed_amount`, `free_delivery`, `reduced_delivery` |
| Cannot create platform-wide | Enforced by RBAC guard: `scope` must be `restaurant`, `item`, or `category` |
| Set budget | `max_total_uses` and `max_per_customer` |
| View own promotion analytics | Redemptions per day, average discount, order conversion lift |
| Activate/pause own promotions | Self-service |

### 12.3 Promotion Approval Workflow (Optional Phase 3+)

Restaurant-created promotions above a discount threshold (e.g., > 50%) can be set to require admin approval before activation. This is controlled by an `app_settings` key `PROMOTION_AUTO_APPROVE_THRESHOLD_PERCENT`. Below the threshold: auto-activated. Above: requires admin review.

---

## 13. Fraud & Abuse Prevention

### 13.1 Race Condition Prevention (Budget Exhaustion)

**Scenario:** 1,000 users simultaneously redeem a "first 100 customers get 50% off" promotion.

**Solution:** Atomic increment with guard condition using PostgreSQL optimistic locking:

```sql
-- PromotionUsageRepository.atomicIncrementAndReserve()
UPDATE promotions
SET
  current_total_uses = current_total_uses + 1,
  version            = version + 1
WHERE
  id                = $promotionId
  AND status        = 'active'
  AND (max_total_uses IS NULL OR current_total_uses < max_total_uses)
RETURNING id, current_total_uses;
```

If the `UPDATE` returns 0 rows → promotion is exhausted → `PromotionBudgetExhaustedEvent` is published → promotion status → `'exhausted'`. The customer receives `400 Bad Request: "Promotion has reached its usage limit"`.

### 13.2 Per-Customer Limit Enforcement

```sql
-- Check before reservation
SELECT COUNT(*) FROM promotion_usages
WHERE promotion_id = $1
  AND customer_id  = $2
  AND status != 'rolled_back';
-- If count >= promotion.max_per_customer → reject
```

This query uses the `idx_promo_usage_customer` partial index (status != 'rolled_back') for efficiency.

### 13.3 Coupon Code Deduplication

Coupon codes are stored `UPPER(code)` in the unique index. Application layer normalizes to uppercase before lookup. Timing attacks on code guessing are mitigated by:
- Minimum code length: 8 characters
- Rate limiting: 5 coupon attempts per customer per minute (Redis rate limiter)
- No difference in response time between "code not found" and "code exhausted"

### 13.4 First-Order Fraud

"First order only" promotions check `ORDER COUNT WHERE customer_id = X AND status NOT IN ('cancelled', 'rolled_back')`. This query uses the `idx_orders_customer_id` index (add if not present). Accounts are verified via IAM (email/phone verification before checkout).

### 13.5 Coupon Sharing Prevention

`max_per_customer = 1` enforced at the database level via the unique constraint on `promotion_usages (order_id, promotion_id)` plus the per-customer count check. Even if a customer places an order, gets a discount, cancels it (rollback), then re-orders — the per-customer count only counts `status != 'rolled_back'` entries, so a genuine cancellation restores eligibility.

### 13.6 Reservation Timeout

Promotion reservations with `status='reserved'` and `reserved_at < NOW() - INTERVAL '10 minutes'` are automatically rolled back by the `PromotionReservationCleanupTask` (scheduled cron). This prevents leaked reservations from abandoned or failed checkouts inflating usage counts.

**Important limitation:** The Promotion BC cannot query the `orders` table to verify whether an order exists (D-PR3). Therefore the cleanup task rolls back ALL stale `reserved` records after the timeout window, regardless of whether the order was committed. The `PromotionOrderPlacedHandler` (which calls `confirmReservations()` on `OrderPlacedEvent`) provides the safety net that transitions legitimate reservations to `confirmed` within seconds of order creation — well before the 10-minute cleanup window fires. Stale `reserved` records that have NOT been confirmed within 10 minutes are almost certainly from failed or abandoned checkouts and are safe to roll back.

Rollback in the cleanup task decrements `promotions.current_total_uses` AND `coupon_codes.current_uses` for each record rolled back, restoring the budget correctly.

### 13.7 Discount Amount Validation

At checkout, after `PromotionApplicationService` returns a `discountAmount`, the handler validates:

```typescript
if (discountAmount < 0) throw new InternalServerErrorException('Invalid discount amount');
if (discountAmount > itemsTotal + shippingFee) throw new InternalServerErrorException('Discount exceeds order total');
if (discountAmount % 1000 !== 0) throw new InternalServerErrorException('Discount is not a VND multiple of 1000');
```

These are programming-error guards, not user-facing — they catch engine bugs before they reach the DB.

---

## 14. Scalability & Caching Strategy

### 14.1 Promotion Cache in Redis

Active promotions rarely change. Cache the full `Promotion[]` list per `restaurantId` in Redis:

```
Key: promo:active:<restaurantId>     TTL: 5 minutes
Key: promo:active:platform           TTL: 5 minutes
```

Cache is invalidated on every `POST/PATCH /admin/promotions`, `POST /restaurant/promotions`, and status change. The cache entry stores the full promotion object including conditions (JSONB). Pricing engine reads from cache; DB is the authoritative source.

For flash sales (high invalidation frequency), TTL is reduced to 30 seconds.

### 14.2 Budget Counter in Redis

For high-traffic promotions with tight budgets (e.g., `max_total_uses = 100`), a Redis counter is used as a **pre-check** before the PostgreSQL atomic update:

```
Key: promo:budget:<promotionId>    Value: current_total_uses   TTL: no expiry (evicted on exhaustion)
```

Flow:
1. `INCR promo:budget:<id>` → if result > max_total_uses → `DECR` and return "exhausted" (fast path, no DB hit)
2. If result ≤ max_total_uses → proceed with DB atomic update
3. Redis counter is the fast-fail guard; DB is the authoritative source

This reduces DB lock contention on hot promotions significantly.

### 14.3 Query Optimization

- `idx_promotions_active_restaurant` partial index ensures only `status='active'` promotions are scanned
- `idx_promo_usage_customer` partial index (`WHERE status != 'rolled_back'`) covers the per-customer limit check
- GIN indexes on `eligible_item_ids` and `eligible_category_ids` support `@>` array containment queries

### 14.4 Promotion Engine Scalability

The `PromotionPricingEngine` is stateless and has no I/O — it is trivially horizontally scalable. The I/O cost is bounded to:
1. One Redis read (active promotions for restaurant)
2. One DB read (per-customer usage count) per eligible promotion
3. One DB write (bulk reservation insert)

At 100 orders/second with 5 active promotions per restaurant: ~600 DB reads + 500 DB writes/second — well within PostgreSQL's capacity on the current stack.

---

## 15. Observability & Monitoring

### 15.1 Structured Logging

All `PromotionApplicationService` operations log at INFO level with structured context:

```
[PromotionApplicationService] orderId=<uuid> customerId=<uuid> promotionsEvaluated=5 promotionsApplied=1 discountAmount=25000 durationMs=12
[PromotionApplicationService] Coupon SUMMER20 validated for customerId=<uuid>
[PromotionApplicationService] Promotion <id> exhausted (current_total_uses=100 >= max_total_uses=100)
```

### 15.2 Metrics (Future — Prometheus/Grafana)

| Metric | Type | Description |
|---|---|---|
| `promotion_evaluations_total` | Counter | Total promotion evaluations at checkout |
| `promotion_discounts_applied_total` | Counter | Orders with at least one promo applied |
| `promotion_discount_amount_vnd` | Histogram | Distribution of discount amounts applied |
| `promotion_rollbacks_total` | Counter | Reservation rollbacks (payment failures) |
| `promotion_exhaustions_total` | Counter | Promotions that reached their budget limit |
| `coupon_validation_errors_total` | Counter | Invalid coupon code attempts |

### 15.3 Alerting

| Alert | Threshold | Action |
|---|---|---|
| High rollback rate | > 10% of reservations rolled back in 1h | Investigate payment BC health |
| Budget exhaustion spike | > 5 exhaustions in 5 min | Flash sale capacity review |
| Coupon brute-force | > 50 failures/min per IP | Rate limiter + admin notification |

---

## 16. Testing Strategy

### 16.1 Unit Tests

**`PromotionPricingEngine`** — 100% unit test coverage required:
- Each discount type: `percentage`, `fixed_amount`, `free_delivery`, `reduced_delivery`, `buy_x_get_y`, `free_item`
- Stacking combinations: exclusive overrides all, non-stackable picks best, stackable combines
- Condition evaluation: each condition type individually, combinations
- VND rounding: `roundDownTo1000()` with fractional inputs
- Cap enforcement: `maxDiscountAmount` cap, `min(discount, itemsSubtotal)` safety cap
- Time-window conditions: inject fixed `now` Date for determinism
- Zero-discount path: no matching promos → `{ discountAmount: 0, promotionBreakdown: null }`

**`PromotionApplicationService`** — unit tests with mocked repositories:
- Coupon validation happy path
- Coupon not found → `BadRequestException`
- Coupon expired → `BadRequestException`
- Coupon max_uses reached → `BadRequestException`
- Promotion budget exhausted → `BadRequestException`
- Per-customer limit reached → `BadRequestException`
- DB error on reservation → soft fallback (discount = 0, order proceeds)
- Confirm reservations — updates all `status='reserved'` to `'confirmed'`
- Rollback reservations — updates all `status='confirmed'` to `'rolled_back'`, decrements counters

### 16.2 E2E Tests

New test suite: `test/e2e/promotion.e2e-spec.ts`

| Test ID | Scenario | Expected |
|---|---|---|
| PR-01 | Checkout with no active promos → discountAmount = 0 | 200, discountAmount = 0 |
| PR-02 | Auto-apply free delivery promo, basket meets threshold → discount = shippingFee | 200, discount = full shipping |
| PR-03 | Apply valid coupon code → discount applied, usage recorded | 200, discountAmount > 0 |
| PR-04 | Apply invalid coupon code → cart coupon endpoint rejects | 400 |
| PR-05 | Apply coupon exceeding per-customer limit → rejected | 400 |
| PR-06 | Apply percentage promo with maxDiscountAmount cap | 200, discount = min(computed, cap) |
| PR-07 | First-order promo, customer has no orders → applied | 200 |
| PR-08 | First-order promo, customer already has one order → not applied | 200, discountAmount = 0 |
| PR-09 | Exclusive promo overrides stackable promos | 200, only exclusive discount |
| PR-10 | Two stackable promos (item + delivery) → both applied | 200, sum of both |
| PR-11 | Checkout with coupon, VNPay payment fails → usage rolled back | Rollback event consumed |
| PR-12 | Coupon code is case-insensitive (`summer20` = `SUMMER20`) | 200 |
| PR-13 | Promo with time-window condition (active hours) — checkout outside window → not applied | 200, discount = 0 |
| PR-14 | Budget exhaustion: 100-use promo, 101st user → rejected | 400 |
| PR-15 | Discount does not reduce `payment_transactions.amount` incorrectly | 200, amount matches totalAmount |
| PR-16 | `GET /carts/my/promotions` returns applicable auto-apply promos | 200, promotions list |
| PR-17 | Remove coupon code from cart → pendingDiscount = 0 | 200 |
| PR-18 | BOGO promo: buy 2 get 1 free → discount = 1 × unitPrice | 200 |

### 16.3 Integration Test Notes

E2E tests seed promotion data directly into the `promotions` table using the existing `test/setup/` helpers. Coupon codes are seeded alongside promotions. The existing 730/730 test suite must remain green after all migration changes.

---

## 17. Phase-by-Phase Roadmap

### Phase PR-1 — Foundation (Schema + Engine) ✅ IMPLEMENTED

> **Completed:** All deliverables implemented, 42/42 E2E tests passing, TypeScript clean.

**Goal:** Database tables and pure pricing engine. No behavioral changes to checkout.

**Deliverables:**
- `src/module/promotion/` module scaffolding
- Drizzle schema: `promotions`, `coupon_codes`, `promotion_usages` tables
- Migration: `ALTER TABLE orders ADD COLUMN discount_amount INTEGER DEFAULT 0, ADD COLUMN promotion_breakdown JSONB`
- `PromotionPricingEngine` (pure, stateless, unit-tested)
- `PromotionRepository`, `CouponCodeRepository`, `PromotionUsageRepository`
- `IPromotionApplicationPort` in `src/shared/ports/`
- `PromotionApplicationService` implements `IPromotionApplicationPort`
- `@Global() PromotionModule` with DIP token registration

**Test milestone:** `PromotionPricingEngine` unit tests — all discount types passing.

### Phase PR-2 — Admin CRUD ✅ IMPLEMENTED

> **Completed:** All deliverables implemented, 42/42 E2E tests passing, TypeScript clean.

**Goal:** Platform admin and restaurant owner can create/manage promotions via REST API.

**Deliverables:**
- `AdminPromotionController` + DTOs with full validation
- `RestaurantPromotionController` + RBAC guard
- Coupon code bulk-generation endpoint
- `GET /promotions/active?restaurantId` for app banners

**Test milestone:** Admin CRUD E2E tests.

### Phase PR-3 — Ordering Integration (Checkout) ✅ IMPLEMENTED

**Goal:** Discount is computed and reserved at checkout. Orders store `discount_amount`. Cancellation/refund rolls back reservation.

**Actual deliverables implemented (2025-05-13):**
- `src/drizzle/out/0013_promotion_checkout.sql` — adds `discount_amount integer NOT NULL DEFAULT 0` to `orders`
- `order.schema.ts` — `discountAmount` field added to `orders` Drizzle model
- `checkout.dto.ts` — `CheckoutDto` gets optional `couponCode?: string` field; `CheckoutResponseDto` gets `discountAmount: number`
- `place-order.command.ts` — `couponCode?: string` added as 7th constructor argument
- `cart.controller.ts` — passes `dto.couponCode` to `PlaceOrderCommand`; maps `order.discountAmount` in `toCheckoutResponse`
- `place-order.handler.ts` — injects `PROMOTION_APPLICATION_PORT`; pre-generates `orderId` (UUID) before the DB transaction so `tempOrderId === order.id`; calls `computeAndReserveDiscount()` after `itemsTotal > 0` guard; computes `finalTotalAmount = max(0, itemsTotal + shippingFee − discountAmount)`; wraps `persistOrderAtomically` in try/catch that calls `rollbackReservations()` before re-throwing; calls `confirmReservations()` after successful persistence
- `order-lifecycle/events/promotion-rollback-on-cancellation.handler.ts` (NEW) — handles `OrderStatusChangedEvent`, calls `rollbackReservations()` when `toStatus === 'cancelled' | 'refunded'` (covers PR-4 scope)
- `order-lifecycle.module.ts` — registers `PromotionRollbackOnCancellationHandler`

**Design decisions made:**
- Coupon code at checkout (in `CheckoutDto`) rather than at cart, for simplicity and idempotency-key compatibility
- Pre-generated order UUID ensures `promotion_usages.order_id === orders.id` at insert time
- Cancellation rollback merged into PR-3 (originally PR-4 scope) — single `PromotionRollbackOnCancellationHandler` handles all terminal states

**Deferred to later phases:**
- `POST /carts/my/coupon` + `DELETE /carts/my/coupon` discount-preview endpoints
- Cart Redis type extension with `appliedCouponCode`, `pendingDiscountAmount`
- `PromotionReservationCleanupTask` (stale-reservation cron)

**Test milestone:** 774/774 E2E tests passing.

### Phase PR-4 — Payment Rollback Integration ✅ IMPLEMENTED (merged into PR-3)

**Goal:** Promotion usage is rolled back when payment fails or order is cancelled.

**Status:** Fully covered by `PromotionRollbackOnCancellationHandler` introduced in PR-3.
That handler subscribes to `OrderStatusChangedEvent` (published on every transition by `TransitionOrderHandler`)
and calls `rollbackReservations()` when `toStatus === 'cancelled' || toStatus === 'refunded'`.
This covers all terminal states: customer cancel (T-03), restaurant cancel (T-05), order timeout (T-07),
payment failure (T-06), and admin refund (T-12).

**Original deliverables — all covered:**
- ~~`PromotionOrderCancelledHandler` subscribes to `OrderCancelledAfterPaymentEvent`~~ → handled by `PromotionRollbackOnCancellationHandler` via `OrderStatusChangedEvent`
- ~~`PromotionOrderCancelledHandler` also handles COD cancellations via `OrderStatusChangedEvent`~~ → same handler covers both
- Budget counter decremented on rollback ✅ (via `rollbackReservations()` → `usageRepo.rollbackByOrderId()`)
- `PromotionUsage.status` set to `'rolled_back'` ✅

### Phase PR-5 — Notification Integration

**Goal:** Customers receive push notifications for applied promotions. Restaurant owners notified on budget exhaustion.

**Deliverables:**
- `PromotionAppliedEvent`, `PromotionBudgetExhaustedEvent` added to `src/shared/events/index.ts`
- `PromotionOrderPlacedHandler` in Promotion BC publishes `PromotionAppliedEvent`
- Notification BC: new handlers for `PromotionAppliedEvent` and `PromotionBudgetExhaustedEvent`
- New notification types added to `notificationType` enum
- New notification templates

**Test milestone:** Notification E2E tests for new notification types.

### Phase PR-6 — Analytics & Redis Caching

**Goal:** Promotion performance dashboard, Redis caching for hot promotions.

**Deliverables:**
- `GET /admin/promotions/:id/usages` analytics endpoint
- Redis caching for `promo:active:<restaurantId>`
- Redis budget counter for high-traffic promotions
- `GET /restaurant/promotions/:id/usages`

---

## 18. Tradeoff Analysis

### 18.1 Synchronous vs. Asynchronous Promotion Application

| Aspect | Synchronous (SELECTED) | Asynchronous |
|---|---|---|
| Customer UX | Discount shown in checkout response immediately | Customer would need to poll or receive WS event |
| Consistency | Discount is computed and reserved in one request | Risk of discount changing between cart preview and order commit |
| Latency | +10–15ms at checkout (one DB read + write) | No latency at checkout |
| Complexity | Simple — mirrors IPaymentInitiationPort pattern | Requires polling, eventual consistency, compensating saga |

**Verdict:** Synchronous is the right choice. The discount must be in the checkout response. The +15ms latency is acceptable.

### 18.2 Discount Applied to `total_amount` vs. Separate Column

| Aspect | Discount deducted from `total_amount` | Separate `final_amount` column |
|---|---|---|
| Payment BC compatibility | Zero change — Payment BC uses `total_amount` as-is | Requires Payment BC to read `final_amount` |
| Schema simplicity | One authoritative amount, one discount column | Two amount columns, confusion over which is "real" |
| Audit | `promotion_breakdown` JSONB shows all details | Duplicate data |

**Verdict:** `total_amount = final amount after discount`. Add `discount_amount` separately for display. This is the minimal change.

### 18.3 Coupon at Checkout vs. at Cart

| Aspect | Coupon at Cart | Coupon at Checkout (SELECTED) |
|---|---|---|
| UX | Customer sees discount before tapping "Place Order" | Customer sees discount only in checkout response |
| `CheckoutDto` complexity | No changes to checkout request | New optional `couponCode` field |
| Idempotency | Coupon stored in cart → idempotent with X-Idempotency-Key | Coupon in body — same value on retry is safe (coupon validation is idempotent) |
| Cart abandonment | Coupon preview without reservation → no leaked usage | No cart-level preview needed |
| Implementation simplicity | Requires new cart endpoints + cart Redis schema change | Single new field in CheckoutDto |

**Verdict (revised in PR-3):** Coupon at checkout was selected for PR-3 because it is simpler (zero cart schema changes) and still correct. Idempotency is preserved because the coupon code is a deterministic input — retrying with the same X-Idempotency-Key returns the cached result. Cart-level preview endpoints (`POST /carts/my/coupon`) are deferred to a later phase.

### 18.4 Separate Bounded Context vs. Module Inside Ordering

| Aspect | Supporting Subdomain Module (SELECTED) | Inside Ordering |
|---|---|---|
| Code isolation | Complete — own tables, services, events | Logical only — same module |
| Admin endpoints | Own controller, own guards | Ordering controller grows |
| Extraction readiness | High — one module to extract | Requires refactoring Ordering |
| DIP port complexity | Mirrors Payment pattern | No port needed |
| CQRS event handling | Own handlers | Shared with Ordering handlers |

**Verdict:** Supporting Subdomain module. Same complexity as what already exists for Payment.

---

## 19. Final Recommendation

### 19.1 Architecture Summary

**Promotion** is implemented as `src/module/promotion/` — a **top-level NestJS module** (Supporting Subdomain). It integrates with Ordering BC via `IPromotionApplicationPort` (Dependency Inversion Principle), follows the identical pattern established by `IPaymentInitiationPort`, and publishes its own domain events to downstream BCs.

The pricing engine is **pure, stateless, and deterministic** — the entire discount computation can be unit-tested in isolation. The reservation pattern guarantees budget limits are never exceeded under concurrency. The VND rounding rule ensures all discounts are multiples of 1,000 VND. The `PricingBreakdown` JSONB snapshot in `orders` provides an immutable audit trail.

### 19.2 Minimal Schema Change Surface

| Change | Risk |
|---|---|
| 3 new tables: `promotions`, `coupon_codes`, `promotion_usages` | Low — additive |
| 2 new columns on `orders`: `discount_amount`, `promotion_breakdown` | Low — `DEFAULT 0` / nullable, zero existing test impact |
| 2 new optional fields on Cart Redis type | Low — backwards compatible |
| `OrderPlacedEvent` gains `discountAmount = 0` default | Low — backwards compatible, existing consumers unaffected |

### 19.3 Zero Regression Guarantee

The existing 730/730 E2E tests remain green because:
1. `discount_amount DEFAULT 0` — all existing test order assertions use `totalAmount = itemsSubtotal + shippingFee`, which remains correct when `discountAmount = 0`
2. The `PlaceOrderHandler` change is behind the `computeAndReserveDiscount()` call — when no promotions are configured (test environment), the port returns `{ discountAmount: 0, promotionBreakdown: null }` and the total calculation is unchanged
3. `CheckoutResponseDto` gains `discountAmount` as a new required field — all existing response assertions need to tolerate this addition (use `expect.objectContaining(...)` in tests, which is already the pattern used)
4. `Cart` Redis type extension is backwards compatible — existing carts without the new fields are treated as having `appliedCouponCode: undefined`

### 19.4 Implementation Starting Point

Begin with **Phase PR-1** (Foundation): create the `promotions`, `coupon_codes`, `promotion_usages` tables, the `PromotionPricingEngine` unit-tested class, and the `IPromotionApplicationPort` interface. This phase has **zero integration impact** on the running system — it adds tables and code but touches no existing logic. All subsequent phases are additive.

### 19.5 Decision Log

| Decision | Rationale |
|---|---|
| Supporting Subdomain (top-level module) | Follows IPaymentInitiationPort pattern; clean extraction boundary |
| Synchronous DIP call at checkout | Discount must be in checkout response; mirrors Payment integration |
| Coupon stored in cart, not checkout body | Better UX, idempotency compatibility, no CheckoutDto change |
| `total_amount` = final amount after discount | Zero Payment BC changes; single authoritative monetary field |
| `PricingBreakdown` as JSONB snapshot | Immutable audit trail; mirrors `order_items.modifiers` snapshot pattern |
| VND rounding: `floor(/ 1000) * 1000` | Consistent with `@IsVNDAmount()` constraint across all monetary fields |
| Reservation pattern (reserved → confirmed → rolled_back) | Prevents budget over-consumption under concurrency |
| Redis pre-check for budget counters | Reduces DB lock contention on hot promotions |
| `now: Date` injected into pricing engine | Full determinism for unit tests |
| `customerOrderCount` + `customerAccountCreatedAt` in `DiscountReservationParams` | Ordering BC provides context it owns (orders table, auth schema) so Promotion BC never cross-queries those tables (D-PR3) |
| `previewDiscount()` separate from `computeAndReserveDiscount()` | Cart preview must be read-only; never create reservation rows for abandoned carts |
| `discountValue` as plain integer percent (0-100) for `percentage` type | Avoids confusing basis-points encoding; clean separation from VND-typed fields |
| `OrderStatusChangedEvent(toStatus IN [cancelled, refunded])` as single rollback trigger | Covers all cancellation paths (COD, VNPay failure, post-payment refund) without double-rollback risk |
| `PromotionOrderPlacedHandler` calls `confirmReservations()` as safety net | Heals missed fire-and-forget confirms via event stream; idempotent |

---

*End of Promotion Context Architectural Proposal*

*Document path: `apps/api/docs/Bình's docs/PROMOTION_CONTEXT_PROPOSAL.md`*
*Last updated: based on codebase audit of all 7 BCs (Ordering phases 0–7, Payment phase 8, Notification phase N)*
