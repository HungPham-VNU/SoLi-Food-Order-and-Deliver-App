/**
 * Versioned domain-event names. These strings ARE the RabbitMQ routing keys and
 * the `eventType` field of the envelope. Never reuse a name for an incompatible
 * payload — bump the trailing version and overlap during migration.
 */
export const EVENT_NAMES = {
  // Restaurant Catalog
  CatalogRestaurantChanged: 'catalog.restaurant.changed.v1',
  CatalogMenuItemChanged: 'catalog.menu-item.changed.v1',
  CatalogDeliveryZoneChanged: 'catalog.delivery-zone.changed.v1',

  // Ordering
  OrderingOrderPlaced: 'ordering.order.placed.v1',
  OrderingOrderStatusChanged: 'ordering.order-status.changed.v1',
  OrderingOrderCancelledAfterPayment:
    'ordering.order-cancelled-after-payment.v1',

  // Payment
  PaymentConfirmed: 'payment.confirmed.v1',
  PaymentFailed: 'payment.failed.v1',

  // Review
  ReviewSubmitted: 'review.submitted.v1',

  // Identity
  IdentityUserContactChanged: 'identity.user-contact.changed.v1',
  IdentityUserRoleChanged: 'identity.user-role.changed.v1',
} as const;

export type DomainEventName = (typeof EVENT_NAMES)[keyof typeof EVENT_NAMES];
