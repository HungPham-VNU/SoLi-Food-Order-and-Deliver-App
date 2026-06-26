import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { DatabaseModule } from '@/drizzle/database.module';
import { OutboxModule } from '@/messaging/outbox/outbox.module';
import { OrderingClientModule } from '@/integration/ordering/ordering-client.module';
import { SubmitReviewHandler } from './commands/submit-review.handler';
import { ReviewRepository } from './repositories/review.repository';
import { ReviewService } from './services/review.service';

@Module({
  imports: [DatabaseModule, CqrsModule, OrderingClientModule, OutboxModule],
  providers: [ReviewService, ReviewRepository, SubmitReviewHandler],
  exports: [ReviewService],
})
export class ReviewModule {}
