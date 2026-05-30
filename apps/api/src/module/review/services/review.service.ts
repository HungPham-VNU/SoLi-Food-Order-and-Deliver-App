import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { SubmitReviewCommand } from '../commands/submit-review.command';
import type { Review } from '../domain/review.schema';
import type { SubmitReviewDto } from '../dto/review.dto';

/**
 * ReviewService
 *
 * Thin application-service layer between ReviewController and the CQRS
 * CommandBus. Keeping the controller free of CommandBus wiring matches the
 * pattern established by `OrderLifecycleController` / `OrderHistoryService`.
 *
 * Phase: RV-2
 */
@Injectable()
export class ReviewService {
  constructor(private readonly commandBus: CommandBus) {}

  /**
   * Dispatches a SubmitReviewCommand. The customerId is always supplied by
   * the caller from the authenticated session — never from the request body.
   */
  async submit(dto: SubmitReviewDto, customerId: string): Promise<Review> {
    return this.commandBus.execute<SubmitReviewCommand, Review>(
      new SubmitReviewCommand(
        dto.orderId,
        customerId,
        dto.stars,
        dto.comment,
        dto.tags,
      ),
    );
  }
}
