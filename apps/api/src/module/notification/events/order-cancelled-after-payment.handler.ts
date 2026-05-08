import { Injectable, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { OrderCancelledAfterPaymentEvent } from '@/shared/events/order-cancelled-after-payment.event';
import { NotificationService } from '../services/notification.service';

/**
 * OrderCancelledAfterPaymentNotificationHandler
 *
 * Listens for OrderCancelledAfterPaymentEvent and persists two notifications:
 *  1. Customer — 'order_cancelled': the order has been cancelled
 *  2. Customer — 'refund_initiated': a refund is being processed
 *
 * This event fires on T-05 (PAID → CANCELLED) and T-07 (CONFIRMED → CANCELLED
 * for VNPay orders). Both paths require the same customer notifications.
 *
 * Idempotency for order_cancelled:
 *   OrderStatusChangedNotificationHandler also handles paid→cancelled (T-05)
 *   and confirmed→cancelled (T-07) — both using sourceId = orderId. This
 *   handler uses the SAME sourceId = orderId for order_cancelled, so the
 *   idempotency key is identical. The DB UNIQUE constraint (ON CONFLICT DO
 *   NOTHING) guarantees only one row is persisted regardless of which handler
 *   wins the race. The refund_initiated notification is unique to this handler.
 *
 * Note: Multiple handlers for the same event is valid NestJS CQRS
 * behaviour (fan-out on the in-process EventBus).
 *
 * Phase: N-1 — Foundation (persists to DB only, no delivery)
 */
@Injectable()
@EventsHandler(OrderCancelledAfterPaymentEvent)
export class OrderCancelledAfterPaymentNotificationHandler
  implements IEventHandler<OrderCancelledAfterPaymentEvent>
{
  private readonly logger = new Logger(
    OrderCancelledAfterPaymentNotificationHandler.name,
  );

  constructor(private readonly notificationService: NotificationService) {}

  async handle(event: OrderCancelledAfterPaymentEvent): Promise<void> {
    this.logger.log(
      `OrderCancelledAfterPaymentEvent received: orderId=${event.orderId} customerId=${event.customerId} paidAmount=${event.paidAmount} cancelledByRole=${event.cancelledByRole}`,
    );

    try {
      await this.processNotifications(event);
    } catch (err) {
      // Never rethrow from an event handler.
      this.logger.error(
        `OrderCancelledAfterPaymentNotificationHandler failed for orderId=${event.orderId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  private async processNotifications(
    event: OrderCancelledAfterPaymentEvent,
  ): Promise<void> {
    const templateData: Record<string, string> = {
      orderId: event.orderId,
      paidAmount: String(event.paidAmount),
    };

    // 1. Cancellation notification
    // Uses sourceId = orderId (same as OrderStatusChangedNotificationHandler)
    // so the idempotency key is shared — only one row is ever persisted.
    await this.notificationService.sendFromEvent({
      type: 'order_cancelled',
      recipientId: event.customerId,
      recipientRole: 'customer',
      sourceId: event.orderId,
      templateData,
      channels: ['in_app', 'push', 'email'],
      orderId: event.orderId,
    });

    // 2. Refund initiated notification
    await this.notificationService.sendFromEvent({
      type: 'refund_initiated',
      recipientId: event.customerId,
      recipientRole: 'customer',
      sourceId: event.orderId,
      templateData,
      channels: ['in_app', 'email'],
      orderId: event.orderId,
    });
  }
}
