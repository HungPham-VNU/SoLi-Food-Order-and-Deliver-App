import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EVENT_NAMES,
  catalogRestaurantChangedV1Payload,
  IDENTITY_USER_CONTACT_CHANGED_V1,
  orderCancelledAfterPaymentV1Payload,
  orderPlacedV1Payload,
  orderStatusChangedV1Payload,
  paymentConfirmedV1Payload,
  paymentFailedV1Payload,
  reviewSubmittedV1Payload,
  type DomainEventEnvelope,
} from '@uitfood/contracts';
import type { Env } from '@/config/env.schema';
import { NotificationRestaurantAclRepository } from '@/notification/acl/notification-restaurant-acl.repository';
import { NotificationPreferenceRepository } from '@/notification/repositories/notification-preference.repository';
import { DEFAULT_PREFERENCES } from '@/notification/domain/notification-preference.schema';
import { NotificationService } from '@/notification/services/notification.service';
import type {
  NotificationChannel,
  NotificationType,
} from '@/notification/domain/notification.schema';
import { RabbitMqConsumer } from './rabbitmq/rabbitmq.consumer';
import { InboxConsumer } from './inbox/inbox.consumer';

type OrderStatus =
  | 'pending'
  | 'paid'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'delivering'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

interface TransitionNotificationConfig {
  type: NotificationType;
  recipient: 'customer' | 'restaurant';
  channels: NotificationChannel[];
}

const STATUS_TRANSITION_NOTIFICATION: Partial<
  Record<`${OrderStatus}->${OrderStatus}`, TransitionNotificationConfig>
> = {
  'pending->confirmed': {
    type: 'order_confirmed',
    recipient: 'customer',
    channels: ['in_app', 'push'],
  },
  'paid->confirmed': {
    type: 'order_confirmed',
    recipient: 'customer',
    channels: ['in_app', 'push'],
  },
  'confirmed->preparing': {
    type: 'order_preparing',
    recipient: 'customer',
    channels: ['in_app', 'push'],
  },
  'preparing->ready_for_pickup': {
    type: 'order_ready_for_pickup',
    recipient: 'customer',
    channels: ['in_app', 'push'],
  },
  'ready_for_pickup->picked_up': {
    type: 'order_picked_up',
    recipient: 'customer',
    channels: ['in_app', 'push'],
  },
  'picked_up->delivering': {
    type: 'order_delivering',
    recipient: 'customer',
    channels: ['in_app', 'push'],
  },
  'delivering->delivered': {
    type: 'order_delivered',
    recipient: 'customer',
    channels: ['in_app', 'push', 'email'],
  },
  'pending->cancelled': {
    type: 'order_cancelled',
    recipient: 'customer',
    channels: ['in_app', 'push', 'email'],
  },
  'paid->cancelled': {
    type: 'order_cancelled',
    recipient: 'customer',
    channels: ['in_app', 'push', 'email'],
  },
  'confirmed->cancelled': {
    type: 'order_cancelled',
    recipient: 'customer',
    channels: ['in_app', 'push', 'email'],
  },
  'delivered->refunded': {
    type: 'order_refunded',
    recipient: 'customer',
    channels: ['in_app', 'email'],
  },
};

@Injectable()
export class NotificationEventConsumer implements OnApplicationBootstrap {
  static readonly CONSUMER = 'notification.domain-events';
  static readonly QUEUE = 'notification.domain-events.v1';

  private readonly logger = new Logger(NotificationEventConsumer.name);
  private readonly routingKeys = [
    EVENT_NAMES.OrderingOrderPlaced,
    EVENT_NAMES.OrderingOrderStatusChanged,
    EVENT_NAMES.OrderingOrderCancelledAfterPayment,
    EVENT_NAMES.PaymentConfirmed,
    EVENT_NAMES.PaymentFailed,
    EVENT_NAMES.ReviewSubmitted,
    EVENT_NAMES.CatalogRestaurantChanged,
    EVENT_NAMES.IdentityUserContactChanged,
    EVENT_NAMES.IdentityUserRoleChanged,
  ];

