import { Injectable } from '@nestjs/common';
import type { DomainEventEnvelope } from '@uitfood/contracts';
import { outboxEvents } from '../schema/outbox.schema';
import type { DrizzleExecutor } from '../drizzle-executor';

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
