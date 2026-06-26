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

export const reviewModerationStatusEnum = pgEnum('review_moderation_status', [
  'visible',
  'flagged',
  'hidden',
]);

export type ReviewModerationStatus =
  (typeof reviewModerationStatusEnum.enumValues)[number];

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id').notNull(),
    customerId: uuid('customer_id').notNull(),
    restaurantId: uuid('restaurant_id').notNull(),
    stars: smallint('stars').notNull(),
    comment: text('comment'),
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
    check('reviews_stars_check', sql`${table.stars} BETWEEN 1 AND 5`),
  ],
);

export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
