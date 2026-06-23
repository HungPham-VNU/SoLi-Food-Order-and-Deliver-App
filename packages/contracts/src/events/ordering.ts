import { z } from 'zod';
import { EVENT_NAMES } from '../event-names';

/**
 * ordering.order.placed.v1
 *
 * Carries the full OrderPlaced data so the in-process bridge can reconstruct the
 * legacy OrderPlacedEvent for existing consumers (Notification, etc.) without
 * querying the Ordering database.
 */
export const orderPlacedV1Payload = z.object({
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  restaurantId: z.string().uuid(),
  restaurantName: z.string(),
  totalAmount: z.number().int(),
  shippingFee: z.number().int(),
  paymentMethod: z.enum(['cod', 'vnpay']),
  items: z.array(
    z.object({
      menuItemId: z.string(),
      name: z.string(),
      quantity: z.number().int().positive(),
      unitPrice: z.number().int(),
    }),
  ),
  deliveryAddress: z.object({
    street: z.string().optional(),
    district: z.string().optional(),
    city: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }),
  distanceKm: z.number().nullable(),
  estimatedDeliveryMinutes: z.number().nullable(),
  readyForFulfillment: z.boolean(),
  placedAt: z.string(),
});
export type OrderPlacedV1Payload = z.infer<typeof orderPlacedV1Payload>;

export const ORDER_PLACED_V1 = {
  eventType: EVENT_NAMES.OrderingOrderPlaced,
  eventVersion: 1,
  schema: orderPlacedV1Payload,
} as const;

/** ordering.order-cancelled-after-payment.v1 (triggers a refund). */
export const orderCancelledAfterPaymentV1Payload = z.object({
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  paymentMethod: z.literal('vnpay'),
  paidAmount: z.number().int().nonnegative(),
  cancelledByRole: z.enum(['customer', 'restaurant', 'admin', 'system']),
  cancelledAt: z.string(),
});
export type OrderCancelledAfterPaymentV1Payload = z.infer<
  typeof orderCancelledAfterPaymentV1Payload
>;

export const ORDER_CANCELLED_AFTER_PAYMENT_V1 = {
  eventType: EVENT_NAMES.OrderingOrderCancelledAfterPayment,
  eventVersion: 1,
  schema: orderCancelledAfterPaymentV1Payload,
} as const;

/** ordering.order-status.changed.v1 */
export const orderStatusChangedV1Payload = z.object({
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  restaurantId: z.string().uuid(),
  fromStatus: z.string().nullable(),
  toStatus: z.string(),
  changedAt: z.string(),
});
export type OrderStatusChangedV1Payload = z.infer<
  typeof orderStatusChangedV1Payload
>;

export const ORDER_STATUS_CHANGED_V1 = {
  eventType: EVENT_NAMES.OrderingOrderStatusChanged,
  eventVersion: 1,
  schema: orderStatusChangedV1Payload,
} as const;
