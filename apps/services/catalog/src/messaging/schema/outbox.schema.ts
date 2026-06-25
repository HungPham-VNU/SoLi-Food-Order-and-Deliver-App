import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import type { DomainEventEnvelope } from '@uitfood/contracts';

/**
 * outbox_events — Catalog's transactional outbox.
 *
 * A row is inserted IN THE SAME LOCAL TRANSACTION as the catalog write that
 * produced it (restaurant/menu/zone change). The outbox relay later publishes
 * each row to RabbitMQ and sets `published_at` only after a publisher confirm.
 */
export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id').notNull().unique(),
    eventType: text('event_type').notNull(),
    eventVersion: integer('event_version').notNull(),
    aggregateId: uuid('aggregate_id').notNull(),
    aggregateVersion: integer('aggregate_version').notNull().default(0),
    envelope: jsonb('envelope').$type<DomainEventEnvelope>().notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    attemptCount: integer('attempt_count').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_outbox_due').on(t.publishedAt, t.nextAttemptAt),
    index('idx_outbox_aggregate').on(t.aggregateId, t.aggregateVersion),
  ],
);

export type OutboxEvent = typeof outboxEvents.$inferSelect;
export type NewOutboxEvent = typeof outboxEvents.$inferInsert;
