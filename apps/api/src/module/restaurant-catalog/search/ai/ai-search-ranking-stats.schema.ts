import { index, integer, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

export const aiSearchItemRankingStats = pgTable(
  'ai_search_item_ranking_stats',
  {
    menuItemId: uuid('menu_item_id').primaryKey(),
    restaurantId: uuid('restaurant_id').notNull(),
    deliveredOrderCount30d: integer('delivered_order_count_30d')
      .notNull()
      .default(0),
    deliveredOrderCount90d: integer('delivered_order_count_90d')
      .notNull()
      .default(0),
    orderedQuantity30d: integer('ordered_quantity_30d').notNull().default(0),
    orderedQuantity90d: integer('ordered_quantity_90d').notNull().default(0),
    lastOrderedAt: timestamp('last_ordered_at'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('ai_search_item_ranking_stats_restaurant_idx').on(table.restaurantId),
    index('ai_search_item_ranking_stats_updated_idx').on(table.updatedAt),
  ],
);

export const aiSearchRestaurantRankingStats = pgTable(
  'ai_search_restaurant_ranking_stats',
  {
    restaurantId: uuid('restaurant_id').primaryKey(),
    deliveredOrderCount30d: integer('delivered_order_count_30d')
      .notNull()
      .default(0),
    deliveredOrderCount90d: integer('delivered_order_count_90d')
      .notNull()
      .default(0),
    orderedQuantity30d: integer('ordered_quantity_30d').notNull().default(0),
    orderedQuantity90d: integer('ordered_quantity_90d').notNull().default(0),
    lastOrderedAt: timestamp('last_ordered_at'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('ai_search_restaurant_ranking_stats_updated_idx').on(table.updatedAt),
  ],
);

export type AiSearchItemRankingStats =
  typeof aiSearchItemRankingStats.$inferSelect;
export type AiSearchRestaurantRankingStats =
  typeof aiSearchRestaurantRankingStats.$inferSelect;
