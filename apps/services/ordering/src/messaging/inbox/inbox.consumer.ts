import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ORDERING_DATABASE } from '@/drizzle/database.constants';
import type { DomainEventEnvelope } from '@uitfood/contracts';
import { inboxMessages } from '../schema/inbox.schema';
import type { DrizzleExecutor } from '../drizzle-executor';

/**
 * InboxConsumer — exactly-once-in-effect application of an event.
 *
 * `consume()` runs the dedupe insert and the business `handler` in ONE local
 * transaction:
 *
 *   1. Insert (consumer, eventId) — ON CONFLICT DO NOTHING.
 *      • 0 rows affected  → already processed → skip (idempotent no-op).
 *      • 1 row affected   → first time → run the handler, then mark processed.
 *   2. The handler receives the SAME `tx`, so its writes commit atomically with
 *      the dedupe record. A crash before commit rolls back both, and redelivery
 *      re-runs cleanly.
 *
 * This is what replaces the cross-context `UnitOfWorkContext`: instead of one
 * Postgres transaction spanning Review + Ordering + Catalog, each consumer
 * applies its own change idempotently in its own transaction, driven by the
 * event. After the database split these transactions live in separate databases;
 * today (one DB) the behaviour is identical and fully testable.
 */
@Injectable()
export class InboxConsumer {
  private readonly logger = new Logger(InboxConsumer.name);

  constructor(@Inject(ORDERING_DATABASE) private readonly db: NodePgDatabase) {}

  async consume(
    consumer: string,
    envelope: DomainEventEnvelope,
    handler: (tx: DrizzleExecutor) => Promise<void>,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(inboxMessages)
        .values({
          consumer,
          eventId: envelope.eventId,
          eventType: envelope.eventType,
        })
        .onConflictDoNothing({
          target: [inboxMessages.consumer, inboxMessages.eventId],
        })
        .returning({ id: inboxMessages.id });

      if (inserted.length === 0) {
        // Duplicate delivery — already applied. Idempotent skip.
        this.logger.debug(
          `Inbox skip (duplicate) consumer=${consumer} eventId=${envelope.eventId}`,
        );
        return;
      }

      await handler(tx);

      await tx
        .update(inboxMessages)
        .set({ processedAt: new Date() })
        .where(
          sql`${inboxMessages.consumer} = ${consumer} AND ${inboxMessages.eventId} = ${envelope.eventId}`,
        );
    });
  }
}
