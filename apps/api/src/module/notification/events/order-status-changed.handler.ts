import { Injectable, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { OrderStatusChangedEvent } from '@/shared/events/order-status-changed.event';
import { NotificationService } from '../services/notification.service';
import { NotificationRestaurantAclRepository } from '../acl/notification-restaurant-acl.repository';
import type { OrderStatus } from '@/shared/contracts/order.contract';
import type {
  NotificationType,
  NotificationChannel,
} from '../domain/notification.schema';

// ---------------------------------------------------------------------------
// STATUS_TRANSITION_NOTIFICATION
//
// Maps every valid status transition to the notification that should be sent,
// and to whom.
//
// Key format: `${fromStatus}→${toStatus}` — the arrow character is U+2192.
// Entries that do not require a notification are absent from the map (no entry
// = no notification, handler returns early).
//
// recipient 'customer'    → event.customerId
// recipient 'restaurant'  → resolved via ACL snapshot (event.restaurantId → ownerId)
// ---------------------------------------------------------------------------
interface TransitionNotificationConfig {
  type: NotificationType;
  recipient: 'customer' | 'restaurant';
  channels: NotificationChannel[];
}

export const STATUS_TRANSITION_NOTIFICATION: Partial<
  Record<`${OrderStatus}→${OrderStatus}`, TransitionNotificationConfig>
> = {
  // T-01: Restaurant accepts the order (COD)
  'pending→confirmed': {
    type: 'order_confirmed',
    recipient: 'customer',
    channels: ['in_app', 'push'],
  },

  // T-02: VNPay — restaurant confirms after payment is received
  'paid→confirmed': {
    type: 'order_confirmed',
    recipient: 'customer',
    channels: ['in_app', 'push'],
  },

  // T-06: Restaurant starts cooking
  'confirmed→preparing': {
    type: 'order_preparing',
    recipient: 'customer',
    channels: ['in_app', 'push'],
  },

  // T-08: Food ready for pickup (restaurant triggered)
  'preparing→ready_for_pickup': {
    type: 'order_ready_for_pickup',
    recipient: 'customer',
    channels: ['in_app', 'push'],
  },

  // T-09: Shipper collects the order
  'ready_for_pickup→picked_up': {
    type: 'order_picked_up',
    recipient: 'customer',
    channels: ['in_app', 'push'],
  },

  // T-10: Shipper en route
  'picked_up→delivering': {
    type: 'order_delivering',
    recipient: 'customer',
    channels: ['in_app', 'push'],
  },

  // T-11: Order delivered successfully
  'delivering→delivered': {
    type: 'order_delivered',
    recipient: 'customer',
    channels: ['in_app', 'push', 'email'],
  },

  // T-03: Order cancelled (before payment or COD cancellation)
  // Customer-initiated or restaurant-initiated cancellation without payment
  'pending→cancelled': {
    type: 'order_cancelled',
    recipient: 'customer',
    channels: ['in_app', 'push', 'email'],
  },

  // T-05: VNPay order cancelled after payment (timeout, customer or system)
  // OrderCancelledAfterPaymentEvent also fires for this transition; both
  // handlers produce the same idempotency key so only one row is persisted.
  'paid→cancelled': {
    type: 'order_cancelled',
    recipient: 'customer',
    channels: ['in_app', 'push', 'email'],
  },

  // T-07: Cancelled after confirmation (COD or VNPay)
  // For VNPay T-07, OrderCancelledAfterPaymentEvent also fires; same
  // idempotency key ensures only one order_cancelled row is persisted.
  'confirmed→cancelled': {
    type: 'order_cancelled',
    recipient: 'customer',
    channels: ['in_app', 'push', 'email'],
  },

  // T-12: Delivered → Refunded (admin dispute or late refund)
  'delivered→refunded': {
    type: 'order_refunded',
    recipient: 'customer',
    channels: ['in_app', 'email'],
  },
};

// ---------------------------------------------------------------------------
// OrderStatusChangedNotificationHandler
//
// Translates order lifecycle transitions into customer or restaurant
// notifications. Uses STATUS_TRANSITION_NOTIFICATION to determine type and
// recipient; silently skips transitions not in the map.
//
// Phase: N-1 — Foundation (persists to DB only, no delivery)
// ---------------------------------------------------------------------------
@Injectable()
@EventsHandler(OrderStatusChangedEvent)
export class OrderStatusChangedNotificationHandler implements IEventHandler<OrderStatusChangedEvent> {
  private readonly logger = new Logger(
    OrderStatusChangedNotificationHandler.name,
  );

  constructor(
    private readonly notificationService: NotificationService,
    private readonly restaurantAclRepo: NotificationRestaurantAclRepository,
  ) {}

  async handle(event: OrderStatusChangedEvent): Promise<void> {
    const fromStatus: OrderStatus = event.fromStatus;
    const toStatus: OrderStatus = event.toStatus;
    const transitionKey: `${OrderStatus}→${OrderStatus}` = `${fromStatus}→${toStatus}`;

    this.logger.log(
      `OrderStatusChangedEvent received: orderId=${event.orderId} transition=${transitionKey} triggeredBy=${event.triggeredByRole}`,
    );

    try {
      await this.processNotification(event, transitionKey);
    } catch (err) {
      // Never rethrow from an event handler.
      this.logger.error(
        `OrderStatusChangedNotificationHandler failed for orderId=${event.orderId} transition=${transitionKey}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  private async processNotification(
    event: OrderStatusChangedEvent,
    transitionKey: `${OrderStatus}→${OrderStatus}`,
  ): Promise<void> {
    const config = STATUS_TRANSITION_NOTIFICATION[transitionKey];

    if (!config) {
      this.logger.debug(
        `[OrderStatusChanged] No notification configured for transition ${transitionKey} — skipping`,
      );
      return;
    }

    // Resolve recipient userId
    let recipientId: string;
    let recipientRole: string;

    if (config.recipient === 'customer') {
      recipientId = event.customerId;
      recipientRole = 'customer';
    } else {
      // Restaurant owner — resolve via ACL snapshot
      const snapshot = await this.restaurantAclRepo.findByRestaurantId(
        event.restaurantId,
      );

      if (!snapshot) {
        this.logger.warn(
          `[OrderStatusChanged] No ACL snapshot for restaurantId=${event.restaurantId} ` +
            `transition=${transitionKey} — restaurant notification skipped`,
        );
        return;
      }

      recipientId = snapshot.ownerId;
      recipientRole = 'restaurant';
    }

    const templateData: Record<string, string> = {
      orderId: event.orderId,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      ...(event.note ? { reason: event.note } : {}),
    };

    await this.notificationService.sendFromEvent({
      type: config.type,
      recipientId,
      recipientRole,
      sourceId: event.orderId,
      templateData,
      channels: config.channels,
      orderId: event.orderId,
    });
  }
}
