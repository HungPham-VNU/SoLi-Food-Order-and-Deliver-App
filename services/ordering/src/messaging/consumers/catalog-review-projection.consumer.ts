import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import {
  EVENT_NAMES,
  reviewSubmittedV1Payload,
  type DomainEventEnvelope,
} from '@uitfood/contracts';
import {
  RESTAURANT_ACCESS_PORT,
  type IRestaurantAccessPort,
} from '@/shared/ports/restaurant-access.port';
import { RabbitMqConsumer } from '../rabbitmq/rabbitmq.consumer';
import { InboxConsumer } from '../inbox/inbox.consumer';

/**
 * Catalog's rating projection — replaces the in-transaction
 * `restaurantAccess.incrementRating(...)` call that the old SubmitReviewHandler
 * made inside the cross-context UnitOfWork.
 *
 * Now: consume `review.submitted.v1`, then apply the rating increment
 * idempotently in Catalog's own transaction via the inbox. Eventually consistent
 * with the authoritative review; the inbox guarantees one effect per event.
 *
 * (Lives under messaging/ during the bridge phase; moves into the Catalog
 * service when Catalog is extracted.)
 */
@Injectable()
export class CatalogReviewProjectionConsumer implements OnApplicationBootstrap {
  static readonly CONSUMER = 'catalog.review-projection';
  static readonly QUEUE = 'catalog.review-events.v1';
  private readonly logger = new Logger(CatalogReviewProjectionConsumer.name);

  constructor(
    private readonly consumer: RabbitMqConsumer,
    private readonly inbox: InboxConsumer,
    @Inject(RESTAURANT_ACCESS_PORT)
    private readonly restaurantAccess: IRestaurantAccessPort,
  ) {}

  onApplicationBootstrap(): void {
    this.consumer.subscribe({
      queue: CatalogReviewProjectionConsumer.QUEUE,
      routingKeys: [EVENT_NAMES.ReviewSubmitted],
      handler: (envelope) => this.handle(envelope),
    });
  }

  private async handle(envelope: DomainEventEnvelope): Promise<void> {
    const payload = reviewSubmittedV1Payload.parse(envelope.payload);

    await this.inbox.consume(
      CatalogReviewProjectionConsumer.CONSUMER,
      envelope,
      async (tx) => {
        await this.restaurantAccess.incrementRating(
          payload.restaurantId,
          payload.stars,
          { transaction: tx },
        );
      },
    );
  }
}
