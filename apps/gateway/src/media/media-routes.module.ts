import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import type { Env } from '@/config/env.schema';
import { CloudinaryController } from './cloudinary.controller';
import { IdentitySessionAuthenticator } from '@/identity/identity-session.authenticator';
import { GatewaySessionGuard } from './gateway-session.guard';
import { MediaController } from './media.controller';
import type { MediaRouteOverrides } from './media.interfaces';
import { NestMediaRpcClient } from './nest-media-rpc.client';
import {
  MEDIA_RPC_GATEWAY,
  MEDIA_TCP_CLIENT,
  SESSION_AUTHENTICATOR,
} from './media.tokens';

@Module({})
export class MediaRoutesModule {
  static register(overrides: MediaRouteOverrides = {}): DynamicModule {
    return {
      module: MediaRoutesModule,
      imports: [ConfigModule],
      controllers: [MediaController, CloudinaryController],
      providers: [
        {
          provide: MEDIA_TCP_CLIENT,
          inject: [ConfigService],
          useFactory: (config: ConfigService<Env, true>) =>
            ClientProxyFactory.create({
              transport: Transport.TCP,
              options: {
                host: config.get('MEDIA_TCP_HOST', { infer: true }),
                port: config.get('MEDIA_TCP_PORT', { infer: true }),
              },
            }),
        },
        NestMediaRpcClient,
        IdentitySessionAuthenticator,
        GatewaySessionGuard,
        overrides.mediaClient
          ? { provide: MEDIA_RPC_GATEWAY, useValue: overrides.mediaClient }
          : { provide: MEDIA_RPC_GATEWAY, useExisting: NestMediaRpcClient },
        overrides.sessionAuthenticator
          ? {
              provide: SESSION_AUTHENTICATOR,
              useValue: overrides.sessionAuthenticator,
            }
          : {
              provide: SESSION_AUTHENTICATOR,
              useExisting: IdentitySessionAuthenticator,
            },
      ],
    };
  }
}
