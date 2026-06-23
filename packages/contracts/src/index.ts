import { z, type ZodType } from 'zod';
import { EVENT_NAMES, type DomainEventName } from './event-names';
import { REVIEW_SUBMITTED_V1 } from './events/review';
import {
  ORDER_STATUS_CHANGED_V1,
  ORDER_PLACED_V1,
  ORDER_CANCELLED_AFTER_PAYMENT_V1,
} from './events/ordering';
import { PAYMENT_CONFIRMED_V1, PAYMENT_FAILED_V1 } from './events/payment';

export * from './envelope';
export * from './event-names';
export * from './events/review';
export * from './events/ordering';
export * from './events/payment';

/**
 * Registry mapping each event name to its payload schema. Consumers use this to
 * validate an incoming envelope's payload before acting on it; CI uses it to
 * assert every declared event has a schema (compatibility gate).
 */
export const EVENT_PAYLOAD_SCHEMAS: Record<DomainEventName, ZodType> = {
  [EVENT_NAMES.ReviewSubmitted]: REVIEW_SUBMITTED_V1.schema,
  [EVENT_NAMES.OrderingOrderPlaced]: ORDER_PLACED_V1.schema,
  [EVENT_NAMES.OrderingOrderStatusChanged]: ORDER_STATUS_CHANGED_V1.schema,
  [EVENT_NAMES.OrderingOrderCancelledAfterPayment]:
    ORDER_CANCELLED_AFTER_PAYMENT_V1.schema,
  [EVENT_NAMES.PaymentConfirmed]: PAYMENT_CONFIRMED_V1.schema,
  [EVENT_NAMES.PaymentFailed]: PAYMENT_FAILED_V1.schema,
  // Declared-but-not-yet-modelled events resolve to a permissive schema until a
  // payload contract is added (keeps the gate honest without blocking rollout).
  [EVENT_NAMES.CatalogRestaurantChanged]: z.unknown(),
  [EVENT_NAMES.CatalogMenuItemChanged]: z.unknown(),
  [EVENT_NAMES.CatalogDeliveryZoneChanged]: z.unknown(),
  [EVENT_NAMES.IdentityUserContactChanged]: z.unknown(),
  [EVENT_NAMES.IdentityUserRoleChanged]: z.unknown(),
};
