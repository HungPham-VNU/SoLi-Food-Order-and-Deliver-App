import { z } from 'zod';

/**
 * Review service synchronous TCP RPC contracts (Phase 8).
 *
 * The public `/api/reviews/**` HTTP surface is preserved by the gateway, which
 * translates requests to these versioned TCP patterns. Review owns the review
 * row and publishes `review.submitted.v1`; Ordering/Catalog/Notification update
 * their projections from that event.
 */
export const REVIEW_RPC_PATTERNS = {
  submitReview: 'review.submit.v1',
  listRestaurantReviews: 'review.restaurant.list.v1',
  listRestaurantReviewsAdmin: 'review.restaurant.list-admin.v1',
  getMyReview: 'review.mine.get.v1',
} as const;

export type ReviewRpcPattern =
  (typeof REVIEW_RPC_PATTERNS)[keyof typeof REVIEW_RPC_PATTERNS];

export const reviewRpcErrorSchema = z.object({
  statusCode: z.number().int().min(400).max(599),
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean().default(false),
});
export type ReviewRpcError = z.infer<typeof reviewRpcErrorSchema>;

export const reviewModerationStatusSchema = z.enum([
  'visible',
  'flagged',
  'hidden',
]);
export type ReviewModerationStatusDto = z.infer<
  typeof reviewModerationStatusSchema
>;

export const reviewTagSchema = z.enum([
  'fast_delivery',
  'good_packaging',
  'fresh_food',
  'accurate_order',
  'friendly_service',
  'poor_packaging',
  'late_delivery',
  'wrong_order',
  'cold_food',
  'missing_items',
]);
export type ReviewTagDto = z.infer<typeof reviewTagSchema>;

export const submitReviewRequestSchema = z.object({
  internalAuth: z.string().min(1),
  orderId: z.string().uuid(),
  stars: z.number().int().min(1).max(5),
  comment: z.string().max(1000).trim().optional(),
  tags: z.array(reviewTagSchema).max(5).optional(),
});
export type SubmitReviewRequest = z.infer<typeof submitReviewRequestSchema>;

export const reviewResponseSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  restaurantId: z.string().uuid(),
  stars: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  tags: z.array(reviewTagSchema).nullable(),
  moderationStatus: reviewModerationStatusSchema,
  createdAt: z.string(),
});
export type ReviewResponse = z.infer<typeof reviewResponseSchema>;

export const submitReviewResponseSchema = reviewResponseSchema.extend({
  message: z.string().min(1),
});
export type SubmitReviewResponse = z.infer<typeof submitReviewResponseSchema>;

export const listRestaurantReviewsRequestSchema = z.object({
  restaurantId: z.string().uuid(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(50).default(20),
});
export type ListRestaurantReviewsRequest = z.infer<
  typeof listRestaurantReviewsRequestSchema
>;

export const publicReviewItemSchema = z.object({
  id: z.string().uuid(),
  stars: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  tags: z.array(reviewTagSchema).nullable(),
  createdAt: z.string(),
});
export type PublicReviewItem = z.infer<typeof publicReviewItemSchema>;

export const publicReviewListResponseSchema = z.object({
  data: z.array(publicReviewItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});
export type PublicReviewListResponse = z.infer<
  typeof publicReviewListResponseSchema
>;

export const adminReviewItemSchema = reviewResponseSchema.extend({
  moderationReason: z.string().nullable(),
});
export type AdminReviewItem = z.infer<typeof adminReviewItemSchema>;

export const adminReviewListRequestSchema =
  listRestaurantReviewsRequestSchema.extend({
    internalAuth: z.string().min(1),
  });
export type AdminReviewListRequest = z.infer<
  typeof adminReviewListRequestSchema
>;

export const adminReviewListResponseSchema = z.object({
  data: z.array(adminReviewItemSchema),
  total: z.number().int().nonnegative(),
  averageRating: z.number(),
  ratingDistribution: z.record(z.string(), z.number().int().nonnegative()),
});
export type AdminReviewListResponse = z.infer<
  typeof adminReviewListResponseSchema
>;

export const getMyReviewRequestSchema = z.object({
  internalAuth: z.string().min(1),
  orderId: z.string().uuid(),
});
export type GetMyReviewRequest = z.infer<typeof getMyReviewRequestSchema>;
