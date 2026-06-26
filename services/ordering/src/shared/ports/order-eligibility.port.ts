import type { UnitOfWorkContext } from './unit-of-work-context';

/**
 * IOrderEligibilityPort
 *
 * Cross-BC port that allows the Review BC to verify order eligibility without
 * importing any Ordering BC schema, repository, or module internals.
 *
 * Architecture (ADR-007 — Ports and Adapters):
 *   - Defined here in shared/ports (neutral ground)
 *   - Implemented by OrderEligibilityAdapter in the Ordering BC
 *   - Consumed by SubmitReviewHandler in the Review BC via DI token injection
 *   - Pattern mirrors PAYMENT_INITIATION_PORT / PROMOTION_APPLICATION_PORT
 *
 * Dependency direction:
 *   Review BC  →  ORDER_ELIGIBILITY_PORT (shared interface)
 *                                 ↑
 *              OrderEligibilityAdapter (Ordering BC provides the binding)
 *
 * The port eliminates Review BC's direct coupling to the Ordering BC's
 * internal `orders` schema table and replaces it with an explicit capability
 * contract, consistent with the DIP applied elsewhere in the codebase.
 *
 * Phase: RV-2 (architecture hardening)
 */
export const ORDER_ELIGIBILITY_PORT = Symbol('ORDER_ELIGIBILITY_PORT');

export interface IOrderEligibilityPort {
  /**
   * Checks whether an order is eligible to be reviewed.
   *
   * Throws standard NestJS HTTP exceptions (not caught here — callers let
   * them propagate to the global exception filter):
   *   - NotFoundException        — order not found, or owned by a different customer
   *                                (BR-22.4, BR-22.5 — no info-leak; same 404 for both)
   *   - UnprocessableEntityException(MSG-RATE-02) — order status not in
   *                                REVIEWABLE_STATUSES (ready_for_pickup,
   *                                picked_up, delivering, delivered)
   *                                (BR-22.6, BR-22.7)
   *
   * @param orderId    UUID of the order to validate
   * @param customerId UUID of the customer attempting to submit the review
   * @returns          { restaurantId } — needed by the caller to attribute the review
   */
  checkEligibility(
    orderId: string,
    customerId: string,
  ): Promise<{ restaurantId: string }>;

  markReviewed(orderId: string, context?: UnitOfWorkContext): Promise<void>;
}
