import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import type { Env } from '@/config/env.schema';
import { CATALOG_TCP_CLIENT } from './catalog-client.constants';
import { CatalogRestaurantLookupService } from './catalog-restaurant-lookup.service';

/**
 * Wires Promotion to the Catalog service over TCP so restaurant-scoped
 * promotion writes can verify the caller owns the restaurant.
 */
@Module({
  imports: [ConfigModule],
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
    CatalogRestaurantLookupService,
  ],
  exports: [CatalogRestaurantLookupService],
})
export class CatalogClientModule {}
