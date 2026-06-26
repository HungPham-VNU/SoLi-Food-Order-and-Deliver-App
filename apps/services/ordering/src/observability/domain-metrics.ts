/**
 * Minimal domain-metrics shim for the Ordering service.
 *
 * The monolith records these on OpenTelemetry meters; the extracted service
 * keeps the same call surface as no-ops so domain code is unchanged. Real meters
 * can be reintroduced later without touching callers.
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
