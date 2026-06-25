import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import type { DomainEventEnvelope } from '@uitfood/contracts';
import { inboxMessages } from '../schema/inbox.schema';

@Injectable()
export class InboxConsumer {
  private readonly logger = new Logger(InboxConsumer.name);

  constructor(@Inject(DB_CONNECTION) private readonly db: NodePgDatabase) {}

  async consume(
    consumer: string,
    envelope: DomainEventEnvelope,
    handler: () => Promise<void>,
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
        this.logger.debug(
          `Inbox skip duplicate consumer=${consumer} eventId=${envelope.eventId}`,
        );
        return;
      }

      await handler();

      await tx
        .update(inboxMessages)
        .set({ processedAt: new Date() })
        .where(
          sql`${inboxMessages.consumer} = ${consumer} AND ${inboxMessages.eventId} = ${envelope.eventId}`,
        );
    });
  }
}
