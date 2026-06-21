import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import {
  ORDER_ELIGIBILITY_PORT,
  type IOrderEligibilityPort,
} from '@/shared/ports/order-eligibility.port';
import { ReviewSubmittedEvent } from '@/shared/events/review-submitted.event';
import {
  RESTAURANT_ACCESS_PORT,
  type IRestaurantAccessPort,
} from '@/shared/ports/restaurant-access.port';
import type { Review } from '../domain/review.schema';
import { ReviewRepository } from '../repositories/review.repository';
import { SubmitReviewCommand } from './submit-review.command';

/**
 * SubmitReviewHandler
 *
 * Core of UC-22 (Submit Rating & Review).
 *
 * Flow (Section 10.3 of UC22 implementation proposal):
 *  1. Optimistic duplicate pre-check (BR-22.9)            → 409
 *  2. Order eligibility check via ORDER_ELIGIBILITY_PORT
 *     - 404 if missing (MSG-HIST-01)
 *     - 404 if not owned by caller (BR-22.4, BR-22.5)
 *     - 422 if status not in REVIEWABLE_STATUSES (ready_for_pickup,
 *       picked_up, delivering, delivered) (BR-22.6, BR-22.7)
 *  3. Persist the review, then update Ordering and Catalog through ports
 *  4. Catch DB UniqueConstraintViolation (23505) → 409 (BR-22.8)
 *  5. Post-commit eventBus.publish(ReviewSubmittedEvent) — failure logged only
 *
 * Architecture (ADR-007 — Ports and Adapters):
 *  - Events published OUTSIDE the transaction (ADR-004; same as TransitionOrderHandler).
 *  - Order eligibility delegated to ORDER_ELIGIBILITY_PORT — no direct coupling
 *    to the Ordering BC's schema, repositories, or module internals.
 *  - Catalog owns rating writes through RESTAURANT_ACCESS_PORT.
 *  - Ordering owns the reviewed marker through ORDER_ELIGIBILITY_PORT.
 *
 * Phase: RV-2 — Review BC
 */
@Injectable()
@CommandHandler(SubmitReviewCommand)
export class SubmitReviewHandler implements ICommandHandler<
  SubmitReviewCommand,
  Review
> {
  private readonly logger = new Logger(SubmitReviewHandler.name);

  constructor(
    private readonly reviewRepo: ReviewRepository,
    private readonly eventBus: EventBus,
    @Inject(ORDER_ELIGIBILITY_PORT)
    private readonly orderEligibilityPort: IOrderEligibilityPort,
    @Inject(RESTAURANT_ACCESS_PORT)
    private readonly restaurantAccess: IRestaurantAccessPort,
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase,
  ) {}

  async execute(cmd: SubmitReviewCommand): Promise<Review> {
    // -------------------------------------------------------------------------
    // 1. Optimistic duplicate pre-check (BR-22.9)
    //    Returns a richer 409 body than the raw DB unique violation can.
    // -------------------------------------------------------------------------
    const existing = await this.reviewRepo.findByOrderId(cmd.orderId);
    if (existing) {
      throw new ConflictException({
        message: 'You have already submitted a review for this order.',
        code: 'MSG-RATE-03',
        existingReview: {
          createdAt: existing.createdAt.toISOString(),
          stars: existing.stars,
        },
      });
    }

    // -------------------------------------------------------------------------
    // 2. Order eligibility check via ORDER_ELIGIBILITY_PORT (ADR-007)
    //    The port is provided by the Ordering BC's OrderEligibilityAdapter.
    //    Throws NotFoundException / UnprocessableEntityException on failure.
    // -------------------------------------------------------------------------
    const { restaurantId } = await this.orderEligibilityPort.checkEligibility(
      cmd.orderId,
      cmd.customerId,
    );

    // -------------------------------------------------------------------------
    // 3. Transactional INSERT + rating projection (BR-22.11, BR-22.12)
    //    Catch 23505 (UniqueConstraintViolation) → 409 to cover the race between
    //    two concurrent submissions that both passed step 1 (BR-22.8).
    // -------------------------------------------------------------------------
    let inserted: Review;
    try {
      inserted = await this.db.transaction(async (transaction) => {
        const context = { transaction };
        const created = await this.reviewRepo.create(
          {
            orderId: cmd.orderId,
            customerId: cmd.customerId,
            restaurantId,
            stars: cmd.stars,
            comment: cmd.comment ?? null,
            tags: cmd.tags ?? null,
            moderationStatus: 'visible',
          },
          context,
        );

        await this.restaurantAccess.incrementRating(
          restaurantId,
          cmd.stars,
          context,
        );
        await this.orderEligibilityPort.markReviewed(cmd.orderId, context);
        return created;
      });
    } catch (err) {
      // PostgreSQL unique violation
      if ((err as { code?: string })?.code === '23505') {
        throw new ConflictException({
          message: 'You have already submitted a review for this order.',
          code: 'MSG-RATE-03',
        });
      }
      throw err;
    }

    // -------------------------------------------------------------------------
    // 4. Publish ReviewSubmittedEvent AFTER the transaction commits
    //    (consistent with TransitionOrderHandler pattern). DB state is
    //    authoritative; downstream notification miss is observable in logs.
    // -------------------------------------------------------------------------
    try {
      this.eventBus.publish(
        new ReviewSubmittedEvent(
          inserted.id,
          inserted.orderId,
          inserted.customerId,
          inserted.restaurantId,
          inserted.stars,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Failed to publish ReviewSubmittedEvent for reviewId=${inserted.id}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }

    return inserted;
  }
}
