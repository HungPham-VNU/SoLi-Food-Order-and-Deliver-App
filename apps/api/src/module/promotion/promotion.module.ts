import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '@/drizzle/drizzle.module';
import { RestaurantModule } from '@/module/restaurant-catalog/restaurant/restaurant.module';
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
 * PromotionModule — Phase PR-1 + PR-2 implementation.
 *
 * This module is marked @Global() so PROMOTION_APPLICATION_PORT is injectable
 * everywhere in the application without requiring explicit module imports.
 * This follows the same pattern as PaymentModule (@Global + DIP token).
 *
 * The @Global() decorator is justified because:
 *   - PlaceOrderHandler (Ordering BC) needs to call into Promotion BC without
 *     creating a direct module dependency (DIP / Dependency Inversion).
 *   - The port token PROMOTION_APPLICATION_PORT is the only cross-BC coupling point.
 *   - AppModule imports PromotionModule exactly once (required for @Global() modules).
 *
 * Providers:
 *   PromotionRepository         — Drizzle queries for promotions table
 *   CouponCodeRepository        — Drizzle queries for coupon_codes table
 *   PromotionUsageRepository    — Drizzle queries for promotion_usages table
 *   PromotionService            — port implementation: preview + reserve + confirm + rollback
 *   PromotionAdminService       — admin CRUD + coupon management
 *   PromotionRestaurantService  — restaurant-owner scoped management
 *   PROMOTION_APPLICATION_PORT  — DI token bound to PromotionService via useExisting
 *   PromotionReservationCleanupTask - Cleanup stale reservations
 *
 * Controllers:
 *   PromotionAdminController      — /promotions/admin/**
 *   PromotionRestaurantController — /promotions/restaurant/**
 *   PromotionPublicController     — /promotions/active, /promotions/preview, /promotions/coupons/validate
 *
 * Imports:
 *   DatabaseModule   — Drizzle DB_CONNECTION
 *   RestaurantModule — RestaurantService for restaurant ownership verification
 *
 * Exports:
 *   PromotionService             — available globally
 *   PROMOTION_APPLICATION_PORT   — available globally (injected in PlaceOrderHandler, Phase PR-3)
 *
 * Registration order in AppModule:
 *   PromotionModule must be registered BEFORE OrderingModule so that
 *   PROMOTION_APPLICATION_PORT is resolvable when PlaceOrderHandler is constructed.
 */
@Global()
@Module({
  imports: [DatabaseModule, RestaurantModule],
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
  exports: [PromotionService, PROMOTION_APPLICATION_PORT],
})
export class PromotionModule {}
