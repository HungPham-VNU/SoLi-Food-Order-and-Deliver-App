/**
 * Catalog database schema barrel — the single owner of all Catalog tables.
 *
 * Cross-context references (e.g. owner_id) are plain UUIDs, never foreign keys
 * to another service's tables. Ordering stays independent through events, not
 * shared schema.
 */

// Restaurants + delivery zones (incl. pgvector embedding columns)
export * from '../restaurant/restaurant.schema';

// Menus: categories, items (pgvector), modifier groups + options
export * from '../menu/menu.schema';

// Nutrition: foods, localizations, ingredient aliases, analysis sessions,
// analysis ingredients, per-menu-item nutrition
export * from '../nutrition/domain/nutrition.schema';

// Dietary / lifestyle tags
export * from '../dietary-tags/domain/dietary-tag.schema';

// AI search: embedding jobs + ranking stats
export * from '../search/indexing/ai-search-embedding-job.schema';
export * from '../search/ai/ai-search-ranking-stats.schema';
export * from '../search/ai/delivered-order-snapshot.schema';

// Messaging infrastructure (per-service transactional outbox + inbox)
export * from '../messaging/schema/outbox.schema';
export * from '../messaging/schema/inbox.schema';
