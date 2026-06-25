import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

export const inboxMessages = pgTable(
  'inbox_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    consumer: text('consumer').notNull(),
    eventId: uuid('event_id').notNull(),
    eventType: text('event_type').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastError: text('last_error'),
  },
  (t) => [unique('inbox_consumer_event_unique').on(t.consumer, t.eventId)],
);

export type InboxMessage = typeof inboxMessages.$inferSelect;
export type NewInboxMessage = typeof inboxMessages.$inferInsert;
