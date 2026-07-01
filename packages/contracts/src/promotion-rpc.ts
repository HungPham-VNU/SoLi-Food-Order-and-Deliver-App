import { z } from 'zod';

/**
 * Promotion service synchronous TCP RPC contracts (Phase 7 — Promotion wave).
 *
 * Pattern values are versioned strings used as Nest `@MessagePattern()` keys and
 * `ClientProxy.send()` patterns. The gateway translates public HTTP routes into
 * these patterns; the monolith Ordering BC reaches the same discount lifecycle
 * over RPC instead of an in-process port.
 *
 * Every lifecycle call carries `internalAuth` — a short-lived internal JWT with
 * `aud=promotion`. The gateway issues a user-scoped token for the public
 * preview; the monolith Ordering adapter issues a `service:api` token for
 * reserve/confirm/rollback. `listActivePromotions` is anonymous (no auth).
 */
export const PROMOTION_RPC_PATTERNS = {
  previewDiscount: 'promotion.discount.preview.v1',
  reserveDiscount: 'promotion.discount.reserve.v1',
  confirmReservations: 'promotion.reservation.confirm.v1',
  rollbackReservations: 'promotion.reservation.rollback.v1',
  listActivePromotions: 'promotion.list-active.v1',

  // Restaurant-owner promotion management
  restaurantListPromotions: 'promotion.restaurant.list.v1',
  restaurantGetPromotion: 'promotion.restaurant.get.v1',
  restaurantCreatePromotion: 'promotion.restaurant.create.v1',
  restaurantUpdatePromotion: 'promotion.restaurant.update.v1',
  restaurantActivatePromotion: 'promotion.restaurant.activate.v1',
  restaurantPausePromotion: 'promotion.restaurant.pause.v1',
  restaurantCancelPromotion: 'promotion.restaurant.cancel.v1',

  adminListPromotions: 'promotion.admin.list.v1',
  adminGetPromotion: 'promotion.admin.get.v1',
  adminCreatePromotion: 'promotion.admin.create.v1',
  adminUpdatePromotion: 'promotion.admin.update.v1',
  adminActivatePromotion: 'promotion.admin.activate.v1',
  adminPausePromotion: 'promotion.admin.pause.v1',
  adminCancelPromotion: 'promotion.admin.cancel.v1',
  adminListCoupons: 'promotion.admin.coupons.list.v1',
  adminGenerateCoupons: 'promotion.admin.coupons.generate.v1',
  adminRevokeCoupon: 'promotion.admin.coupons.revoke.v1',
} as const;

export type PromotionRpcPattern =
  (typeof PROMOTION_RPC_PATTERNS)[keyof typeof PROMOTION_RPC_PATTERNS];

// ---------------------------------------------------------------------------
// Shared RPC envelope pieces
// ---------------------------------------------------------------------------

/** Stable RPC error envelope translated back to HTTP status at the caller. */
export const promotionRpcErrorSchema = z.object({
  statusCode: z.number().int().min(400).max(599),
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean().default(false),
});
export type PromotionRpcError = z.infer<typeof promotionRpcErrorSchema>;

// ---------------------------------------------------------------------------
// Value schemas (mirror IPromotionApplicationPort)
// ---------------------------------------------------------------------------

const vnd = z.number().int();

export const cartItemInputSchema = z.object({
  menuItemId: z.string().min(1),
  unitPrice: vnd.nonnegative(),
  quantity: z.number().int().positive(),
  modifiersTotal: vnd.nonnegative(),
});

export const discountPreviewParamsSchema = z.object({
  customerId: z.string().min(1),
  restaurantId: z.string().min(1),
  items: z.array(cartItemInputSchema).default([]),
  itemsSubtotal: vnd.nonnegative(),
  shippingFee: vnd.nonnegative(),
  couponCode: z.string().min(1).optional(),
});
export type DiscountPreviewParamsDto = z.infer<
  typeof discountPreviewParamsSchema
>;

