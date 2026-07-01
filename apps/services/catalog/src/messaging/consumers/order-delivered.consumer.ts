import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
  EVENT_NAMES,
  orderDeliveredV1Payload,
  type DomainEventEnvelope,
} from '@uitfood/contracts';
import { RabbitMqConsumer } from '../rabbitmq/rabbitmq.consumer';
import { InboxConsumer } from '../inbox/inbox.consumer';
import {
  deliveredOrderSnapshots,
  deliveredOrderItemSnapshots,
} from '@/search/ai/delivered-order-snapshot.schema';

/**
 * Catalog delivered-order projection — consumes `ordering.order.delivered.v1`
 * and materialises order + item snapshots into the catalog database.
 *
 * These snapshots power the AI search ranking stats refresh without needing
 * cross-database queries to the ordering service.
 */
@Injectable()
export class OrderDeliveredConsumer implements OnApplicationBootstrap {
  static readonly CONSUMER = 'catalog.order-delivered-projection';
  static readonly QUEUE = 'catalog.order-delivered-events.v1';
  private readonly logger = new Logger(OrderDeliveredConsumer.name);

  constructor(
    private readonly consumer: RabbitMqConsumer,
    private readonly inbox: InboxConsumer,
  ) {}

  onApplicationBootstrap(): void {
    this.consumer.subscribe({
      queue: OrderDeliveredConsumer.QUEUE,
      routingKeys: [EVENT_NAMES.OrderingOrderDelivered],
      handler: (envelope) => this.handle(envelope),
    });
  }

  private async handle(envelope: DomainEventEnvelope): Promise<void> {
    const payload = orderDeliveredV1Payload.parse(envelope.payload);
    await this.inbox.consume(
      OrderDeliveredConsumer.CONSUMER,
      envelope,
      async (tx) => {
        await tx
          .insert(deliveredOrderSnapshots)
          .values({
            orderId: payload.orderId,
            restaurantId: payload.restaurantId,
            deliveredAt: new Date(payload.deliveredAt),
          })
          .onConflictDoNothing({ target: deliveredOrderSnapshots.orderId });

        if (payload.items.length > 0) {
          await tx.insert(deliveredOrderItemSnapshots).values(
            payload.items.map((item) => ({
              orderId: payload.orderId,
              menuItemId: item.menuItemId,
              quantity: item.quantity,
            })),
          );
        }
      },
    );
  }
}
