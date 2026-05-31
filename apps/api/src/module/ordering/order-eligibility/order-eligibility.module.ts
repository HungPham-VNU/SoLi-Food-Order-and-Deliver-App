import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '@/drizzle/drizzle.module';
import { ORDER_ELIGIBILITY_PORT } from '@/shared/ports/order-eligibility.port';
import { OrderEligibilityAdapter } from './order-eligibility.adapter';

/**
 * OrderEligibilityModule
 *
 * Provides the ORDER_ELIGIBILITY_PORT binding for the entire application.
 *
 * Architecture (ADR-007 — Ports and Adapters):
 *   - Marked @Global() so ORDER_ELIGIBILITY_PORT is injectable anywhere
 *     without requiring explicit module imports in consuming modules.
 *   - Imported by OrderingModule, which is imported by AppModule — placing
 *     this module in the DI tree without requiring a separate AppModule import.
 *   - Pattern mirrors PaymentModule (@Global, exports PAYMENT_INITIATION_PORT)
 *     and PromotionModule (@Global, exports PROMOTION_APPLICATION_PORT).
 *
 * Consumers (e.g. ReviewModule / SubmitReviewHandler) inject the port via:
 *   @Inject(ORDER_ELIGIBILITY_PORT) private readonly eligibilityPort: IOrderEligibilityPort
 * without importing OrderEligibilityModule or any Ordering BC internals.
 *
 * Phase: RV-2 (architecture hardening)
 */
@Global()
@Module({
  imports: [DatabaseModule],
  providers: [
    OrderEligibilityAdapter,
    {
      provide: ORDER_ELIGIBILITY_PORT,
      useExisting: OrderEligibilityAdapter,
    },
  ],
  exports: [ORDER_ELIGIBILITY_PORT],
})
export class OrderEligibilityModule {}
