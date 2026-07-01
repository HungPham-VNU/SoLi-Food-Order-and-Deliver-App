import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EVENT_NAMES,
  orderCancelledAfterPaymentV1Payload,
  type DomainEventEnvelope,
} from '@uitfood/contracts';
import type { Env } from '@/config/env.schema';
import { OrderCancelledAfterPaymentHandler } from '@/payment/events/order-cancelled-after-payment.handler';
import { OrderCancelledAfterPaymentEvent } from '@/payment/events/order-cancelled-after-payment.event';
import { RabbitMqConsumer } from '../rabbitmq/rabbitmq.consumer';
import { InboxConsumer } from '../inbox/inbox.consumer';

@Injectable()
export class OrderCancelledAfterPaymentConsumer implements OnApplicationBootstrap {
  static readonly CONSUMER = 'payment.order-cancelled-after-payment';
  static readonly QUEUE = 'payment.order-cancelled-after-payment.v1';

  private readonly logger = new Logger(OrderCancelledAfterPaymentConsumer.name);

  constructor(
    private readonly consumer: RabbitMqConsumer,
    private readonly inbox: InboxConsumer,
    private readonly handler: OrderCancelledAfterPaymentHandler,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onApplicationBootstrap(): void {
    this.consumer.subscribe({
      queue: OrderCancelledAfterPaymentConsumer.QUEUE,
      routingKeys: [EVENT_NAMES.OrderingOrderCancelledAfterPayment],
      prefetch: this.config.get('RABBITMQ_PREFETCH', { infer: true }),
      handler: (envelope) => this.handle(envelope),
    });
  }

  private async handle(envelope: DomainEventEnvelope): Promise<void> {
    await this.inbox.consume(
      OrderCancelledAfterPaymentConsumer.CONSUMER,
      envelope,
      async () => {
        const event = orderCancelledAfterPaymentV1Payload.parse(
          envelope.payload,
        );
        this.logger.log(
          `Refund event consumed for orderId=${event.orderId} eventId=${envelope.eventId}`,
        );
        await this.handler.handle(
          new OrderCancelledAfterPaymentEvent(
            event.orderId,
            event.customerId,
            event.paymentMethod,
            event.paidAmount,
            new Date(event.cancelledAt),
            event.cancelledByRole,
          ),
        );
      },
    );
  }
}
