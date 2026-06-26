import { Module } from '@nestjs/common';
import { OrderEligibilityModule } from './order-eligibility/order-eligibility.module';

@Module({
  imports: [OrderEligibilityModule],
  exports: [OrderEligibilityModule],
})
export class OrderingContractsModule {}