  constructor(
    private readonly consumer: RabbitMqConsumer,
    private readonly inbox: InboxConsumer,
    private readonly notifications: NotificationService,
    private readonly restaurantAcl: NotificationRestaurantAclRepository,
    private readonly preferences: NotificationPreferenceRepository,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onApplicationBootstrap(): void {
    this.consumer.subscribe({
      queue: NotificationEventConsumer.QUEUE,
      routingKeys: this.routingKeys,
      prefetch: this.config.get('RABBITMQ_PREFETCH', { infer: true }),
      handler: (envelope) => this.handle(envelope),
    });
  }

  private async handle(envelope: DomainEventEnvelope): Promise<void> {
    await this.inbox.consume(NotificationEventConsumer.CONSUMER, envelope, () =>
      this.apply(envelope),
    );
  }

  private async apply(envelope: DomainEventEnvelope): Promise<void> {
    switch (envelope.eventType) {
      case EVENT_NAMES.OrderingOrderPlaced:
        return this.handleOrderPlaced(envelope.payload);
      case EVENT_NAMES.OrderingOrderStatusChanged:
        return this.handleOrderStatusChanged(envelope.payload);
      case EVENT_NAMES.OrderingOrderCancelledAfterPayment:
        return this.handleOrderCancelledAfterPayment(envelope.payload);
      case EVENT_NAMES.PaymentConfirmed:
        return this.handlePaymentConfirmed(envelope.payload);
      case EVENT_NAMES.PaymentFailed:
        return this.handlePaymentFailed(envelope.payload);
      case EVENT_NAMES.ReviewSubmitted:
        return this.handleReviewSubmitted(envelope.payload);
      case EVENT_NAMES.CatalogRestaurantChanged:
        return this.handleRestaurantChanged(envelope.payload);
      case EVENT_NAMES.IdentityUserContactChanged:
        return this.handleUserContactChanged(envelope.payload);
      case EVENT_NAMES.IdentityUserRoleChanged:
        this.logger.debug(
          `Identity role event consumed for dedupe only eventId=${envelope.eventId}`,
        );
        return;
      default:
        return;
    }
  }

  private async handleOrderPlaced(payload: unknown): Promise<void> {
    const event = orderPlacedV1Payload.parse(payload);
    if (!event.readyForFulfillment) {
      this.logger.log(
        `Order placed notification skipped for orderId=${event.orderId}: not ready for fulfillment`,
      );
      return;
    }

    await this.notifications.sendFromEvent({
      type: 'order_placed',
      recipientId: event.customerId,
      recipientRole: 'customer',
      sourceId: event.orderId,
      templateData: {
        orderId: event.orderId,
        restaurantName: event.restaurantName,
        totalAmount: String(event.totalAmount),
      },
      channels: ['in_app', 'push'],
      orderId: event.orderId,
    });

    const snapshot = await this.restaurantAcl.findByRestaurantId(
      event.restaurantId,
    );
    if (!snapshot) {
      this.logger.warn(
        `No notification restaurant snapshot for restaurantId=${event.restaurantId}; new-order owner notification skipped`,
      );
      return;
    }

    await this.notifications.sendFromEvent({
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

  private async handleOrderStatusChanged(payload: unknown): Promise<void> {
    const event = orderStatusChangedV1Payload.parse(payload);
    const fromStatus = event.fromStatus as OrderStatus;
    const toStatus = event.toStatus as OrderStatus;
    const transitionKey: `${OrderStatus}->${OrderStatus}` = `${fromStatus}->${toStatus}`;
    const notification = STATUS_TRANSITION_NOTIFICATION[transitionKey];
    if (!notification) return;

    let recipientId = event.customerId;
    let recipientRole = 'customer';

    if (notification.recipient === 'restaurant') {
      const snapshot = await this.restaurantAcl.findByRestaurantId(
        event.restaurantId,
      );
      if (!snapshot) {
        this.logger.warn(
          `No notification restaurant snapshot for restaurantId=${event.restaurantId}; status owner notification skipped`,
        );
        return;
      }
      recipientId = snapshot.ownerId;
      recipientRole = 'restaurant';
    }

    await this.notifications.sendFromEvent({
      type: notification.type,
      recipientId,
      recipientRole,
      sourceId: event.orderId,
      templateData: {
        orderId: event.orderId,
        fromStatus: event.fromStatus ?? '',
        toStatus: event.toStatus,
        ...(event.note ? { reason: event.note } : {}),
      },
      channels: notification.channels,
      orderId: event.orderId,
    });
  }

  private async handleOrderCancelledAfterPayment(
    payload: unknown,
  ): Promise<void> {
    const event = orderCancelledAfterPaymentV1Payload.parse(payload);
    const templateData = {
      orderId: event.orderId,
      paidAmount: String(event.paidAmount),
    };

    await this.notifications.sendFromEvent({
      type: 'order_cancelled',
      recipientId: event.customerId,
      recipientRole: 'customer',
      sourceId: event.orderId,
      templateData,
      channels: ['in_app', 'push', 'email'],
      orderId: event.orderId,
    });

    await this.notifications.sendFromEvent({
      type: 'refund_initiated',
      recipientId: event.customerId,
      recipientRole: 'customer',
      sourceId: event.orderId,
      templateData,
      channels: ['in_app', 'email'],
      orderId: event.orderId,
    });
  }

  private async handlePaymentConfirmed(payload: unknown): Promise<void> {
    const event = paymentConfirmedV1Payload.parse(payload);
    await this.notifications.sendFromEvent({
      type: 'payment_confirmed',
      recipientId: event.customerId,
      recipientRole: 'customer',
      sourceId: event.orderId,
      templateData: {
        orderId: event.orderId,
        paidAmount: String(event.amount),
      },
      channels: ['in_app', 'push', 'email'],
      orderId: event.orderId,
    });
  }

  private async handlePaymentFailed(payload: unknown): Promise<void> {
    const event = paymentFailedV1Payload.parse(payload);
    await this.notifications.sendFromEvent({
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

  private async handleReviewSubmitted(payload: unknown): Promise<void> {
    const event = reviewSubmittedV1Payload.parse(payload);
    const snapshot = await this.restaurantAcl.findByRestaurantId(
      event.restaurantId,
    );
    if (!snapshot) {
      this.logger.warn(
        `No notification restaurant snapshot for restaurantId=${event.restaurantId}; review owner notification skipped`,
      );
      return;
    }

    await this.notifications.sendFromEvent({
      type: 'new_review',
      recipientId: snapshot.ownerId,
      recipientRole: 'restaurant',
      sourceId: event.reviewId,
      templateData: {
        orderId: event.orderId,
        restaurantName: snapshot.name,
        stars: String(event.stars),
      },
      channels: ['in_app', 'push'],
      orderId: event.orderId,
    });
  }

  private async handleRestaurantChanged(payload: unknown): Promise<void> {
    const event = catalogRestaurantChangedV1Payload.parse(payload);
    await this.restaurantAcl.upsert({
      restaurantId: event.restaurantId,
      ownerId: event.ownerId,
      name: event.name,
      lastSyncedAt: new Date(),
    });
  }

  private async handleUserContactChanged(payload: unknown): Promise<void> {
    const event = IDENTITY_USER_CONTACT_CHANGED_V1.schema.parse(payload);
    const existing = await this.preferences.findByUserId(event.userId);
    await this.preferences.upsert({
      userId: event.userId,
      pushEnabled: existing?.pushEnabled ?? DEFAULT_PREFERENCES.pushEnabled,
      inAppEnabled: existing?.inAppEnabled ?? DEFAULT_PREFERENCES.inAppEnabled,
      emailEnabled: existing?.emailEnabled ?? DEFAULT_PREFERENCES.emailEnabled,
      smsEnabled: existing?.smsEnabled ?? DEFAULT_PREFERENCES.smsEnabled,
      quietHoursStart:
        existing?.quietHoursStart ?? DEFAULT_PREFERENCES.quietHoursStart,
      quietHoursEnd:
        existing?.quietHoursEnd ?? DEFAULT_PREFERENCES.quietHoursEnd,
      mutedTypes: existing?.mutedTypes ?? DEFAULT_PREFERENCES.mutedTypes,
      email: event.email,
      timezone: existing?.timezone ?? DEFAULT_PREFERENCES.timezone,
    });
  }
}
