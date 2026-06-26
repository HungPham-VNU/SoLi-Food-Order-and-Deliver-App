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
  ORDER_ELIGIBILITY_PORT,
  type IOrderEligibilityPort,
} from '@/shared/ports/order-eligibility.port';
import { RabbitMqConsumer } from '../rabbitmq/rabbitmq.consumer';
import { InboxConsumer } from '../inbox/inbox.consumer';

/**
 * Ordering's reviewed-marker projection — replaces the in-transaction
 * `orderEligibilityPort.markReviewed(...)` call from the old cross-context
 * UnitOfWork.
 *
 * Now: consume `review.submitted.v1`, then mark the order reviewed idempotently
 * in Ordering's own transaction via the inbox.
 */
@Injectable()
export class OrderingReviewMarkerConsumer implements OnApplicationBootstrap {
  static readonly CONSUMER = 'ordering.review-marker';
  static readonly QUEUE = 'ordering.review-events.v1';
  private readonly logger = new Logger(OrderingReviewMarkerConsumer.name);

  constructor(
    private readonly consumer: RabbitMqConsumer,
    private readonly inbox: InboxConsumer,
    @Inject(ORDER_ELIGIBILITY_PORT)
    private readonly orderEligibility: IOrderEligibilityPort,
  ) {}

  onApplicationBootstrap(): void {
    this.consumer.subscribe({
      queue: OrderingReviewMarkerConsumer.QUEUE,
      routingKeys: [EVENT_NAMES.ReviewSubmitted],
      handler: (envelope) => this.handle(envelope),
    });
  }

  private async handle(envelope: DomainEventEnvelope): Promise<void> {
    const payload = reviewSubmittedV1Payload.parse(envelope.payload);

    await this.inbox.consume(
      OrderingReviewMarkerConsumer.CONSUMER,
      envelope,
      async (tx) => {
        await this.orderEligibility.markReviewed(payload.orderId, {
          transaction: tx,
        });
      },
    );
  }
}
