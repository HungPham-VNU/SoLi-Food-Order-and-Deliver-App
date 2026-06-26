import { Module } from '@nestjs/common';
import { PaymentModule } from '@/module/payment/payment.module';
import { PaymentClientModule } from './payment-client.module';

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  return ['1', 'true', 'yes'].includes(raw.trim().toLowerCase());
}

const selectedPaymentModule = envFlag('PAYMENT_RPC_ENABLED', false)
  ? PaymentClientModule
  : PaymentModule;

/**
 * Provides PAYMENT_INITIATION_PORT to Ordering. Defaults to the monolith
 * PaymentModule; switches to the extracted Payment TCP adapter only when
 * PAYMENT_RPC_ENABLED=true.
 */
@Module({
  imports: [selectedPaymentModule],
  exports: [selectedPaymentModule],
})
export class PaymentIntegrationModule {}
