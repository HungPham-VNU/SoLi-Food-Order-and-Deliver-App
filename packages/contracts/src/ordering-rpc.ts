import { z } from 'zod';

/**
 * Ordering synchronous TCP contracts (Phase 9 — Ordering extraction).
 *
 * The gateway translates the public cart/checkout/order/history REST surface
 * into these patterns; the extracted Review service uses
 * `ordering.review-eligibility.get.v1` to validate order ownership/status
 * without reading Ordering tables directly.
 *
 * Every pattern carries `internalAuth` — a short-lived internal JWT with
 * `aud=ordering`. The gateway issues a user-scoped token (customer / restaurant
 * owner / shipper / admin); the Ordering RPC handlers resolve the actor + roles
 * from it and re-check ownership. Service-to-service reads (Review) present a
 * `service:*` token.
 */
export const ORDERING_RPC_PATTERNS = {
  // Cart (Redis-backed)
  getCart: 'ordering.cart.get.v1',
  addCartItem: 'ordering.cart.add-item.v1',
  updateCartItem: 'ordering.cart.update-item.v1',
  updateCartItemModifiers: 'ordering.cart.update-item-modifiers.v1',
  removeCartItem: 'ordering.cart.remove-item.v1',
  clearCart: 'ordering.cart.clear.v1',

  // Checkout (the distributed saga entry point)
  checkout: 'ordering.checkout.place.v1',

  // Order lifecycle
  transitionOrder: 'ordering.order.transition.v1',
  getOrder: 'ordering.order.get.v1',
  getOrderTimeline: 'ordering.order.timeline.v1',
  cancelPendingPayment: 'ordering.payment.cancel-pending.v1',

  // Order history reads (per actor)
  customerOrders: 'ordering.history.customer-list.v1',
  customerOrderDetail: 'ordering.history.customer-detail.v1',
  customerReorder: 'ordering.history.customer-reorder.v1',
  restaurantOrders: 'ordering.history.restaurant-list.v1',
  restaurantActiveOrders: 'ordering.history.restaurant-active.v1',
  shipperAvailableOrders: 'ordering.history.shipper-available.v1',
  shipperActiveOrder: 'ordering.history.shipper-active.v1',
  shipperHistory: 'ordering.history.shipper-history.v1',
  adminOrders: 'ordering.history.admin-list.v1',
  adminOrderDetail: 'ordering.history.admin-detail.v1',

  // Service-to-service read (Review service)
  getReviewEligibility: 'ordering.review-eligibility.get.v1',
} as const;

export type OrderingRpcPattern =
  (typeof ORDERING_RPC_PATTERNS)[keyof typeof ORDERING_RPC_PATTERNS];

/** Stable RPC error envelope translated back to HTTP status at the caller. */
export const orderingRpcErrorSchema = z.object({
  statusCode: z.number().int().min(400).max(599),
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean().default(false),
});
export type OrderingRpcError = z.infer<typeof orderingRpcErrorSchema>;

// ---------------------------------------------------------------------------
// Review eligibility (service-to-service, Phase 8)
// ---------------------------------------------------------------------------

export const orderingReviewEligibilityRequestSchema = z.object({
  internalAuth: z.string().min(1),
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
});
export type OrderingReviewEligibilityRequest = z.infer<
  typeof orderingReviewEligibilityRequestSchema
>;

export const orderingReviewEligibilityResponseSchema = z.object({
  restaurantId: z.string().uuid(),
});
export type OrderingReviewEligibilityResponse = z.infer<
  typeof orderingReviewEligibilityResponseSchema
>;

// ---------------------------------------------------------------------------
// Order-lifecycle transition (gateway maps each REST action to a target status)
// ---------------------------------------------------------------------------

export const orderTransitionRequestSchema = z.object({
  internalAuth: z.string().min(1),
  orderId: z.string().uuid(),
  toStatus: z.enum([
    'confirmed',
    'preparing',
    'ready_for_pickup',
    'picked_up',
    'delivering',
    'delivered',
    'cancelled',
    'refunded',
  ]),
  note: z.string().optional(),
  cancellationReason: z.string().optional(),
});
export type OrderTransitionRequest = z.infer<
  typeof orderTransitionRequestSchema
>;
