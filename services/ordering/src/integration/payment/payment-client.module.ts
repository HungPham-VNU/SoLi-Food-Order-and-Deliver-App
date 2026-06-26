import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import type { Env } from '@/config/env.schema';
import { PAYMENT_INITIATION_PORT } from '@/shared/ports/payment-initiation.port';
import { PAYMENT_TCP_CLIENT } from './payment-client.constants';
import { PaymentInitiationAdapter } from './payment-initiation.adapter';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PAYMENT_TCP_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            host: config.get('PAYMENT_TCP_HOST', { infer: true }),
            port: config.get('PAYMENT_TCP_PORT', { infer: true }),
          },
        }),
    },
    PaymentInitiationAdapter,
    {
      provide: PAYMENT_INITIATION_PORT,
      useExisting: PaymentInitiationAdapter,
    },
  ],
  exports: [PAYMENT_INITIATION_PORT],
})
export class PaymentClientModule {}
