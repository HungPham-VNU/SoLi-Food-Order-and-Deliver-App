import { z } from 'zod';

/**
 * Ordering synchronous TCP contracts needed before Ordering itself is extracted.
 *
 * Phase 8 exposes the review eligibility read from the legacy API over TCP so
 * the extracted Review service can validate order ownership/status without
 * reading Ordering tables directly.
 */
export const ORDERING_RPC_PATTERNS = {
  getReviewEligibility: 'ordering.review-eligibility.get.v1',
} as const;

export type OrderingRpcPattern =
  (typeof ORDERING_RPC_PATTERNS)[keyof typeof ORDERING_RPC_PATTERNS];

export const orderingRpcErrorSchema = z.object({
  statusCode: z.number().int().min(400).max(599),
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean().default(false),
});
export type OrderingRpcError = z.infer<typeof orderingRpcErrorSchema>;

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
