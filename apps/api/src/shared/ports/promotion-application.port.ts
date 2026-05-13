/**
 * IPromotionApplicationPort — DIP port for Ordering → Promotion communication.
 *
 * The Ordering BC depends on this interface, NOT on PromotionService directly.
 * PromotionService (in the Promotion BC) implements this interface.
 *
 * This inversion ensures:
 *   - Ordering never imports Promotion BC implementation classes.
 *   - Promotion BC can be replaced or mocked without touching Ordering.
 *   - No circular module dependency between OrderingModule ↔ PromotionModule.
 *
 * Usage in PlaceOrderHandler (Phase PR-3):
 *   constructor(
 *     @Inject(PROMOTION_APPLICATION_PORT)
 *     private readonly promotionPort: IPromotionApplicationPort,
 *   ) {}
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
  /**
   * Read-only eligibility check + discount preview.
   *
   * Called by cart preview and checkout UI. Does NOT write to the database.
   * May be called many times without side effects.
   *
   * @returns DiscountPreviewResult — eligible + computed amounts, or
   *          applicable=false with a reason string.
   */
  previewDiscount(
    params: DiscountPreviewParams,
  ): Promise<DiscountPreviewResult>;

  /**
   * Atomically reserves the discount for a pending order.
   *
   * Steps:
   *   1. Re-runs eligibility check (same as previewDiscount).
   *   2. Atomically increments promotions.current_total_uses.
   *   3. Atomically increments coupon_codes.current_uses (if coupon trigger).
   *   4. Inserts a promotion_usages row with status='reserved'.
   *
   * The reservation is intentionally optimistic: if the underlying promotion
   * or coupon runs out of quota between preview and checkout, the method
   * returns reserved=false without throwing an error (caller decides whether
   * to proceed without the discount or abort).
   *
   * @returns DiscountReservationResult — reserved=true + discount amounts, or
   *          reserved=false with a reason string.
   */
  computeAndReserveDiscount(
    params: DiscountReservationParams,
  ): Promise<DiscountReservationResult>;

  /**
   * Transitions reserved usages for an order to 'confirmed'.
   *
   * Called by PlaceOrderHandler after the order row is successfully persisted
   * (step 10+ of the place-order flow). Idempotent — safe to call multiple
   * times; already-confirmed rows are ignored.
   *
   * @param orderId — matches tempOrderId used at reservation time
   */
  confirmReservations(orderId: string): Promise<void>;

  /**
   * Transitions reserved/confirmed usages for an order to 'rolled_back' and
   * decrements the usage counters on promotions and coupon_codes.
   *
   * Called when an order is cancelled before fulfillment. Idempotent — rows
   * already in 'rolled_back' state are skipped.
   *
   * @param orderId — matches tempOrderId used at reservation time
   */
  rollbackReservations(orderId: string): Promise<void>;
}
