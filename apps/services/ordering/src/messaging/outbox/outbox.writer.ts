import { Injectable } from '@nestjs/common';
import type { DomainEventEnvelope } from '@uitfood/contracts';
import { outboxEvents } from '../schema/outbox.schema';
import type { DrizzleExecutor } from '../drizzle-executor';

/**
 * OutboxWriter — records a domain event in the outbox.
 *
 * MUST be called with the SAME transaction (`tx`) as the business write so the
 * two commit atomically. This is the heart of the transactional outbox: if the
 * business row exists, its event exists; if it rolled back, so did the event.
 */
@Injectable()
export class OutboxWriter {
  async write(
    tx: DrizzleExecutor,
    envelope: DomainEventEnvelope,
  ): Promise<void> {
    await tx.insert(outboxEvents).values({
      eventId: envelope.eventId,
      eventType: envelope.eventType,
      eventVersion: envelope.eventVersion,
      aggregateId: envelope.aggregateId,
      aggregateVersion: envelope.aggregateVersion,
      occurredAt: new Date(envelope.occurredAt),
      envelope,
    });
  }
}
