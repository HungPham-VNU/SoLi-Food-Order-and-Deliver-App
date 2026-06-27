import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/drizzle/database.module';
import { PROMOTION_APPLICATION_PORT } from '@/shared/ports/promotion-application.port';

import { PromotionRepository } from './repositories/promotion.repository';
import { CouponCodeRepository } from './repositories/coupon-code.repository';
import { PromotionUsageRepository } from './repositories/promotion-usage.repository';
import { PromotionService } from './services/promotion.service';
import { PromotionReservationCleanupTask } from './tasks/promotion-reservation-cleanup.task';

/**
 * Promotion service. Owns the discount lifecycle
 * (preview/reserve/confirm/rollback) and public active-promotion reads.
 */
@Module({
  imports: [DatabaseModule],
  providers: [
    PromotionRepository,
    CouponCodeRepository,
    PromotionUsageRepository,
    PromotionService,
    PromotionReservationCleanupTask,
    {
      provide: PROMOTION_APPLICATION_PORT,
      useExisting: PromotionService,
    },
  ],
  exports: [PROMOTION_APPLICATION_PORT, PromotionService],
})
export class PromotionModule {}
