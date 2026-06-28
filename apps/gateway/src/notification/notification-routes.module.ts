import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { IdentitySessionAuthenticator } from '@/identity/identity-session.authenticator';
import type { Env } from '@/config/env.schema';
import type { NotificationRouteOverrides } from './notification.interfaces';
import { NestNotificationRpcClient } from './nest-notification-rpc.client';
import { NotificationController } from './notification.controller';
import { NotificationSessionGuard } from './notification-session.guard';
import {
  NOTIFICATION_RPC_GATEWAY,
  NOTIFICATION_SESSION_AUTHENTICATOR,
  NOTIFICATION_TCP_CLIENT,
} from './notification.tokens';

@Module({})
export class NotificationRoutesModule {
  static register(overrides: NotificationRouteOverrides = {}): DynamicModule {
    return {
      module: NotificationRoutesModule,
      imports: [ConfigModule],
      controllers: [NotificationController],
      providers: [
        {
          provide: NOTIFICATION_TCP_CLIENT,
          inject: [ConfigService],
          useFactory: (config: ConfigService<Env, true>) =>
            ClientProxyFactory.create({
              transport: Transport.TCP,
              options: {
                host: config.get('NOTIFICATION_TCP_HOST', { infer: true }),
                port: config.get('NOTIFICATION_TCP_PORT', { infer: true }),
              },
            }),
        },
        NestNotificationRpcClient,
        NotificationSessionGuard,
        overrides.notificationClient
          ? {
              provide: NOTIFICATION_RPC_GATEWAY,
              useValue: overrides.notificationClient,
            }
          : {
              provide: NOTIFICATION_RPC_GATEWAY,
              useExisting: NestNotificationRpcClient,
            },
        overrides.notificationSessionAuthenticator
          ? {
              provide: NOTIFICATION_SESSION_AUTHENTICATOR,
              useValue: overrides.notificationSessionAuthenticator,
            }
          : {
              provide: NOTIFICATION_SESSION_AUTHENTICATOR,
              useExisting: IdentitySessionAuthenticator,
            },
      ],
    };
  }
}
