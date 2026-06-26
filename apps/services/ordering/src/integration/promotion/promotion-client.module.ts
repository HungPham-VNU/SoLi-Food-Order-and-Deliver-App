import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import type { Env } from '@/config/env.schema';
import { PROMOTION_APPLICATION_PORT } from '@/shared/ports/promotion-application.port';
import { PROMOTION_TCP_CLIENT } from './promotion-client.constants';
import { PromotionApplicationAdapter } from './promotion-application.adapter';

/**
 * Wires Ordering to the extracted Promotion service over TCP. Provides the same
 * PROMOTION_APPLICATION_PORT token the local PromotionModule used to export, so
 * PlaceOrderHandler and the cancellation rollback handler are unchanged.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PROMOTION_TCP_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            host: config.get('PROMOTION_TCP_HOST', { infer: true }),
            port: config.get('PROMOTION_TCP_PORT', { infer: true }),
          },
        }),
    },
    PromotionApplicationAdapter,
    {
      provide: PROMOTION_APPLICATION_PORT,
      useExisting: PromotionApplicationAdapter,
    },
  ],
  exports: [PROMOTION_APPLICATION_PORT],
})
export class PromotionClientModule {}
