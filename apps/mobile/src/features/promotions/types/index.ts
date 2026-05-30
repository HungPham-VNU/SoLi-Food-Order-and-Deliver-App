// ─── Promotions — Public API Types ───────────────────────────────────────────

export type PromotionType =
  | 'percentage'
  | 'fixed_amount'
  | 'free_delivery'
  | 'reduced_delivery'
  | 'buy_x_get_y'
  | 'free_item';

export type PromotionScope = 'platform' | 'restaurant';

export type PromotionStatus = 'draft' | 'active' | 'paused' | 'cancelled' | 'expired';

export type PromotionTrigger = 'auto_apply' | 'coupon_code';

export type PromotionStackingMode = 'non_stackable' | 'stackable' | 'exclusive';

export interface PromotionResponseDto {
  id: string;
  name: string;
  description?: string | null;
  type: PromotionType;
  scope: PromotionScope;
  status: PromotionStatus;
  trigger: PromotionTrigger;
  stackingMode: PromotionStackingMode;
  restaurantId?: string | null;
  discountValue: number;
  minOrderAmount?: number | null;
  maxDiscountAmount?: number | null;
  maxTotalUses?: number | null;
  currentTotalUses: number;
  maxUsesPerUser?: number | null;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ValidateCouponDto {
  code: string;
  restaurantId: string;
  itemsSubtotal: number;
  shippingFee: number;
}

export interface PreviewDiscountDto {
  restaurantId: string;
  itemsSubtotal: number;
  shippingFee: number;
  couponCode?: string;
}

export interface PreviewDiscountResponseDto {
  applicable: boolean;
  promotionId?: string | null;
  couponCodeId?: string | null;
  discountAmount: number;
  finalItemsSubtotal: number;
  finalShippingFee: number;
  reason?: string | null;
}
