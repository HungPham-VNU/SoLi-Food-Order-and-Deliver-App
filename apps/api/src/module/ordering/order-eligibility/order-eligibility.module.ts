import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/drizzle/drizzle.module';
import { ORDER_ELIGIBILITY_PORT } from '@/shared/ports/order-eligibility.port';
import { OrderEligibilityAdapter } from './order-eligibility.adapter';

/**
 * Public Ordering capability module for review eligibility and review markers.
 * Consumers import OrderingContractsModule instead of Ordering internals.
 */
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
