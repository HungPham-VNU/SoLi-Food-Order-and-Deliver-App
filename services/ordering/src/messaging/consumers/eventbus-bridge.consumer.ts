import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import {
  EVENT_NAMES,
  orderPlacedV1Payload,
  orderStatusChangedV1Payload,
  orderReadyForPickupV1Payload,
  orderCancelledAfterPaymentV1Payload,
  paymentConfirmedV1Payload,
  paymentFailedV1Payload,
  reviewSubmittedV1Payload,
  catalogMenuItemChangedV1Payload,
  catalogRestaurantChangedV1Payload,
  catalogDeliveryZoneChangedV1Payload,
  type DomainEventEnvelope,
} from '@uitfood/contracts';
import { OrderPlacedEvent } from '@/shared/events/order-placed.event';
import { OrderStatusChangedEvent } from '@/shared/events/order-status-changed.event';
import type {
  OrderStatus,
  TriggeredByRole,
} from '@/shared/contracts/order.contract';
import { OrderReadyForPickupEvent } from '@/shared/events/order-ready-for-pickup.event';
import { OrderCancelledAfterPaymentEvent } from '@/shared/events/order-cancelled-after-payment.event';
import { PaymentConfirmedEvent } from '@/shared/events/payment-confirmed.event';
import { PaymentFailedEvent } from '@/shared/events/payment-failed.event';
import { ReviewSubmittedEvent } from '@/shared/events/review-submitted.event';
import { MenuItemUpdatedEvent } from '@/shared/events/menu-item-updated.event';
import { RestaurantUpdatedEvent } from '@/shared/events/restaurant-updated.event';
import { DeliveryZoneSnapshotUpdatedEvent } from '@/shared/events/delivery-zone-snapshot-updated.event';
import { RabbitMqConsumer } from '../rabbitmq/rabbitmq.consumer';
import { InboxConsumer } from '../inbox/inbox.consumer';

/**
 * EventBusBridgeConsumer — the migration bridge (plan Phase 2, step 4).
 *
 * Producers now record domain events in the transactional outbox instead of
 * calling `EventBus.publish()`. The relay publishes them durably to RabbitMQ.
 * This consumer subscribes to those routing keys and RE-EMITS the equivalent
 * in-process event onto the Nest EventBus, so every existing `@EventsHandler`
 * keeps working unchanged — but now fed by a durable, crash-safe pipeline.
 *
 * Idempotency: the inbox dedupes per (consumer, eventId), so a redelivered
 * message republishes the in-process event at most once.
 *
 * Delivery guarantee: producer → bus is now durable (no crash-after-commit
 * loss). Consumer-side reliability is unchanged from the legacy in-process bus
 * until each consumer is converted to its own real RabbitMQ consumer in later
 * phases; the direct fan-out is removed only once every consumer is broker-backed.
 */
@Injectable()
export class EventBusBridgeConsumer implements OnApplicationBootstrap {
  static readonly CONSUMER = 'monolith.eventbus-bridge';
  static readonly QUEUE = 'monolith.eventbus-bridge.v1';
  private readonly logger = new Logger(EventBusBridgeConsumer.name);

