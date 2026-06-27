import { Module } from '@nestjs/common';
import { PaymentClientModule } from './payment-client.module';

/**
 * Provides PAYMENT_INITIATION_PORT to the Ordering service.
 *
 * Payment is always reached over TCP, so this unconditionally re-exports the
 * remote PaymentClientModule.
 */
@Module({
  imports: [PaymentClientModule],
  exports: [PaymentClientModule],
})
export class PaymentIntegrationModule {}
