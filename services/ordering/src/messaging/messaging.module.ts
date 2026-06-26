import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { DatabaseModule } from '@/drizzle/drizzle.module';
import { OrderingContractsModule } from '@/module/ordering/ordering-contracts.module';
import { CatalogContractsModule } from '@/module/restaurant-catalog/catalog-contracts.module';
import { RabbitMqPublisher } from './rabbitmq/rabbitmq.publisher';
import { RabbitMqConsumer } from './rabbitmq/rabbitmq.consumer';
import { OutboxRelayService } from './outbox/outbox-relay.service';
import { InboxConsumer } from './inbox/inbox.consumer';
import { CatalogReviewProjectionConsumer } from './consumers/catalog-review-projection.consumer';
import { OrderingReviewMarkerConsumer } from './consumers/ordering-review-marker.consumer';
import { EventBusBridgeConsumer } from './consumers/eventbus-bridge.consumer';

/**
 * MessagingModule — Phase 2 durable-integration infrastructure.
 *
 * Provides the transactional outbox (writer + relay), the RabbitMQ
 * publisher/consumer, the inbox deduplicator, and the review projection
 * consumers that replace the dismantled cross-context UnitOfWork.
 *
 * `OutboxWriter` is exported so domain command handlers (e.g. SubmitReviewHandler)
 * can record events inside their own transactions.
 *
 * Wiring note: the app must start a consumer connection. Because we use a raw
 * amqp-connection-manager consumer (for true manual-ack + confirm semantics)
 * rather than a Nest RMQ microservice, the consumers self-subscribe on
 * `onApplicationBootstrap` — no `connectMicroservice` call is required.
 */
@Module({
  imports: [
    CqrsModule,
    DatabaseModule,
    OrderingContractsModule,
    CatalogContractsModule,
  ],
  providers: [
    OutboxRelayService,
    RabbitMqPublisher,
    RabbitMqConsumer,
    InboxConsumer,
    CatalogReviewProjectionConsumer,
    OrderingReviewMarkerConsumer,
    EventBusBridgeConsumer,
  ],
})
export class MessagingModule {}
