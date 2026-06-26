import { Inject, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { and, asc, eq, isNull, lte } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { REVIEW_DATABASE } from '@/drizzle/database.constants';
import type { DomainEventEnvelope } from '@uitfood/contracts';
import { outboxEvents, type OutboxEvent } from '../schema/outbox.schema';
import { RabbitMqPublisher } from '../rabbitmq/rabbitmq.publisher';

const BATCH_SIZE = 50;
const POLL_INTERVAL_MS = 1_000;
const MAX_BACKOFF_MS = 5 * 60_000;

@Injectable()
export class OutboxRelayService {
  private readonly logger = new Logger(OutboxRelayService.name);
  private running = false;

  constructor(
    @Inject(REVIEW_DATABASE) private readonly db: NodePgDatabase,
    private readonly publisher: RabbitMqPublisher,
  ) {}

  @Interval(POLL_INTERVAL_MS)
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      let processed: number;
      do {
        processed = await this.drainBatch();
      } while (processed === BATCH_SIZE);
    } catch (err) {
      this.logger.error(
        `Outbox relay tick failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
    } finally {
      this.running = false;
    }
  }

  private async drainBatch(): Promise<number> {
    return this.db.transaction(async (tx) => {
      const batch = await tx
        .select()
        .from(outboxEvents)
        .where(
          and(
            isNull(outboxEvents.publishedAt),
            lte(outboxEvents.nextAttemptAt, new Date()),
          ),
        )
        .orderBy(asc(outboxEvents.occurredAt))
        .limit(BATCH_SIZE)
        .for('update', { skipLocked: true });

      for (const row of batch) {
        await this.publishRow(tx, row);
      }
      return batch.length;
    });
  }

  private async publishRow(
    tx: Parameters<Parameters<NodePgDatabase['transaction']>[0]>[0],
    row: OutboxEvent,
  ): Promise<void> {
    try {
      await this.publisher.publish(row.envelope as DomainEventEnvelope);
      await tx
        .update(outboxEvents)
        .set({ publishedAt: new Date(), lastError: null })
        .where(eq(outboxEvents.id, row.id));
    } catch (err) {
      const attempt = row.attemptCount + 1;
      const backoffMs = Math.min(
        MAX_BACKOFF_MS,
        2 ** Math.min(attempt, 10) * 1_000,
      );
      await tx
        .update(outboxEvents)
        .set({
          attemptCount: attempt,
          nextAttemptAt: new Date(Date.now() + backoffMs),
          lastError: (err as Error).message.slice(0, 1_000),
        })
        .where(eq(outboxEvents.id, row.id));

      this.logger.warn(
        `Outbox publish failed for eventId=${row.eventId} ` +
          `(attempt ${attempt}, retry in ${backoffMs}ms): ${(err as Error).message}`,
      );
    }
  }
}
