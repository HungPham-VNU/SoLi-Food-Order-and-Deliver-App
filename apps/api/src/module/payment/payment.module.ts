import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@/drizzle/drizzle.module';
import { vnpayConfig } from '@/config/vnpay.config';
import { PAYMENT_INITIATION_PORT } from '@/shared/ports/payment-initiation.port';
import { VNPayService } from './services/vnpay.service';
import { PaymentService } from './services/payment.service';
import { PaymentTransactionRepository } from './repositories/payment-transaction.repository';
import { PaymentController } from './controllers/payment.controller';
import { ProcessIpnHandler } from './commands/process-ipn.handler';
import { PaymentTimeoutTask } from './tasks/payment-timeout.task';
import { OrderCancelledAfterPaymentHandler } from './events/order-cancelled-after-payment.handler';

/**
 * Payment bounded context. Consumers import this module explicitly and can
 * access payment behavior only through PAYMENT_INITIATION_PORT.
 */
@Module({
  imports: [CqrsModule, DatabaseModule, ConfigModule.forFeature(vnpayConfig)],
  controllers: [PaymentController],
  providers: [
    VNPayService,
    PaymentService,
    PaymentTransactionRepository,
    ProcessIpnHandler,
    PaymentTimeoutTask,
    OrderCancelledAfterPaymentHandler,
    {
      provide: PAYMENT_INITIATION_PORT,
      useExisting: PaymentService,
    },
  ],
  exports: [PAYMENT_INITIATION_PORT],
})
export class PaymentModule {}
