/**
 * Minimal domain-metrics shim for the Ordering service.
 *
 * Keeps the metrics call surface as no-ops until real meters are wired.
 */
export function recordOrderPlaced(_attributes: {
  paymentMethod: string;
  restaurantId?: string;
}): void {
  // no-op
}

export function recordPaymentFailure(_attributes: {
  reason: string;
  restaurantId?: string;
}): void {
  // no-op
}
