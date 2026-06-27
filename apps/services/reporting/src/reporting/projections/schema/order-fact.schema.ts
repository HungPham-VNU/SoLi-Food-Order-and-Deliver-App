import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

/**
 * reporting_order_facts — one row per order, maintained from Ordering events.
 *
 * Built by the order-projection consumer:
 *  - `ordering.order.placed.v1`        → insert (status='pending', amounts, district)
 *  - `ordering.order-status.changed.v1`→ update status; stamp confirmedAt /
 *    readyAt so prep-time analytics need no order_status_logs self-join.
 *
 * Reporting owns this read-optimized copy fed entirely by events.
 */
export const reportingOrderFacts = pgTable(
  'reporting_order_facts',
  {
    orderId: uuid('order_id').primaryKey(),
    restaurantId: uuid('restaurant_id').notNull(),
    restaurantName: text('restaurant_name').notNull(),
    status: text('status').notNull().default('pending'),
    totalAmount: integer('total_amount').notNull(),
    shippingFee: integer('shipping_fee').notNull().default(0),
    district: text('district'),
    placedAt: timestamp('placed_at', { withTimezone: true }).notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    readyAt: timestamp('ready_at', { withTimezone: true }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index('idx_reporting_order_facts_placed_at').on(t.placedAt),
    index('idx_reporting_order_facts_restaurant').on(t.restaurantId),
    index('idx_reporting_order_facts_status').on(t.status),
  ],
);

export type ReportingOrderFact = typeof reportingOrderFacts.$inferSelect;
export type NewReportingOrderFact = typeof reportingOrderFacts.$inferInsert;
