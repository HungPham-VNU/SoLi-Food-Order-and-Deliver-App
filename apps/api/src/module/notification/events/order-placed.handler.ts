import { Injectable, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { OrderPlacedEvent } from '@/shared/events/order-placed.event';
import { NotificationService } from '../services/notification.service';
import { NotificationRestaurantAclRepository } from '../acl/notification-restaurant-acl.repository';

/**
 * OrderPlacedNotificationHandler
 *
 * Listens for OrderPlacedEvent and persists notification rows for:
 *  1. Customer   — "Đặt hàng thành công" (type: order_placed)
 *  2. Restaurant — "Đơn hàng mới!" (type: new_order_received)
 *
 * The restaurant owner's userId is resolved via the ACL snapshot table.
 * If the snapshot is not found (restaurant never emitted RestaurantUpdatedEvent),
 * the restaurant notification is skipped with a warning — the customer
 * notification still proceeds.
 *
 * Phase: N-1 — Foundation (persists to DB only, no delivery)
 */
@Injectable()
@EventsHandler(OrderPlacedEvent)
export class OrderPlacedNotificationHandler
  implements IEventHandler<OrderPlacedEvent>
{
  private readonly logger = new Logger(OrderPlacedNotificationHandler.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly restaurantAclRepo: NotificationRestaurantAclRepository,
  ) {}

  async handle(event: OrderPlacedEvent): Promise<void> {
    this.logger.log(
      `OrderPlacedEvent received: orderId=${event.orderId} customerId=${event.customerId} restaurantId=${event.restaurantId}`,
    );

    try {
      await this.processNotifications(event);
    } catch (err) {
      // Never rethrow from an event handler (CQRS EventBus constraint).
      this.logger.error(
        `OrderPlacedNotificationHandler failed for orderId=${event.orderId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  private async processNotifications(event: OrderPlacedEvent): Promise<void> {
    const templateData: Record<string, string> = {
      orderId: event.orderId,
      restaurantName: event.restaurantName,
      totalAmount: String(event.totalAmount),
    };

    // 1. Customer notification
    await this.notificationService.sendFromEvent({
      type: 'order_placed',
      recipientId: event.customerId,
      recipientRole: 'customer',
      sourceId: event.orderId,
      templateData,
      channels: ['in_app', 'push'],
      orderId: event.orderId,
    });

    // 2. Restaurant owner notification
    const snapshot = await this.restaurantAclRepo.findByRestaurantId(
      event.restaurantId,
    );

    if (!snapshot) {
      this.logger.warn(
        `[OrderPlacedNotificationHandler] No ACL snapshot for restaurantId=${event.restaurantId} — restaurant notification skipped. ` +
          `Snapshot will be available after the first RestaurantUpdatedEvent for this restaurant.`,
      );
      return;
    }

    await this.notificationService.sendFromEvent({
      type: 'new_order_received',
      recipientId: snapshot.ownerId,
      recipientRole: 'restaurant',
      sourceId: event.orderId,
      templateData: {
        orderId: event.orderId,
        totalAmount: String(event.totalAmount),
        restaurantName: snapshot.name,
      },
      channels: ['in_app', 'push'],
      orderId: event.orderId,
    });
  }
}
