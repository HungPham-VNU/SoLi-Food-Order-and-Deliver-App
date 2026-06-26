import { Module } from '@nestjs/common';
import { PaymentClientModule } from './payment-client.module';

/**
 * Provides PAYMENT_INITIATION_PORT to the Ordering service.
 *
 * In the extracted topology Payment is always reached over TCP — there is no
 * in-process Payment module — so this unconditionally re-exports the remote
 * PaymentClientModule. (In the monolith this module flag-switched between the
 * local PaymentModule and the remote adapter.)
 */
@Module({
  imports: [PaymentClientModule],
  exports: [PaymentClientModule],
})
export class PaymentIntegrationModule {}