export const discountReservationParamsSchema =
  discountPreviewParamsSchema.extend({
    tempOrderId: z.string().uuid(),
  });
export type DiscountReservationParamsDto = z.infer<
  typeof discountReservationParamsSchema
>;

export const discountBreakdownSchema = z.object({
  promotionId: z.string(),
  promotionName: z.string(),
  discountType: z.string(),
  discountOnItems: vnd,
  discountOnShipping: vnd,
  discountAmount: vnd,
});

export const discountPreviewResultSchema = z.object({
  applicable: z.boolean(),
  promotionId: z.string().nullable(),
  couponCodeId: z.string().nullable(),
  discountAmount: vnd,
  finalItemsSubtotal: vnd,
  finalShippingFee: vnd,
  breakdown: z.array(discountBreakdownSchema),
  reason: z.string().optional(),
});
export type DiscountPreviewResultDto = z.infer<
  typeof discountPreviewResultSchema
>;

export const discountReservationResultSchema = z.object({
  reserved: z.boolean(),
  promotionId: z.string().nullable(),
  couponCodeId: z.string().nullable(),
  usageId: z.string().nullable(),
  discountAmount: vnd,
  breakdown: z.array(discountBreakdownSchema),
  reason: z.string().optional(),
});
export type DiscountReservationResultDto = z.infer<
  typeof discountReservationResultSchema
>;

// ---------------------------------------------------------------------------
// Request envelopes
// ---------------------------------------------------------------------------

export const previewDiscountRequestSchema = z.object({
  internalAuth: z.string().min(1),
  params: discountPreviewParamsSchema,
});
export type PreviewDiscountRequest = z.infer<
  typeof previewDiscountRequestSchema
>;

export const reserveDiscountRequestSchema = z.object({
  internalAuth: z.string().min(1),
  params: discountReservationParamsSchema,
});
export type ReserveDiscountRequest = z.infer<
  typeof reserveDiscountRequestSchema
>;

export const reservationByOrderRequestSchema = z.object({
  internalAuth: z.string().min(1),
  orderId: z.string().uuid(),
});
export type ReservationByOrderRequest = z.infer<
  typeof reservationByOrderRequestSchema
>;

export const listActivePromotionsRequestSchema = z.object({
  restaurantId: z.string().min(1).optional(),
});
export type ListActivePromotionsRequest = z.infer<
  typeof listActivePromotionsRequestSchema
>;

// ---------------------------------------------------------------------------
// Public read response (subset of the promotions row visible to customers)
// ---------------------------------------------------------------------------

export const publicPromotionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  type: z.string(),
  scope: z.string(),
  trigger: z.string(),
  discountValue: z.number().int(),
  minOrderAmount: z.number().int().nullable(),
  maxDiscountAmount: z.number().int().nullable(),
  restaurantId: z.string().nullable(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
});
export type PublicPromotion = z.infer<typeof publicPromotionSchema>;

// ---------------------------------------------------------------------------
// Admin management (promotion CRUD + coupon code management)
// ---------------------------------------------------------------------------

export const promotionTypeValues = [
  'percentage',
  'fixed_amount',
  'free_delivery',
  'reduced_delivery',
  'buy_x_get_y',
  'free_item',
] as const;

export const promotionScopeValues = ['platform', 'restaurant'] as const;

export const promotionStatusValues = [
  'draft',
  'active',
  'paused',
  'cancelled',
  'expired',
] as const;

export const promotionTriggerValues = ['auto_apply', 'coupon_code'] as const;

export const stackingModeValues = [
  'non_stackable',
  'stackable',
  'exclusive',
] as const;

export const couponStatusValues = [
  'active',
  'exhausted',
  'expired',
  'revoked',
] as const;

export const createPromotionInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  type: z.enum(promotionTypeValues),
  scope: z.enum(promotionScopeValues),
  trigger: z.enum(promotionTriggerValues),
  stackingMode: z.enum(stackingModeValues).optional(),
  restaurantId: z.string().min(1).optional(),
  discountValue: z.number().int().positive(),
  minOrderAmount: z.number().int().nonnegative().optional(),
  maxDiscountAmount: z.number().int().nonnegative().optional(),
  maxTotalUses: z.number().int().positive().optional(),
  maxUsesPerUser: z.number().int().positive().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
});
export type CreatePromotionInput = z.infer<typeof createPromotionInputSchema>;

