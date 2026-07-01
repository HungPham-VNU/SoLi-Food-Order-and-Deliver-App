/**
 * IPromotionApplicationPort — the discount lifecycle contract.
 *
 * PromotionService implements this locally; Ordering reaches the same surface
 * over TCP RPC for checkout discount preview/reserve/confirm/rollback.
 */
export const PROMOTION_APPLICATION_PORT = Symbol('PROMOTION_APPLICATION_PORT');

// ---------------------------------------------------------------------------
// Shared value types
// ---------------------------------------------------------------------------

export interface CartItemInput {
  menuItemId: string;
  unitPrice: number; // VND integer
  quantity: number;
  modifiersTotal: number; // VND integer — total add-on price for this item
}

export interface DiscountBreakdown {
  promotionId: string;
  promotionName: string;
  discountType: string;
  discountOnItems: number; // VND
  discountOnShipping: number; // VND
  discountAmount: number; // discountOnItems + discountOnShipping
}

// ---------------------------------------------------------------------------
// previewDiscount — read-only, no DB writes
// ---------------------------------------------------------------------------

export interface DiscountPreviewParams {
  customerId: string;
  restaurantId: string;
  items: CartItemInput[];
  /** Sum of all items × qty × (unitPrice + modifiersTotal) */
  itemsSubtotal: number;
  shippingFee: number;
  /** Optional coupon code entered by the customer */
  couponCode?: string;
}

export interface DiscountPreviewResult {
  applicable: boolean;
  promotionId: string | null;
  couponCodeId: string | null;
  discountAmount: number; // VND, rounded to nearest 1000
  finalItemsSubtotal: number;
  finalShippingFee: number;
  breakdown: DiscountBreakdown[];
  /** Human-readable reason when applicable=false */
  reason?: string;
}

// ---------------------------------------------------------------------------
// computeAndReserveDiscount — writes reservation row, atomically increments usage counters
// ---------------------------------------------------------------------------

export interface DiscountReservationParams extends DiscountPreviewParams {
  /** Pre-generated orderId (UUID) — matches the order about to be inserted */
  tempOrderId: string;
}

export interface DiscountReservationResult {
  reserved: boolean;
  promotionId: string | null;
  couponCodeId: string | null;
  /** promotion_usages.id for later confirm/rollback */
  usageId: string | null;
  discountAmount: number; // VND
  breakdown: DiscountBreakdown[];
  /** Set when reserved=false; explains why the promotion was not applied */
  reason?: string;
}

// ---------------------------------------------------------------------------
// Port interface
// ---------------------------------------------------------------------------

export interface IPromotionApplicationPort {
  /** Read-only eligibility check + discount preview (no DB writes). */
  previewDiscount(
    params: DiscountPreviewParams,
  ): Promise<DiscountPreviewResult>;

  /** Atomically reserves the discount for a pending order. */
  computeAndReserveDiscount(
    params: DiscountReservationParams,
  ): Promise<DiscountReservationResult>;

  /** Transitions reserved usages for an order to 'confirmed' (idempotent). */
  confirmReservations(orderId: string): Promise<void>;

  /** Transitions reserved/confirmed usages to 'rolled_back' + decrements counters. */
  rollbackReservations(orderId: string): Promise<void>;
}