  /** Maps a versioned event type to a factory that rebuilds the in-process event. */
  private readonly registry: Record<string, (payload: unknown) => object> = {
    [EVENT_NAMES.OrderingOrderPlaced]: (p) => {
      const d = orderPlacedV1Payload.parse(p);
      return new OrderPlacedEvent(
        d.orderId,
        d.customerId,
        d.restaurantId,
        d.restaurantName,
        d.totalAmount,
        d.shippingFee,
        d.paymentMethod,
        d.items,
        d.deliveryAddress,
        d.distanceKm ?? undefined,
        d.estimatedDeliveryMinutes ?? undefined,
        d.readyForFulfillment,
      );
    },
    [EVENT_NAMES.OrderingOrderStatusChanged]: (p) => {
      const d = orderStatusChangedV1Payload.parse(p);
      return new OrderStatusChangedEvent(
        d.orderId,
        d.customerId,
        d.restaurantId,
        d.fromStatus as OrderStatus,
        d.toStatus as OrderStatus,
        d.actorRole as TriggeredByRole,
        d.note ?? undefined,
      );
    },
    [EVENT_NAMES.OrderingOrderReadyForPickup]: (p) => {
      const d = orderReadyForPickupV1Payload.parse(p);
      return new OrderReadyForPickupEvent(
        d.orderId,
        d.restaurantId,
        d.restaurantName,
        d.restaurantAddress,
        d.customerId,
        d.deliveryAddress,
      );
    },
    [EVENT_NAMES.OrderingOrderCancelledAfterPayment]: (p) => {
      const d = orderCancelledAfterPaymentV1Payload.parse(p);
      return new OrderCancelledAfterPaymentEvent(
        d.orderId,
        d.customerId,
        d.paymentMethod,
        d.paidAmount,
        new Date(d.cancelledAt),
        d.cancelledByRole,
      );
    },
    [EVENT_NAMES.PaymentConfirmed]: (p) => {
      const d = paymentConfirmedV1Payload.parse(p);
      return new PaymentConfirmedEvent(
        d.orderId,
        d.customerId,
        d.provider,
        d.amount,
        new Date(d.confirmedAt),
      );
    },
    [EVENT_NAMES.PaymentFailed]: (p) => {
      const d = paymentFailedV1Payload.parse(p);
      return new PaymentFailedEvent(
        d.orderId,
        d.customerId,
        d.provider,
        d.reason,
        new Date(d.failedAt),
      );
    },
    [EVENT_NAMES.ReviewSubmitted]: (p) => {
      const d = reviewSubmittedV1Payload.parse(p);
      return new ReviewSubmittedEvent(
        d.reviewId,
        d.orderId,
        d.customerId,
        d.restaurantId,
        d.stars,
      );
    },
    [EVENT_NAMES.CatalogMenuItemChanged]: (p) => {
      const d = catalogMenuItemChangedV1Payload.parse(p);
      return new MenuItemUpdatedEvent(
        d.menuItemId,
        d.restaurantId,
        d.name,
        d.price,
        d.status,
        d.modifiers,
      );
    },
    [EVENT_NAMES.CatalogRestaurantChanged]: (p) => {
      const d = catalogRestaurantChangedV1Payload.parse(p);
      return new RestaurantUpdatedEvent(
        d.restaurantId,
        d.name,
        d.isOpen,
        d.isApproved,
        d.address,
        d.ownerId,
        d.latitude ?? null,
        d.longitude ?? null,
        d.cuisineType ?? null,
      );
    },
    [EVENT_NAMES.CatalogDeliveryZoneChanged]: (p) => {
      const d = catalogDeliveryZoneChangedV1Payload.parse(p);
      return new DeliveryZoneSnapshotUpdatedEvent(
        d.zoneId,
        d.restaurantId,
        d.name,
        d.radiusKm,
        d.baseFee,
        d.perKmRate,
        d.avgSpeedKmh,
        d.prepTimeMinutes,
        d.bufferMinutes,
        d.isActive,
        d.isDeleted,
      );
    },
  };

  constructor(
    private readonly consumer: RabbitMqConsumer,
    private readonly inbox: InboxConsumer,
    private readonly eventBus: EventBus,
  ) {}

  onApplicationBootstrap(): void {
    this.consumer.subscribe({
      queue: EventBusBridgeConsumer.QUEUE,
      routingKeys: Object.keys(this.registry),
      handler: (envelope) => this.handle(envelope),
    });
  }

  private async handle(envelope: DomainEventEnvelope): Promise<void> {
    const factory = this.registry[envelope.eventType];
    if (!factory) {
      // Not a type we bridge — ignore (acked by the consumer).
      return;
    }

    await this.inbox.consume(EventBusBridgeConsumer.CONSUMER, envelope, () => {
      // Re-emit the legacy in-process event. Synchronous dispatch; existing
      // @EventsHandler classes run their own work outside this inbox tx.
      this.eventBus.publish(factory(envelope.payload));
      return Promise.resolve();
    });
  }
}
