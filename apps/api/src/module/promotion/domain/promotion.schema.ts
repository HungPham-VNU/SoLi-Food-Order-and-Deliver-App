import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// promotion_type enum
//
// Controls how the discount is computed:
//   percentage      — reduce item subtotal by X % (1–100)
//   fixed_amount    — reduce item subtotal by a fixed VND amount
//   free_delivery   — zero out the shipping fee entirely
//   reduced_delivery — reduce the shipping fee by a fixed VND amount
//   buy_x_get_y     — reserved for Phase PR-4 (complex cart rules)
//   free_item       — reserved for Phase PR-4
// ---------------------------------------------------------------------------
export const promotionTypeEnum = pgEnum('promotion_type', [
  'percentage',
  'fixed_amount',
  'free_delivery',
  'reduced_delivery',
  'buy_x_get_y',
  'free_item',
]);

export type PromotionType = (typeof promotionTypeEnum.enumValues)[number];

// ---------------------------------------------------------------------------
// promotion_scope enum
//
//   platform   — applies across all restaurants, managed by admin
//   restaurant — applies to one specific restaurant, managed by restaurant owner
// ---------------------------------------------------------------------------
export const promotionScopeEnum = pgEnum('promotion_scope', [
  'platform',
  'restaurant',
]);

export type PromotionScope = (typeof promotionScopeEnum.enumValues)[number];

// ---------------------------------------------------------------------------
// promotion_status enum
//
// State machine:
//   draft    → active    (admin activates)
//   active   → paused    (admin / owner pauses)
//   paused   → active    (admin / owner re-activates)
//   active   → expired   (automatic — endsAt has passed; handled by query filtering)
//   active|paused → cancelled (admin soft-deletes)
// ---------------------------------------------------------------------------
export const promotionStatusEnum = pgEnum('promotion_status', [
  'draft',
  'active',
  'paused',
  'cancelled',
  'expired',
]);

export type PromotionStatus = (typeof promotionStatusEnum.enumValues)[number];

// ---------------------------------------------------------------------------
// promotion_trigger enum
//
//   auto_apply  — engine auto-applies when conditions are met (no coupon required)
//   coupon_code — customer must enter a coupon code
// ---------------------------------------------------------------------------
export const promotionTriggerEnum = pgEnum('promotion_trigger', [
  'auto_apply',
  'coupon_code',
]);

export type PromotionTrigger = (typeof promotionTriggerEnum.enumValues)[number];

// ---------------------------------------------------------------------------
// stacking_mode enum
//
//   non_stackable — cannot be combined with any other promotion
//   stackable     — can stack on top of other stackable promotions
//   exclusive     — cannot stack and blocks all other promotions (highest priority)
// ---------------------------------------------------------------------------
export const stackingModeEnum = pgEnum('stacking_mode', [
  'non_stackable',
  'stackable',
  'exclusive',
]);

export type StackingMode = (typeof stackingModeEnum.enumValues)[number];

// ---------------------------------------------------------------------------
// coupon_status enum
// ---------------------------------------------------------------------------
export const couponStatusEnum = pgEnum('coupon_status', [
  'active',
  'exhausted',
  'expired',
  'revoked',
]);

export type CouponStatus = (typeof couponStatusEnum.enumValues)[number];

// ---------------------------------------------------------------------------
// usage_status enum
//
//   reserved    — checkout started; counters incremented; waiting for confirm/rollback
//   confirmed   — order persisted; discount is final
//   rolled_back — order cancelled; counters decremented
// ---------------------------------------------------------------------------
export const usageStatusEnum = pgEnum('usage_status', [
  'reserved',
  'confirmed',
  'rolled_back',
]);

export type UsageStatus = (typeof usageStatusEnum.enumValues)[number];

// ---------------------------------------------------------------------------
// promotions
//
// Core aggregate for the Promotion BC. Manages eligibility rules and lifecycle.
//
// discount_value semantics:
//   - percentage type   : integer 1–100 (plain percent, e.g. 10 = 10 % off)
//   - all other types   : integer VND (e.g. 20000 = 20 000 VND off)
//
// restaurant_id:
//   - NULL  → platform promotion (scope = 'platform')
//   - UUID  → restaurant-scoped (scope = 'restaurant', UUID = restaurant PK)
//
// Cross-context reference: restaurant_id is a plain UUID with no FK constraint
// (follows D-P7 — enables future microservice extraction).
// ---------------------------------------------------------------------------
export const promotions = pgTable(
  'promotions',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    name: text('name').notNull(),
    description: text('description'),

    type: promotionTypeEnum('type').notNull(),
    scope: promotionScopeEnum('scope').notNull(),
    status: promotionStatusEnum('status').notNull().default('draft'),
    trigger: promotionTriggerEnum('trigger').notNull(),
    stackingMode: stackingModeEnum('stacking_mode')
      .notNull()
      .default('non_stackable'),

    // Cross-context UUID reference (no PG FK) — null for platform promotions
    restaurantId: uuid('restaurant_id'),

    /**
     * For 'percentage' type: integer 1–100 (e.g. 15 = 15% off).
     * For all other types: integer VND, must be a multiple of 1000.
     */
    discountValue: integer('discount_value').notNull(),

    /**
     * Minimum order item subtotal (VND, multiple of 1000) required to apply
     * this promotion. NULL = no minimum.
     */
    minOrderAmount: integer('min_order_amount'),

    /**
     * Maximum discount cap for 'percentage' type (VND, multiple of 1000).
     * NULL = no cap on percentage discounts.
     * Ignored for non-percentage types.
     */
    maxDiscountAmount: integer('max_discount_amount'),

    /** Total quota across all customers. NULL = unlimited. */
    maxTotalUses: integer('max_total_uses'),

    /** Atomically incremented at reservation time. */
    currentTotalUses: integer('current_total_uses').notNull().default(0),

    /** Max times a single customer can use this promotion. NULL = unlimited. */
    maxUsesPerUser: integer('max_uses_per_user'),

    /** Whether this promotion requires a verified restaurant (future use). */
    requiresApprovedRestaurant: boolean('requires_approved_restaurant')
      .notNull()
      .default(false),

    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),

    /**
     * Optimistic locking — incremented on every mutation to prevent
     * concurrent write conflicts (mirrors orders.version pattern).
     */
    version: integer('version').notNull().default(0),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    // Most admin queries filter by status
    index('idx_promotions_status').on(t.status),
    // Restaurant owner queries
    index('idx_promotions_restaurant_id').on(t.restaurantId),
    // Engine query: active + scope + trigger
    index('idx_promotions_scope_trigger_status').on(
      t.scope,
      t.trigger,
      t.status,
    ),
    // Date-range eligibility scan
    index('idx_promotions_ends_at').on(t.endsAt),
  ],
);

