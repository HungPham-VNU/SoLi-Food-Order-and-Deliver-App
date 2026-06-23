import { randomUUID } from 'crypto';
import { z } from 'zod';

/**
 * The canonical wire envelope for every domain event (migration plan §5.1).
 *
 * The envelope is the contract — NOT the producer's TypeScript class. It is
 * serialised to JSON, carried over RabbitMQ, and validated by every consumer.
 * `payload` is the only event-specific part; everything else is metadata used
 * for routing, ordering, idempotency, and tracing.
 */
export interface DomainEventEnvelope<TPayload = unknown> {
  /** Globally unique id for THIS event. Idempotency key for consumers. */
  eventId: string;
  /** Versioned routing key, e.g. 'review.submitted.v1'. */
  eventType: string;
  /** Schema version of `payload`. Bump (and overlap) — never break in place. */
  eventVersion: number;
  /** Aggregate this event belongs to (e.g. the order/review/restaurant id). */
  aggregateId: string;
  /** Monotonic per-aggregate version for ordering/staleness checks. */
  aggregateVersion: number;
  /** ISO-8601 instant the event occurred. */
  occurredAt: string;
  /** Producing service, e.g. 'review-service' (or 'monolith' during migration). */
  producer: string;
  /** Correlates all events/requests in one logical operation. */
  correlationId: string;
  /** The event/command that caused this one, if any. */
  causationId: string | null;
  /** W3C trace context for distributed tracing. */
  traceparent: string | null;
  /** Event-specific data. Must be self-contained (no consumer DB lookups). */
  payload: TPayload;
}

/** Runtime validator for the envelope shape (payload validated separately). */
export const envelopeSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string().min(1),
  eventVersion: z.number().int().positive(),
  aggregateId: z.string().min(1),
  aggregateVersion: z.number().int().nonnegative(),
  occurredAt: z.string(),
  producer: z.string().min(1),
  correlationId: z.string().min(1),
  causationId: z.string().nullable(),
  traceparent: z.string().nullable(),
  payload: z.unknown(),
});

export interface CreateEnvelopeInput<TPayload> {
  eventType: string;
  eventVersion: number;
  aggregateId: string;
  aggregateVersion: number;
  producer: string;
  payload: TPayload;
  correlationId?: string;
  causationId?: string | null;
  traceparent?: string | null;
  occurredAt?: Date;
  eventId?: string;
}

/**
 * Builds a fully-populated envelope, defaulting id/correlation/timestamps.
 * Pass an explicit `correlationId`/`causationId`/`traceparent` to propagate an
 * existing operation's context.
 */
export function createEnvelope<TPayload>(
  input: CreateEnvelopeInput<TPayload>,
): DomainEventEnvelope<TPayload> {
  return {
    eventId: input.eventId ?? randomUUID(),
    eventType: input.eventType,
    eventVersion: input.eventVersion,
    aggregateId: input.aggregateId,
    aggregateVersion: input.aggregateVersion,
    occurredAt: (input.occurredAt ?? new Date()).toISOString(),
    producer: input.producer,
    correlationId: input.correlationId ?? randomUUID(),
    causationId: input.causationId ?? null,
    traceparent: input.traceparent ?? null,
    payload: input.payload,
  };
}
