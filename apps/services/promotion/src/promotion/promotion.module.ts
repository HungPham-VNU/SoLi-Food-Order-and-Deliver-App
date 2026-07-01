import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/drizzle/database.module';
import { CatalogClientModule } from '@/integration/catalog/catalog-client.module';
import { PROMOTION_APPLICATION_PORT } from '@/shared/ports/promotion-application.port';

import { PromotionRepository } from './repositories/promotion.repository';
import { CouponCodeRepository } from './repositories/coupon-code.repository';
import { PromotionUsageRepository } from './repositories/promotion-usage.repository';
import { PromotionService } from './services/promotion.service';
import { PromotionReservationCleanupTask } from './tasks/promotion-reservation-cleanup.task';

/**
 * Promotion service. Owns the discount lifecycle
 * (preview/reserve/confirm/rollback), public active-promotion reads, and
 * restaurant/admin promotion management.
 */
@Module({
  imports: [DatabaseModule, CatalogClientModule],
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
