import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import type { Env } from '@/config/env.schema';
import { IdentitySessionAuthenticator } from '@/identity/identity-session.authenticator';
import type { PromotionRouteOverrides } from './promotion.interfaces';
import { NestPromotionRpcClient } from './nest-promotion-rpc.client';
import { PromotionSessionGuard } from './promotion-session.guard';
import {
  PROMOTION_RPC_GATEWAY,
  PROMOTION_SESSION_AUTHENTICATOR,
  PROMOTION_TCP_CLIENT,
} from './promotion.tokens';
import { PromotionsController } from './promotions.controller';

/**
 * Promotion public-route ownership. Registered behind PROMOTION_ROUTES_ENABLED.
 */
@Module({})
export class PromotionRoutesModule {
  static register(overrides: PromotionRouteOverrides = {}): DynamicModule {
    return {
      module: PromotionRoutesModule,
      imports: [ConfigModule],
      controllers: [PromotionsController],
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
        NestPromotionRpcClient,
        PromotionSessionGuard,
        overrides.promotionClient
          ? {
              provide: PROMOTION_RPC_GATEWAY,
              useValue: overrides.promotionClient,
            }
          : {
              provide: PROMOTION_RPC_GATEWAY,
              useExisting: NestPromotionRpcClient,
            },
        overrides.promotionSessionAuthenticator
          ? {
              provide: PROMOTION_SESSION_AUTHENTICATOR,
              useValue: overrides.promotionSessionAuthenticator,
            }
          : {
              provide: PROMOTION_SESSION_AUTHENTICATOR,
              useExisting: IdentitySessionAuthenticator,
            },
      ],
    };
  }
}
