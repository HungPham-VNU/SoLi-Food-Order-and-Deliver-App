import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  createEnvelope,
  REVIEW_SUBMITTED_V1,
  type ReviewSubmittedV1Payload,
} from '@uitfood/contracts';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import {
  ORDER_ELIGIBILITY_PORT,
  type IOrderEligibilityPort,
} from '@/shared/ports/order-eligibility.port';
import { OutboxWriter } from '@/messaging/outbox/outbox.writer';
import type { Review } from '../domain/review.schema';
import { ReviewRepository } from '../repositories/review.repository';
import { SubmitReviewCommand } from './submit-review.command';

/**
 * SubmitReviewHandler — Phase 2 (UnitOfWork dismantled).
 *
 * BEFORE: one Postgres transaction spanned Review.insert +
 * Catalog.incrementRating + Ordering.markReviewed (cross-context UnitOfWork).
 * That atomic write cannot cross independent databases.
 *
 * AFTER: a single LOCAL transaction writes the review row AND a
 * `review.submitted.v1` outbox event. Catalog's rating projection and Ordering's
 * reviewed marker are now event consumers (see messaging/consumers/*), applied
 * idempotently via the inbox. The review is authoritative immediately; the two
 * projections are eventually consistent. The `reviews_order_id_unique`
 * constraint remains the final duplicate defense.
 *
 * Note: the post-commit `EventBus.publish(ReviewSubmittedEvent)` is GONE — its
 * delivery is now guaranteed by the outbox relay (no crash-after-commit loss).
 */
@Injectable()
@CommandHandler(SubmitReviewCommand)
export class SubmitReviewHandler
  implements ICommandHandler<SubmitReviewCommand, Review>
{
  private readonly logger = new Logger(SubmitReviewHandler.name);

  constructor(
    private readonly reviewRepo: ReviewRepository,
    @Inject(ORDER_ELIGIBILITY_PORT)
    private readonly orderEligibilityPort: IOrderEligibilityPort,
    private readonly outbox: OutboxWriter,
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase,
  ) {}

  async execute(cmd: SubmitReviewCommand): Promise<Review> {
    // 1. Optimistic duplicate pre-check (BR-22.9) — richer 409 than the raw
    //    unique violation.
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

    // 2. Order eligibility check (read-only). Still synchronous through the port;
    //    becomes a TCP read after Ordering is extracted. Throws 404/422 on
    //    failure — let it propagate.
    const { restaurantId } = await this.orderEligibilityPort.checkEligibility(
      cmd.orderId,
      cmd.customerId,
    );

    // 3. ONE local transaction: persist the review AND its outbox event.
    let inserted: Review;
    try {
      inserted = await this.db.transaction(async (tx) => {
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
          { transaction: tx },
        );

        const payload: ReviewSubmittedV1Payload = {
          reviewId: created.id,
          orderId: created.orderId,
          customerId: created.customerId,
          restaurantId: created.restaurantId,
          stars: created.stars,
          submittedAt: created.createdAt.toISOString(),
        };

        await this.outbox.write(
          tx,
          createEnvelope({
            eventType: REVIEW_SUBMITTED_V1.eventType,
            eventVersion: REVIEW_SUBMITTED_V1.eventVersion,
            aggregateId: created.id,
            aggregateVersion: 0,
            producer: 'monolith',
            payload,
          }),
        );

        return created;
      });
    } catch (err) {
      if ((err as { code?: string })?.code === '23505') {
        throw new ConflictException({
          message: 'You have already submitted a review for this order.',
          code: 'MSG-RATE-03',
        });
      }
      throw err;
    }

    this.logger.log(
      `Review ${inserted.id} persisted with outbox event review.submitted.v1`,
    );
    return inserted;
  }
}
