import { Injectable, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { PaymentFailedEvent } from '@/shared/events/payment-failed.event';
import { NotificationService } from '../services/notification.service';

/**
 * PaymentFailedNotificationHandler
 *
 * Listens for PaymentFailedEvent and persists a 'payment_failed'
 * notification for the customer.
 *
 * Only VNPay orders emit this event. The event carries reason (the VNPay
 * error code or description) which is included in the notification body
 * so the customer understands why the payment failed.
 *
 * Phase: N-1 — Foundation (persists to DB only, no delivery)
 */
@Injectable()
@EventsHandler(PaymentFailedEvent)
export class PaymentFailedNotificationHandler
  implements IEventHandler<PaymentFailedEvent>
{
  private readonly logger = new Logger(PaymentFailedNotificationHandler.name);

  constructor(private readonly notificationService: NotificationService) {}

  async handle(event: PaymentFailedEvent): Promise<void> {
    this.logger.log(
      `PaymentFailedEvent received: orderId=${event.orderId} customerId=${event.customerId} reason=${event.reason}`,
    );

    try {
      await this.processNotification(event);
    } catch (err) {
      // Never rethrow from an event handler.
      this.logger.error(
        `PaymentFailedNotificationHandler failed for orderId=${event.orderId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  private async processNotification(event: PaymentFailedEvent): Promise<void> {
    await this.notificationService.sendFromEvent({
      type: 'payment_failed',
      recipientId: event.customerId,
      recipientRole: 'customer',
      sourceId: event.orderId,
      templateData: {
        orderId: event.orderId,
        reason: event.reason,
      },
      channels: ['in_app', 'push', 'email'],
      orderId: event.orderId,
    });
  }
}
