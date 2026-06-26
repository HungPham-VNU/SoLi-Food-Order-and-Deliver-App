export const ORDER_ELIGIBILITY_PORT = Symbol('ORDER_ELIGIBILITY_PORT');

export interface IOrderEligibilityPort {
  checkEligibility(
    orderId: string,
    customerId: string,
  ): Promise<{ restaurantId: string }>;
}
