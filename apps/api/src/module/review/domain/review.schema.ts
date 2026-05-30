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

// ---------------------------------------------------------------------------
// review_moderation_status enum
//
// State machine:
//   visible (default) — public, included in rating projection
//   flagged           — reported but still public until admin actions
//   hidden            — admin moderated; excluded from rating projection + listings
// ---------------------------------------------------------------------------
export const reviewModerationStatusEnum = pgEnum('review_moderation_status', [
  'visible',
  'flagged',
  'hidden',
]);

export type ReviewModerationStatus =
  (typeof reviewModerationStatusEnum.enumValues)[number];

// ---------------------------------------------------------------------------
// reviews
//
// One row per delivered customer order (BR-22.8). Cross-context references
// (customerId, restaurantId) are plain UUIDs without FK constraints — the
// Review BC snapshots these values at creation time (BR-22.3).
//
// Phase: RV-2 — Review & Rating BC
// ---------------------------------------------------------------------------
export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // UNIQUE enforced via unique() constraint below — one review per order
    orderId: uuid('order_id').notNull(),
    customerId: uuid('customer_id').notNull(),
    restaurantId: uuid('restaurant_id').notNull(),
    // 1–5 integer; app-layer validated + DB check constraint below
    stars: smallint('stars').notNull(),
    // Nullable; max 1000 chars enforced at app layer
    comment: text('comment'),
    // Nullable; max 5 items enforced at app layer; allowlist enforced in DTO
    tags: text('tags').array(),
    moderationStatus: reviewModerationStatusEnum('moderation_status')
      .notNull()
      .default('visible'),
    moderationReason: text('moderation_reason'),
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
