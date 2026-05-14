import type { Promotion } from '../domain/promotion.schema';
import type { DiscountBreakdown } from '@/shared/ports/promotion-application.port';

// ---------------------------------------------------------------------------
// Input / Output types for the engine
// ---------------------------------------------------------------------------

export interface PricingInput {
  /** Active promotion to evaluate */
  promotion: Promotion;
  /** Total price of all items × qty (VND integer), WITHOUT shipping */
  itemsSubtotal: number;
  /** Shipping fee in VND */
  shippingFee: number;
  /** Current timestamp — used for date-range eligibility check */
  now: Date;
}

export interface PricingResult {
  eligible: boolean;
  discountOnItems: number; // VND — portion subtracted from item subtotal
  discountOnShipping: number; // VND — portion subtracted from shipping fee
  discountAmount: number; // discountOnItems + discountOnShipping
  breakdown: DiscountBreakdown;
  /** Populated when eligible=false; explains why the promotion was skipped */
  reason?: string;
}

// ---------------------------------------------------------------------------
// PromotionPricingEngine
//
// Pure, stateless service — no DB, no Redis, no side effects.
// Accepts a single Promotion row + cart numbers and returns a discount result.
//
// Design decisions:
//   1. All VND amounts are rounded DOWN to the nearest 1000 (floor rounding).
//   2. Item discounts are capped at itemsSubtotal — final subtotal is never < 0.
//   3. Shipping discounts are capped at shippingFee — never < 0.
//   4. buy_x_get_y / free_item types require item-level data not yet plumbed
//      through the port — they return eligible=false with a reason for now.
// ---------------------------------------------------------------------------
export class PromotionPricingEngine {
  /**
   * Evaluates one promotion against the given cart numbers.
   *
   * @param input — promotion + cart totals
   * @returns PricingResult — eligible flag + discount breakdown
   */
  computeDiscount(input: PricingInput): PricingResult {
    const { promotion, itemsSubtotal, shippingFee, now } = input;

    const notEligible = (reason: string): PricingResult => ({
      eligible: false,
      discountOnItems: 0,
      discountOnShipping: 0,
      discountAmount: 0,
      breakdown: this.emptyBreakdown(promotion),
      reason,
    });

    // -------------------------------------------------------------------------
    // 1. Date range check
    // -------------------------------------------------------------------------
    if (now < promotion.startsAt) {
      return notEligible('Promotion has not started yet');
    }
    if (now > promotion.endsAt) {
      return notEligible('Promotion has expired');
    }

    // -------------------------------------------------------------------------
    // 2. Minimum order amount check
    // -------------------------------------------------------------------------
    if (
      promotion.minOrderAmount !== null &&
      promotion.minOrderAmount !== undefined &&
      itemsSubtotal < promotion.minOrderAmount
    ) {
      return notEligible(
        `Minimum order amount is ${promotion.minOrderAmount} VND`,
      );
    }

    // -------------------------------------------------------------------------
    // 3. Quota check (total uses)
    // -------------------------------------------------------------------------
    if (
      promotion.maxTotalUses !== null &&
      promotion.maxTotalUses !== undefined &&
      promotion.currentTotalUses >= promotion.maxTotalUses
    ) {
      return notEligible('Promotion quota has been reached');
    }

    // -------------------------------------------------------------------------
    // 4. Compute discount by type
    // -------------------------------------------------------------------------
    let discountOnItems = 0;
    let discountOnShipping = 0;

    switch (promotion.type) {
      case 'percentage': {
        // discountValue = integer 1–100 (percent)
        const raw = Math.floor((itemsSubtotal * promotion.discountValue) / 100);
        // Apply percentage cap if set
        const capped =
          promotion.maxDiscountAmount !== null &&
          promotion.maxDiscountAmount !== undefined
            ? Math.min(raw, promotion.maxDiscountAmount)
            : raw;
        // Round down to nearest 1000 VND, then cap at subtotal
        discountOnItems = Math.min(this.floorToThousand(capped), itemsSubtotal);
        break;
      }

      case 'fixed_amount': {
        // discountValue = VND amount (already multiple of 1000)
        discountOnItems = Math.min(promotion.discountValue, itemsSubtotal);
        break;
      }

      case 'free_delivery': {
        // Zero out the entire shipping fee
        discountOnShipping = shippingFee;
        break;
      }

      case 'reduced_delivery': {
        // discountValue = VND amount to reduce from shipping
        discountOnShipping = Math.min(promotion.discountValue, shippingFee);
        break;
      }

      case 'buy_x_get_y':
      case 'free_item': {
        // Complex cart-level rules not yet implemented in Phase PR-1
        return notEligible(
          `Promotion type '${promotion.type}' requires item-level data (Phase PR-4)`,
        );
      }

      default: {
        return notEligible(`Unknown promotion type: ${String(promotion.type)}`);
      }
    }

    // Defensive floor: ensure all discount amounts are multiples of 1000 VND
    // regardless of how the subtotal/shippingFee caps interact with the discount.
    // (e.g. fixed_amount capped at itemsSubtotal where subtotal might not be
    //  a multiple of 1000 if called from tests with arbitrary values)
    discountOnItems = this.floorToThousand(discountOnItems);
    discountOnShipping = this.floorToThousand(discountOnShipping);

    const discountAmount = discountOnItems + discountOnShipping;

    // Edge case: if discount ends up 0 (e.g. free_delivery on a 0 fee order),
    // consider it not eligible to avoid a vacuous 0-discount reservation.
    if (discountAmount === 0) {
      return notEligible('Computed discount is 0 VND');
    }

    return {
      eligible: true,
      discountOnItems,
      discountOnShipping,
      discountAmount,
      breakdown: {
        promotionId: promotion.id,
        promotionName: promotion.name,
        discountType: promotion.type,
        discountOnItems,
        discountOnShipping,
        discountAmount,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Rounds a VND amount DOWN to the nearest 1000. */
  private floorToThousand(amount: number): number {
    return Math.floor(amount / 1000) * 1000;
  }

  private emptyBreakdown(promotion: Promotion): DiscountBreakdown {
    return {
      promotionId: promotion.id,
      promotionName: promotion.name,
      discountType: promotion.type,
      discountOnItems: 0,
      discountOnShipping: 0,
      discountAmount: 0,
    };
  }
}
