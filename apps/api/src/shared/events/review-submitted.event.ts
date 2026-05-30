/**
 * ReviewSubmittedEvent
 *
 * Published by: Review BC (SubmitReviewHandler) AFTER the DB transaction commits.
 * Consumed by:
 *  - Notification BC → restaurant-owner `new_review` notification.
 *
 * Plain POJO with no NestJS / drizzle / framework dependencies so it remains
 * a zero-coupling shared contract per ADR-002.
 *
 * Phase: RV-3
 */
export class ReviewSubmittedEvent {
  constructor(
    public readonly reviewId: string,
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly restaurantId: string,
    public readonly stars: number,
  ) {}
}
