import { type ZodType } from 'zod';
import { EVENT_NAMES, type DomainEventName } from './event-names';
import { REVIEW_SUBMITTED_V1 } from './events/review';
import {
  ORDER_STATUS_CHANGED_V1,
  ORDER_READY_FOR_PICKUP_V1,
  ORDER_PLACED_V1,
  ORDER_CANCELLED_AFTER_PAYMENT_V1,
  ORDER_DELIVERED_V1,
} from './events/ordering';
import { PAYMENT_CONFIRMED_V1, PAYMENT_FAILED_V1 } from './events/payment';
import {
  CATALOG_MENU_ITEM_CHANGED_V1,
  CATALOG_RESTAURANT_CHANGED_V1,
  CATALOG_DELIVERY_ZONE_CHANGED_V1,
} from './events/catalog';
import {
  IDENTITY_USER_CONTACT_CHANGED_V1,
  IDENTITY_USER_ROLE_CHANGED_V1,
} from './events/identity';

export * from './envelope';
export * from './event-names';
export * from './media';
export * from './catalog-rpc';
export * from './promotion-rpc';
export * from './payment-rpc';
export * from './ordering-rpc';
export * from './review-rpc';
export * from './reporting-rpc';
export * from './identity';
export * from './notification';
export * from './internal-auth';
export * from './events/review';
export * from './events/ordering';
export * from './events/payment';
export * from './events/catalog';
export * from './events/identity';

/**
 * Registry mapping each event name to its payload schema. Consumers use this to
 * validate an incoming envelope's payload before acting on it; CI uses it to
 * assert every declared event has a schema (compatibility gate).
 */
export const EVENT_PAYLOAD_SCHEMAS: Record<DomainEventName, ZodType> = {
  [EVENT_NAMES.ReviewSubmitted]: REVIEW_SUBMITTED_V1.schema,
  [EVENT_NAMES.OrderingOrderPlaced]: ORDER_PLACED_V1.schema,
  [EVENT_NAMES.OrderingOrderStatusChanged]: ORDER_STATUS_CHANGED_V1.schema,
  [EVENT_NAMES.OrderingOrderReadyForPickup]: ORDER_READY_FOR_PICKUP_V1.schema,
  [EVENT_NAMES.OrderingOrderCancelledAfterPayment]:
    ORDER_CANCELLED_AFTER_PAYMENT_V1.schema,
  [EVENT_NAMES.OrderingOrderDelivered]: ORDER_DELIVERED_V1.schema,
  [EVENT_NAMES.PaymentConfirmed]: PAYMENT_CONFIRMED_V1.schema,
  [EVENT_NAMES.PaymentFailed]: PAYMENT_FAILED_V1.schema,
  [EVENT_NAMES.CatalogRestaurantChanged]: CATALOG_RESTAURANT_CHANGED_V1.schema,
  [EVENT_NAMES.CatalogMenuItemChanged]: CATALOG_MENU_ITEM_CHANGED_V1.schema,
  [EVENT_NAMES.CatalogDeliveryZoneChanged]:
    CATALOG_DELIVERY_ZONE_CHANGED_V1.schema,
  [EVENT_NAMES.IdentityUserContactChanged]:
    IDENTITY_USER_CONTACT_CHANGED_V1.schema,
  [EVENT_NAMES.IdentityUserRoleChanged]: IDENTITY_USER_ROLE_CHANGED_V1.schema,
};