export type Promotion = typeof promotions.$inferSelect;
export type NewPromotion = typeof promotions.$inferInsert;

// ---------------------------------------------------------------------------
// coupon_codes
//
// One-to-many: each promotion may have multiple unique coupon codes.
// When a customer uses a code, current_uses is atomically incremented via a
// conditional UPDATE: SET current_uses = current_uses + 1
//                     WHERE id = $1 AND (max_uses IS NULL OR current_uses < max_uses)
//
// Rows do not have FK constraints on promotion_id (D-P7).
// ---------------------------------------------------------------------------
export const couponCodes = pgTable(
  'coupon_codes',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Plain UUID reference to promotions.id (no PG FK)
    promotionId: uuid('promotion_id').notNull(),

    /** Uppercase, alphanumeric code customers type at checkout. UNIQUE. */
    code: text('code').notNull(),

    status: couponStatusEnum('status').notNull().default('active'),

    /** NULL = unlimited uses for this specific code. */
    maxUses: integer('max_uses'),

    /** Atomically incremented on each reservation. */
    currentUses: integer('current_uses').notNull().default(0),

    /** If set, this code is invalid after this timestamp regardless of status. */
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    version: integer('version').notNull().default(0),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    // Code must be globally unique — used for O(1) lookup at checkout
    unique('coupon_codes_code_unique').on(t.code),
    // Lookup by promotion for admin list-coupons
    index('idx_coupon_codes_promotion_id').on(t.promotionId),
    // Status filter for active lookups
    index('idx_coupon_codes_status').on(t.status),
  ],
);

export type CouponCode = typeof couponCodes.$inferSelect;
export type NewCouponCode = typeof couponCodes.$inferInsert;

// ---------------------------------------------------------------------------
// promotion_usages
//
// Audit + reservation ledger for the Promotion BC.
//
// Lifecycle:
//   1. 'reserved'    — written at computeAndReserveDiscount() time.
//                      orderId = tempOrderId (pre-generated, matches orders.id).
//   2. 'confirmed'   — written when the order is committed to DB.
//   3. 'rolled_back' — written when the order is cancelled / checkout fails.
//
// Stale 'reserved' rows (>15 min old) are cleaned up by the
// PromotionReservationCleanupTask (Phase PR-5, scheduled job) which:
//   - Updates status → 'rolled_back'
//   - Decrements counters on promotions and coupon_codes
//
// Cross-context: order_id, customer_id are plain UUIDs (no PG FK).
// ---------------------------------------------------------------------------
export const promotionUsages = pgTable(
  'promotion_usages',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    promotionId: uuid('promotion_id').notNull(),
    couponCodeId: uuid('coupon_code_id'), // NULL for auto_apply promotions

    /** Matches tempOrderId at reservation time = the actual orders.id */
    orderId: uuid('order_id').notNull(),
    customerId: uuid('customer_id').notNull(),

    /** Discount applied on item subtotal (VND, rounded to 1000). */
    discountOnItems: integer('discount_on_items').notNull().default(0),

    /** Discount applied on shipping fee (VND). */
    discountOnShipping: integer('discount_on_shipping').notNull().default(0),

    /** Total discount = discountOnItems + discountOnShipping */
    discountAmount: integer('discount_amount').notNull(),

    status: usageStatusEnum('status').notNull().default('reserved'),

    reservedAt: timestamp('reserved_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    rolledBackAt: timestamp('rolled_back_at', { withTimezone: true }),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    // Confirm / rollback look up by orderId
    index('idx_promo_usages_order_id').on(t.orderId),
    // Per-user quota enforcement (check how many times user used this promotion)
    index('idx_promo_usages_promo_customer').on(t.promotionId, t.customerId),
    // Cleanup task scans stale 'reserved' rows by reservedAt
    index('idx_promo_usages_status_reserved_at').on(t.status, t.reservedAt),
  ],
);

export type PromotionUsage = typeof promotionUsages.$inferSelect;
export type NewPromotionUsage = typeof promotionUsages.$inferInsert;