export const updatePromotionInputSchema = createPromotionInputSchema
  .omit({ type: true, scope: true, trigger: true })
  .partial();
export type UpdatePromotionInput = z.infer<typeof updatePromotionInputSchema>;

export const adminListPromotionsRequestSchema = z.object({
  internalAuth: z.string().min(1),
  status: z.enum(promotionStatusValues).optional(),
  restaurantId: z.string().min(1).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
export type AdminListPromotionsRequest = z.infer<
  typeof adminListPromotionsRequestSchema
>;

export const adminPromotionIdRequestSchema = z.object({
  internalAuth: z.string().min(1),
  id: z.string().min(1),
});
export type AdminPromotionIdRequest = z.infer<
  typeof adminPromotionIdRequestSchema
>;

export const adminCreatePromotionRequestSchema = z.object({
  internalAuth: z.string().min(1),
  data: createPromotionInputSchema,
});
export type AdminCreatePromotionRequest = z.infer<
  typeof adminCreatePromotionRequestSchema
>;

export const adminUpdatePromotionRequestSchema = z.object({
  internalAuth: z.string().min(1),
  id: z.string().min(1),
  data: updatePromotionInputSchema,
});
export type AdminUpdatePromotionRequest = z.infer<
  typeof adminUpdatePromotionRequestSchema
>;

export const adminListCouponsRequestSchema = z.object({
  internalAuth: z.string().min(1),
  promotionId: z.string().min(1),
  status: z.enum(couponStatusValues).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});
export type AdminListCouponsRequest = z.infer<
  typeof adminListCouponsRequestSchema
>;

export const adminGenerateCouponsRequestSchema = z.object({
  internalAuth: z.string().min(1),
  promotionId: z.string().min(1),
  codes: z.array(z.string().min(1)).min(1),
  maxUsesPerCode: z.number().int().positive().optional(),
  expiresAt: z.coerce.date().optional(),
});
export type AdminGenerateCouponsRequest = z.infer<
  typeof adminGenerateCouponsRequestSchema
>;

export const adminRevokeCouponRequestSchema = z.object({
  internalAuth: z.string().min(1),
  promotionId: z.string().min(1),
  couponId: z.string().min(1),
});
export type AdminRevokeCouponRequest = z.infer<
  typeof adminRevokeCouponRequestSchema
>;

// ---------------------------------------------------------------------------
// Restaurant-owner management (promotion CRUD scoped to one restaurant)
// ---------------------------------------------------------------------------

export const restaurantListPromotionsRequestSchema = z.object({
  internalAuth: z.string().min(1),
  restaurantId: z.string().min(1),
  offset: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
export type RestaurantListPromotionsRequest = z.infer<
  typeof restaurantListPromotionsRequestSchema
>;

export const restaurantPromotionIdRequestSchema = z.object({
  internalAuth: z.string().min(1),
  restaurantId: z.string().min(1),
  id: z.string().min(1),
});
export type RestaurantPromotionIdRequest = z.infer<
  typeof restaurantPromotionIdRequestSchema
>;

export const restaurantCreatePromotionRequestSchema = z.object({
  internalAuth: z.string().min(1),
  restaurantId: z.string().min(1),
  data: createPromotionInputSchema,
});
export type RestaurantCreatePromotionRequest = z.infer<
  typeof restaurantCreatePromotionRequestSchema
>;

export const restaurantUpdatePromotionRequestSchema = z.object({
  internalAuth: z.string().min(1),
  restaurantId: z.string().min(1),
  id: z.string().min(1),
  data: updatePromotionInputSchema,
});
export type RestaurantUpdatePromotionRequest = z.infer<
  typeof restaurantUpdatePromotionRequestSchema
>;
