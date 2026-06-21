import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { DatabaseModule } from '@/drizzle/drizzle.module';
import { OrderingContractsModule } from '@/module/ordering/ordering-contracts.module';
import { CatalogContractsModule } from '@/module/restaurant-catalog/catalog-contracts.module';
import { SubmitReviewHandler } from './commands/submit-review.handler';
import { ReviewController } from './controllers/review.controller';
import { ReviewRepository } from './repositories/review.repository';
import { ReviewService } from './services/review.service';

/**
 * ReviewModule — UC-22 Submit Rating & Review
 *
 * No providers are exported. Review consumes Ordering and Catalog capabilities
 * through their public contract modules and emits shared events.
 *
 * Phase: RV-2
 */
@Module({
  imports: [
    DatabaseModule,
    CqrsModule,
    OrderingContractsModule,
    CatalogContractsModule,
  ],
  controllers: [ReviewController],
  providers: [ReviewService, ReviewRepository, SubmitReviewHandler],
  exports: [],
})
export class ReviewModule {}
