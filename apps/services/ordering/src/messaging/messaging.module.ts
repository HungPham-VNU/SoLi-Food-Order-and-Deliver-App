import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { DatabaseModule } from '@/drizzle/database.module';
import { OrderingContractsModule } from '@/ordering/ordering-contracts.module';
import { RabbitMqPublisher } from './rabbitmq/rabbitmq.publisher';
import { RabbitMqConsumer } from './rabbitmq/rabbitmq.consumer';
import { OutboxRelayService } from './outbox/outbox-relay.service';
import { InboxConsumer } from './inbox/inbox.consumer';
import { OrderingReviewMarkerConsumer } from './consumers/ordering-review-marker.consumer';
import { EventBusBridgeConsumer } from './consumers/eventbus-bridge.consumer';

/**
 * MessagingModule — durable-integration infrastructure for the Ordering service.
 *
 * Provides the transactional outbox relay, the RabbitMQ publisher/consumer, the
 * inbox deduplicator, and the two inbound consumers Ordering needs:
 *  - EventBusBridgeConsumer: re-emits `catalog.*.changed.v1` (and payment/review)
 *    durable events as in-process Nest CQRS events so the ACL snapshot projectors
 *    keep Ordering's local restaurant/menu/zone snapshots in sync.
 *  - OrderingReviewMarkerConsumer: marks orders reviewed on `review.submitted.v1`.
 *
 * The consumers self-subscribe on `onApplicationBootstrap` (raw
 * amqp-connection-manager, manual ack + publisher confirms) — no
 * `connectMicroservice` call is required.
 */
@Module({
  imports: [CqrsModule, DatabaseModule, OrderingContractsModule],
  providers: [
    OutboxRelayService,
    RabbitMqPublisher,
    RabbitMqConsumer,
    InboxConsumer,
    OrderingReviewMarkerConsumer,
    EventBusBridgeConsumer,
  ],
})
export class MessagingModule {}
