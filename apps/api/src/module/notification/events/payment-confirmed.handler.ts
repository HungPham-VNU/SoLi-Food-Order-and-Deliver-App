import { Injectable, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { PaymentConfirmedEvent } from '@/shared/events/payment-confirmed.event';
import { NotificationService } from '../services/notification.service';

/**
 * PaymentConfirmedNotificationHandler
 *
 * Listens for PaymentConfirmedEvent and persists a 'payment_confirmed'
 * notification for the customer.
 *
 * Only VNPay orders emit this event (COD orders never go through the
 * payment gateway). The event carries paidAmount and paidAt directly.
 *
 * Phase: N-1 — Foundation (persists to DB only, no delivery)
 */
@Injectable()
@EventsHandler(PaymentConfirmedEvent)
export class PaymentConfirmedNotificationHandler
  implements IEventHandler<PaymentConfirmedEvent>
{
  private readonly logger = new Logger(PaymentConfirmedNotificationHandler.name);

  constructor(private readonly notificationService: NotificationService) {}

  async handle(event: PaymentConfirmedEvent): Promise<void> {
    this.logger.log(
      `PaymentConfirmedEvent received: orderId=${event.orderId} customerId=${event.customerId} paidAmount=${event.paidAmount}`,
    );

    try {
      await this.processNotification(event);
    } catch (err) {
      // Never rethrow from an event handler.
      this.logger.error(
        `PaymentConfirmedNotificationHandler failed for orderId=${event.orderId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  private async processNotification(event: PaymentConfirmedEvent): Promise<void> {
    await this.notificationService.sendFromEvent({
      type: 'payment_confirmed',
      recipientId: event.customerId,
      recipientRole: 'customer',
      sourceId: event.orderId,
      templateData: {
        orderId: event.orderId,
        paidAmount: String(event.paidAmount),
      },
      channels: ['in_app', 'push', 'email'],
      orderId: event.orderId,
    });
  }
}
