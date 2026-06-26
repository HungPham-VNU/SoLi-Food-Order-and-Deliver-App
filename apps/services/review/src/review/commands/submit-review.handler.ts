import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  createEnvelope,
  REVIEW_SUBMITTED_V1,
  type ReviewSubmittedV1Payload,
} from '@uitfood/contracts';
import type { ReviewDatabase } from '@/drizzle/database.module';
import { REVIEW_DATABASE } from '@/drizzle/database.constants';
import {
  ORDER_ELIGIBILITY_PORT,
  type IOrderEligibilityPort,
} from '@/shared/ports/order-eligibility.port';
import { OutboxWriter } from '@/messaging/outbox/outbox.writer';
import type { Review } from '../domain/review.schema';
import { ReviewRepository } from '../repositories/review.repository';
import { SubmitReviewCommand } from './submit-review.command';

@Injectable()
@CommandHandler(SubmitReviewCommand)
export class SubmitReviewHandler implements ICommandHandler<
  SubmitReviewCommand,
  Review
> {
  private readonly logger = new Logger(SubmitReviewHandler.name);

  constructor(
    private readonly reviewRepo: ReviewRepository,
    @Inject(ORDER_ELIGIBILITY_PORT)
    private readonly orderEligibilityPort: IOrderEligibilityPort,
    private readonly outbox: OutboxWriter,
    @Inject(REVIEW_DATABASE) private readonly db: ReviewDatabase,
  ) {}

  async execute(cmd: SubmitReviewCommand): Promise<Review> {
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

    const { restaurantId } = await this.orderEligibilityPort.checkEligibility(
      cmd.orderId,
      cmd.customerId,
    );

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
            producer: 'review-service',
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
