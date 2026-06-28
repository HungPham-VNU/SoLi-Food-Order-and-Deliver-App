import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import type { Env } from '@/config/env.schema';
import { IdentitySessionAuthenticator } from '@/identity/identity-session.authenticator';
import type { ReviewRouteOverrides } from './review.interfaces';
import { NestReviewRpcClient } from './nest-review-rpc.client';
import { ReviewSessionGuard } from './review-session.guard';
import {
  REVIEW_RPC_GATEWAY,
  REVIEW_SESSION_AUTHENTICATOR,
  REVIEW_TCP_CLIENT,
} from './review.tokens';
import { ReviewsController } from './reviews.controller';

@Module({})
export class ReviewRoutesModule {
  static register(overrides: ReviewRouteOverrides = {}): DynamicModule {
    return {
      module: ReviewRoutesModule,
      imports: [ConfigModule],
      controllers: [ReviewsController],
      providers: [
        {
          provide: REVIEW_TCP_CLIENT,
          inject: [ConfigService],
          useFactory: (config: ConfigService<Env, true>) =>
            ClientProxyFactory.create({
              transport: Transport.TCP,
              options: {
                host: config.get('REVIEW_TCP_HOST', { infer: true }),
                port: config.get('REVIEW_TCP_PORT', { infer: true }),
              },
            }),
        },
        NestReviewRpcClient,
        ReviewSessionGuard,
        overrides.reviewClient
          ? { provide: REVIEW_RPC_GATEWAY, useValue: overrides.reviewClient }
          : { provide: REVIEW_RPC_GATEWAY, useExisting: NestReviewRpcClient },
        overrides.reviewSessionAuthenticator
          ? {
              provide: REVIEW_SESSION_AUTHENTICATOR,
              useValue: overrides.reviewSessionAuthenticator,
            }
          : {
              provide: REVIEW_SESSION_AUTHENTICATOR,
              useExisting: IdentitySessionAuthenticator,
            },
      ],
    };
  }
}
