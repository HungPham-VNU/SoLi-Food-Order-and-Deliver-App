import { Inject, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { and, asc, eq, isNull, lte } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import type { DomainEventEnvelope } from '@uitfood/contracts';
import { outboxEvents, type OutboxEvent } from '../schema/outbox.schema';
import { RabbitMqPublisher } from '../rabbitmq/rabbitmq.publisher';

const BATCH_SIZE = 50;
const POLL_INTERVAL_MS = 1_000;
const MAX_BACKOFF_MS = 5 * 60_000;

/**
 * OutboxRelayService — drains the outbox to RabbitMQ.
 *
 * Each tick:
 *  1. Claims a batch of due, unpublished rows with `FOR UPDATE SKIP LOCKED`
 *     inside one transaction. SKIP LOCKED lets multiple API replicas relay
 *     concurrently without publishing the same row twice.
 *  2. Publishes each via the confirm-backed RabbitMqPublisher (awaits the
 *     broker confirm).
 *  3. On confirm → sets `published_at`. On failure → increments attempt count
 *     and schedules an exponential backoff; the row stays unpublished and is
 *     retried on a later tick.
 *
 * Publishing happens while the rows are locked; the batch is small and the
 * publish has a bounded confirm timeout, so lock duration stays short. If the
 * broker is down, the whole batch fails fast and rows remain for later — the
 * business write is never blocked.
 */
@Injectable()
export class OutboxRelayService {
  private readonly logger = new Logger(OutboxRelayService.name);
  private running = false;

  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase,
    private readonly publisher: RabbitMqPublisher,
  ) {}

  @Interval(POLL_INTERVAL_MS)
  async tick(): Promise<void> {
    // Never overlap ticks within a single process.
    if (this.running) return;
    this.running = true;
    try {
      // Keep draining while full batches come back (catch-up after an outage).
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

  /** Claims and publishes one batch. Returns the number of rows handled. */
  private async drainBatch(): Promise<number> {
    return this.db.transaction(async (tx) => {
      // FOR UPDATE SKIP LOCKED lets multiple replicas relay concurrently without
      // grabbing the same rows. The query builder maps columns to camelCase
      // (a raw SELECT * would return snake_case and break row.attemptCount etc.).
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
