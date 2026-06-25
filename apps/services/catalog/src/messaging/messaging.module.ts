import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/drizzle/database.module';
import { RabbitMqPublisher } from './rabbitmq/rabbitmq.publisher';
import { RabbitMqConsumer } from './rabbitmq/rabbitmq.consumer';
import { OutboxRelayService } from './outbox/outbox-relay.service';
import { InboxConsumer } from './inbox/inbox.consumer';

/**
 * MessagingModule — Catalog's durable-integration runtime.
 *
 *  - OutboxRelayService drains `outbox_events` to RabbitMQ (publisher confirms,
 *    FOR UPDATE SKIP LOCKED). Requires ScheduleModule (registered in AppModule).
 *  - RabbitMqPublisher: confirm-channel publisher to the topic exchange.
 *  - RabbitMqConsumer + InboxConsumer: inbound projections (e.g.
 *    `review.submitted.v1` → restaurant rating), wired by the domain consumer.
 */
@Module({
  imports: [DatabaseModule],
  providers: [
    OutboxRelayService,
    RabbitMqPublisher,
    RabbitMqConsumer,
    InboxConsumer,
  ],
  exports: [RabbitMqPublisher, RabbitMqConsumer, InboxConsumer],
})
export class MessagingModule {}
