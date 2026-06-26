import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import type { Env } from '@/config/env.schema';
import { IdentitySessionAuthenticator } from '@/identity/identity-session.authenticator';
import { MonolithSessionAuthenticator } from '@/media/monolith-session.authenticator';
import type { OrderingRouteOverrides } from './ordering.interfaces';
import { NestOrderingRpcClient } from './nest-ordering-rpc.client';
import { OrderingSessionGuard } from './ordering-session.guard';
import {
  ORDERING_RPC_GATEWAY,
  ORDERING_SESSION_AUTHENTICATOR,
  ORDERING_TCP_CLIENT,
} from './ordering.tokens';
import { CartsController } from './carts.controller';
import { OrdersController } from './orders.controller';
import {
  RestaurantOrdersController,
  ShipperOrdersController,
  AdminOrdersController,
  OrderingPaymentsController,
} from './order-actors.controllers';

/**
 * Ordering public-route ownership. Registered behind ORDERING_ROUTES_ENABLED;
 * when off, these paths fall through to the monolith proxy.
 */
@Module({})
export class OrderingRoutesModule {
  static register(overrides: OrderingRouteOverrides = {}): DynamicModule {
    return {
      module: OrderingRoutesModule,
      imports: [ConfigModule],
      controllers: [
        CartsController,
        OrdersController,
        RestaurantOrdersController,
        ShipperOrdersController,
        AdminOrdersController,
        OrderingPaymentsController,
      ],
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
        NestOrderingRpcClient,
        MonolithSessionAuthenticator,
        OrderingSessionGuard,
        overrides.orderingClient
          ? { provide: ORDERING_RPC_GATEWAY, useValue: overrides.orderingClient }
          : { provide: ORDERING_RPC_GATEWAY, useExisting: NestOrderingRpcClient },
        overrides.orderingSessionAuthenticator
          ? {
              provide: ORDERING_SESSION_AUTHENTICATOR,
              useValue: overrides.orderingSessionAuthenticator,
            }
          : {
              provide: ORDERING_SESSION_AUTHENTICATOR,
              inject: [
                ConfigService,
                IdentitySessionAuthenticator,
                MonolithSessionAuthenticator,
              ],
              useFactory: (
                config: ConfigService<Env, true>,
                identity: IdentitySessionAuthenticator,
                monolith: MonolithSessionAuthenticator,
              ) =>
                config.get('IDENTITY_ROUTES_ENABLED', { infer: true })
                  ? identity
                  : monolith,
            },
      ],
    };
  }
}
