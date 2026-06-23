import { z } from 'zod';
import { EVENT_NAMES } from '../event-names';

/**
 * review.submitted.v1
 *
 * Emitted by the Review BC when a review is durably persisted. Carries
 * everything Catalog (rating projection), Ordering (reviewed marker), and
 * Notification need — none of them query the Review database.
 */
export const reviewSubmittedV1Payload = z.object({
  reviewId: z.string().uuid(),
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  restaurantId: z.string().uuid(),
  stars: z.number().int().min(1).max(5),
  submittedAt: z.string(),
});

export type ReviewSubmittedV1Payload = z.infer<typeof reviewSubmittedV1Payload>;

export const REVIEW_SUBMITTED_V1 = {
  eventType: EVENT_NAMES.ReviewSubmitted,
  eventVersion: 1,
  schema: reviewSubmittedV1Payload,
} as const;
