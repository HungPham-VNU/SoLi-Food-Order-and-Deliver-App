import { pgTable, uuid, integer, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * Materialised snapshot of delivered orders, populated by consuming
 * `ordering.order.delivered.v1` events. Replaces direct cross-database
 * queries against the ordering service's tables.
 */
export const deliveredOrderSnapshots = pgTable(
  'delivered_order_snapshots',
  {
    orderId: uuid('order_id').primaryKey(),
    restaurantId: uuid('restaurant_id').notNull(),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('delivered_order_snapshots_restaurant_idx').on(table.restaurantId),
    index('delivered_order_snapshots_delivered_at_idx').on(table.deliveredAt),
  ],
);

export const deliveredOrderItemSnapshots = pgTable(
  'delivered_order_item_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => deliveredOrderSnapshots.orderId, { onDelete: 'cascade' }),
    menuItemId: uuid('menu_item_id').notNull(),
    quantity: integer('quantity').notNull(),
  },
  (table) => [
    index('delivered_order_item_snapshots_order_idx').on(table.orderId),
    index('delivered_order_item_snapshots_menu_item_idx').on(table.menuItemId),
  ],
);

export type DeliveredOrderSnapshot = typeof deliveredOrderSnapshots.$inferSelect;
export type DeliveredOrderItemSnapshot = typeof deliveredOrderItemSnapshots.$inferSelect;
