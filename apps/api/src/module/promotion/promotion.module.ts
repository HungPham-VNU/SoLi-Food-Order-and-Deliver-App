import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/drizzle/drizzle.module';
import { CatalogContractsModule } from '@/module/restaurant-catalog/catalog-contracts.module';
import { PROMOTION_APPLICATION_PORT } from '@/shared/ports/promotion-application.port';

import { PromotionRepository } from './repositories/promotion.repository';
import { CouponCodeRepository } from './repositories/coupon-code.repository';
import { PromotionUsageRepository } from './repositories/promotion-usage.repository';

import { PromotionService } from './services/promotion.service';
import { PromotionAdminService } from './services/promotion-admin.service';
import { PromotionRestaurantService } from './services/promotion-restaurant.service';

import { PromotionAdminController } from './controllers/promotion-admin.controller';
import { PromotionRestaurantController } from './controllers/promotion-restaurant.controller';
import { PromotionPublicController } from './controllers/promotion-public.controller';

import { PromotionReservationCleanupTask } from './tasks/promotion-reservation-cleanup.task';

/**
 * Promotion bounded context. Consumers import this module explicitly and can
 * apply promotions only through PROMOTION_APPLICATION_PORT.
 */
@Module({
  imports: [DatabaseModule, CatalogContractsModule],
  controllers: [
    PromotionAdminController,
    PromotionRestaurantController,
    PromotionPublicController,
  ],
  providers: [
    PromotionRepository,
    CouponCodeRepository,
    PromotionUsageRepository,
    PromotionService,
    PromotionAdminService,
    PromotionRestaurantService,
    PromotionReservationCleanupTask,
    {
      provide: PROMOTION_APPLICATION_PORT,
      useExisting: PromotionService,
    },
  ],
  exports: [PROMOTION_APPLICATION_PORT],
})
export class PromotionModule {}
