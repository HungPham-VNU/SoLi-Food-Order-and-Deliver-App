import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import type { Env } from '@/config/env.schema';
import { IdentitySessionAuthenticator } from '@/identity/identity-session.authenticator';
import type { CatalogRouteOverrides } from './catalog.interfaces';
import { NestCatalogRpcClient } from './nest-catalog-rpc.client';
import { CatalogSessionGuard } from './catalog-session.guard';
import {
  CATALOG_RPC_GATEWAY,
  CATALOG_SESSION_AUTHENTICATOR,
  CATALOG_TCP_CLIENT,
} from './catalog.tokens';
import { RestaurantsController } from './restaurants.controller';
import { DeliveryZonesController } from './delivery-zones.controller';
import { MenuController } from './menu.controller';
import { ModifiersController } from './modifiers.controller';
import { NutritionController } from './nutrition.controller';
import { SearchController } from './search.controller';
import { DietaryTagsController } from './dietary-tags.controller';

/**
 * Catalog public-route ownership. Registered behind CATALOG_ROUTES_ENABLED.
 */
@Module({})
export class CatalogRoutesModule {
  static register(overrides: CatalogRouteOverrides = {}): DynamicModule {
    return {
      module: CatalogRoutesModule,
      imports: [ConfigModule],
      controllers: [
        RestaurantsController,
        DeliveryZonesController,
        MenuController,
        ModifiersController,
        NutritionController,
        SearchController,
        DietaryTagsController,
      ],
      providers: [
        {
          provide: CATALOG_TCP_CLIENT,
          inject: [ConfigService],
          useFactory: (config: ConfigService<Env, true>) =>
            ClientProxyFactory.create({
              transport: Transport.TCP,
              options: {
                host: config.get('CATALOG_TCP_HOST', { infer: true }),
                port: config.get('CATALOG_TCP_PORT', { infer: true }),
              },
            }),
        },
        NestCatalogRpcClient,
        CatalogSessionGuard,
        overrides.catalogClient
          ? { provide: CATALOG_RPC_GATEWAY, useValue: overrides.catalogClient }
          : { provide: CATALOG_RPC_GATEWAY, useExisting: NestCatalogRpcClient },
        overrides.catalogSessionAuthenticator
          ? {
              provide: CATALOG_SESSION_AUTHENTICATOR,
              useValue: overrides.catalogSessionAuthenticator,
            }
          : {
              provide: CATALOG_SESSION_AUTHENTICATOR,
              useExisting: IdentitySessionAuthenticator,
            },
      ],
    };
  }
}
