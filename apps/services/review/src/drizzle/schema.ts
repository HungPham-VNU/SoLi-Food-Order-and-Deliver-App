/**
 * Drizzle schema barrel for the Review database. drizzle-kit reads this file
 * to generate migrations for only the service-owned tables.
 */
export * from '../review/domain/review.schema';
export * from '../messaging/schema/outbox.schema';
