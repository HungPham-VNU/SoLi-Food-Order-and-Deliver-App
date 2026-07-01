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
 * outbox_events — transactional outbox.
 *
 * A row is inserted IN THE SAME LOCAL TRANSACTION as the business write that
 * produced the event. The outbox relay later publishes each row to RabbitMQ and
 * sets `published_at` only after a publisher confirm. This closes the
 * post-commit "EventBus.publish lost on crash" gap (migration plan §2.3, §5.3).
 *
 * The full wire `envelope` is stored verbatim so the relay forwards exactly what
 * was recorded; the denormalised columns exist for indexing, routing, and
 * ordering without re-parsing the JSON.
 */
export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Unique business id of the event — idempotency key on the consumer side.
    eventId: uuid('event_id').notNull().unique(),

    // Routing key, e.g. 'review.submitted.v1'.
    eventType: text('event_type').notNull(),
    eventVersion: integer('event_version').notNull(),

    aggregateId: uuid('aggregate_id').notNull(),
    aggregateVersion: integer('aggregate_version').notNull().default(0),

    // The complete envelope (metadata + payload) published as-is.
    envelope: jsonb('envelope').$type<DomainEventEnvelope>().notNull(),

    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Null until a publisher confirm is received. Non-null = delivered to broker.
    publishedAt: timestamp('published_at', { withTimezone: true }),

    // Relay bookkeeping for retries/backoff.
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
    // The relay scans for due, unpublished rows. (Make this a partial index
    // `WHERE published_at IS NULL` in the migration for maximum efficiency.)
    index('idx_outbox_due').on(t.publishedAt, t.nextAttemptAt),
    // Ordered drain within an aggregate.
    index('idx_outbox_aggregate').on(t.aggregateId, t.aggregateVersion),
  ],
);

export type OutboxEvent = typeof outboxEvents.$inferSelect;
export type NewOutboxEvent = typeof outboxEvents.$inferInsert;
