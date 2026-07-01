import { Inject, Injectable } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import type { DomainEventEnvelope } from '@uitfood/contracts';
import { PAYMENT_DATABASE } from '@/drizzle/database.constants';
import type { PaymentDatabase } from '@/drizzle/database.module';
import { inboxMessages } from '../schema/inbox.schema';

@Injectable()
export class InboxConsumer {
  constructor(@Inject(PAYMENT_DATABASE) private readonly db: PaymentDatabase) {}

  async consume(
    consumer: string,
    envelope: DomainEventEnvelope,
    handler: () => Promise<void>,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: inboxMessages.id })
        .from(inboxMessages)
        .where(
          and(
            eq(inboxMessages.consumer, consumer),
            eq(inboxMessages.eventId, envelope.eventId),
          ),
        )
        .limit(1)
        .for('update');

      if (existing) return;

      await handler();
      await tx.insert(inboxMessages).values({
        consumer,
        eventId: envelope.eventId,
        eventType: envelope.eventType,
      });
    });
  }
}
