import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { DatabaseModule } from '@/drizzle/drizzle.module';
import { SubmitReviewHandler } from './commands/submit-review.handler';
import { ReviewController } from './controllers/review.controller';
import { ReviewRepository } from './repositories/review.repository';
import { ReviewService } from './services/review.service';

/**
 * ReviewModule — UC-22 Submit Rating & Review
 *
 * Non-global module. No providers are exported — other BCs interact with
 * Review BC only through the in-process EventBus (shared/events) and
 * (optionally, for read-only) the shared Drizzle schema barrel.
 *
 * Phase: RV-2
 */
@Module({
  imports: [DatabaseModule, CqrsModule],
  controllers: [ReviewController],
  providers: [ReviewService, ReviewRepository, SubmitReviewHandler],
  exports: [],
})
export class ReviewModule {}
