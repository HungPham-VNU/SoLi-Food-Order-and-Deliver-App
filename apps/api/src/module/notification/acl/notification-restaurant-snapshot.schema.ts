import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// notification_restaurant_snapshots
//
// ACL projection — local read-model of restaurant data for the Notification BC.
// Populated by NotificationRestaurantSnapshotProjector (RestaurantUpdatedEvent).
//
// Purpose:
//   OrderPlacedEvent and OrderStatusChangedEvent carry restaurantId, but the
//   Notification BC needs the restaurant owner's userId to route the WebSocket
//   notification to the correct user room. The Notification BC must NOT query
//   the RestaurantCatalog BC's tables or the Ordering BC's snapshot table.
//   The ACL projection is the DDD-correct solution.
//
// Only restaurantId, ownerId, and name are stored here — the Notification BC
// only needs to:
//   1. Resolve restaurantId → ownerId (for WebSocket room `user:{ownerId}`)
//   2. Use restaurantName in notification template data (fallback to orderId)
//
// restaurantId is the upstream entity ID. NOT a FK (D-P7).
// Idempotent upsert: ON CONFLICT (restaurant_id) DO UPDATE.
// ---------------------------------------------------------------------------
export const notificationRestaurantSnapshots = pgTable(
  'notification_restaurant_snapshots',
  {
    // Upstream restaurant entity ID — used as PK since one row per restaurant.
    restaurantId: uuid('restaurant_id').primaryKey(),

    // The restaurant owner's IAM userId — used to route notifications.
    ownerId: uuid('owner_id').notNull(),

    // Restaurant display name for notification template data.
    // e.g. "Phở Bắc" in "Your order from Phở Bắc has been confirmed."
    name: text('name').notNull(),

    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export type NotificationRestaurantSnapshot =
  typeof notificationRestaurantSnapshots.$inferSelect;
export type NewNotificationRestaurantSnapshot =
  typeof notificationRestaurantSnapshots.$inferInsert;
