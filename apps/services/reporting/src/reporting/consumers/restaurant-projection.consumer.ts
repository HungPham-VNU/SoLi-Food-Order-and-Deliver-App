import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
  EVENT_NAMES,
  catalogRestaurantChangedV1Payload,
  type DomainEventEnvelope,
} from '@uitfood/contracts';
import { RabbitMqConsumer } from '@/messaging/rabbitmq/rabbitmq.consumer';
import { InboxConsumer } from '@/messaging/inbox/inbox.consumer';
import { reportingRestaurantFacts } from '@/reporting/projections/schema/restaurant-fact.schema';

/**
 * Maintains the restaurant-status fact projection from
 * `catalog.restaurant.changed.v1` for online/offline/pending counts.
 */
@Injectable()
export class RestaurantProjectionConsumer implements OnApplicationBootstrap {
  static readonly CONSUMER = 'reporting.restaurant-projection';
  static readonly QUEUE = 'reporting.catalog-events.v1';
  private readonly logger = new Logger(RestaurantProjectionConsumer.name);

  constructor(
    private readonly consumer: RabbitMqConsumer,
    private readonly inbox: InboxConsumer,
  ) {}

  onApplicationBootstrap(): void {
    this.consumer.subscribe({
      queue: RestaurantProjectionConsumer.QUEUE,
      routingKeys: [EVENT_NAMES.CatalogRestaurantChanged],
      handler: (envelope) => this.handle(envelope),
    });
  }

  private async handle(envelope: DomainEventEnvelope): Promise<void> {
    const p = catalogRestaurantChangedV1Payload.parse(envelope.payload);
    await this.inbox.consume(
      RestaurantProjectionConsumer.CONSUMER,
      envelope,
      async (tx) => {
        await tx
          .insert(reportingRestaurantFacts)
          .values({
            restaurantId: p.restaurantId,
            name: p.name,
            isApproved: p.isApproved,
            isOpen: p.isOpen,
          })
          .onConflictDoUpdate({
            target: reportingRestaurantFacts.restaurantId,
            set: { name: p.name, isApproved: p.isApproved, isOpen: p.isOpen },
          });
      },
    );
  }
}
