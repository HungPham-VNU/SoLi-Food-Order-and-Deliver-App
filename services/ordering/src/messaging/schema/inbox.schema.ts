import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

/**
 * inbox_messages — consumer-side deduplication.
 *
 * Before applying an event, a consumer inserts (consumer, event_id). The UNIQUE
 * constraint makes a duplicate delivery a no-op: the insert conflicts, the
 * handler is skipped, and the message is acknowledged exactly once in business
 * terms. The insert and the business change commit in ONE local transaction, so
 * "applied" and "recorded as applied" can never diverge (migration plan §5.3).
 *
 * `consumer` namespaces the dedupe so the same event delivered to two different
 * consumers (e.g. catalog-rating vs ordering-marker) is processed by each.
 */
export const inboxMessages = pgTable(
  'inbox_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Logical consumer name, e.g. 'catalog.review-projection'.
    consumer: text('consumer').notNull(),

    // The envelope's eventId.
    eventId: uuid('event_id').notNull(),
    eventType: text('event_type').notNull(),

    receivedAt: timestamp('received_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastError: text('last_error'),
  },
  (t) => [
    // One (consumer, event) pair processed at most once.
    unique('inbox_consumer_event_unique').on(t.consumer, t.eventId),
  ],
);

export type InboxMessage = typeof inboxMessages.$inferSelect;
export type NewInboxMessage = typeof inboxMessages.$inferInsert;
