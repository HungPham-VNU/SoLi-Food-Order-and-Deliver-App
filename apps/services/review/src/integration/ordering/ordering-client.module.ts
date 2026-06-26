import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import type { Env } from '@/config/env.schema';
import { ORDER_ELIGIBILITY_PORT } from '@/shared/ports/order-eligibility.port';
import { ORDERING_TCP_CLIENT } from './ordering-client.constants';
import { OrderingEligibilityAdapter } from './ordering-eligibility.adapter';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: ORDERING_TCP_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            host: config.get('ORDERING_TCP_HOST', { infer: true }),
            port: config.get('ORDERING_TCP_PORT', { infer: true }),
          },
        }),
    },
    OrderingEligibilityAdapter,
    {
      provide: ORDER_ELIGIBILITY_PORT,
      useExisting: OrderingEligibilityAdapter,
    },
  ],
  exports: [ORDER_ELIGIBILITY_PORT],
})
export class OrderingClientModule {}
