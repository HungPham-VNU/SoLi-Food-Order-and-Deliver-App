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
 * Catalog rating projection — consumes `review.submitted.v1` and increments the
 * restaurant's rating counters idempotently (inbox dedupe + same-tx write).
 * This inbound event projection keeps Catalog's denormalized rating in sync
 * with the Review service.
 */
@Injectable()
export class ReviewRatingConsumer implements OnApplicationBootstrap {
  static readonly CONSUMER = 'catalog.review-projection';
  static readonly QUEUE = 'catalog.review-events.v1';
  private readonly logger = new Logger(ReviewRatingConsumer.name);

  constructor(
    private readonly consumer: RabbitMqConsumer,
    private readonly inbox: InboxConsumer,
    @Inject(RESTAURANT_ACCESS_PORT)
    private readonly restaurantAccess: IRestaurantAccessPort,
  ) {}

  onApplicationBootstrap(): void {
    this.consumer.subscribe({
      queue: ReviewRatingConsumer.QUEUE,
      routingKeys: [EVENT_NAMES.ReviewSubmitted],
      handler: (envelope) => this.handle(envelope),
    });
  }

  private async handle(envelope: DomainEventEnvelope): Promise<void> {
    const payload = reviewSubmittedV1Payload.parse(envelope.payload);
    await this.inbox.consume(
      ReviewRatingConsumer.CONSUMER,
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
