/**
 * Drizzle schema barrel for the Ordering database — the tables owned by the
 * Ordering bounded context. drizzle-kit reads the domain schema files directly
 * (see drizzle.config.ts); this barrel is what the Nest `drizzle(pool, { schema })`
 * client uses for typed relational queries.
 *
 * Carts are NOT here — they live in Redis (no `carts` table by design).
 */
export * from '@/ordering/order/order.schema';
export * from '@/ordering/common/app-settings.schema';
export * from '@/ordering/acl/schemas/restaurant-snapshot.schema';
export * from '@/ordering/acl/schemas/menu-item-snapshot.schema';
export * from '@/ordering/acl/schemas/delivery-zone-snapshot.schema';
export * from '@/messaging/schema/outbox.schema';
export * from '@/messaging/schema/inbox.schema';
