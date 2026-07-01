import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import {
  CATALOG_RPC_PATTERNS,
  catalogRpcErrorSchema,
} from '@uitfood/contracts';
import type { Env } from '@/config/env.schema';
import { CATALOG_TCP_CLIENT } from './catalog-client.constants';

interface CatalogRestaurant {
  id: string;
  ownerId: string;
}

/**
 * Read-only lookup into the Catalog BC — resolves a restaurant's ownerId so
 * PromotionService can verify that the caller of a restaurant-scoped
 * promotion write actually owns that restaurant before touching the DB.
 *
 * Cross-context call (not an ACL projection): Promotion has no local
 * restaurant snapshot, and ownership checks are infrequent (write paths
 * only), so a synchronous RPC to Catalog's existing catalog.restaurant.get.v1
 * is the smallest correct option here.
 */
@Injectable()
export class CatalogRestaurantLookupService implements OnApplicationShutdown {
  private readonly logger = new Logger(CatalogRestaurantLookupService.name);

  constructor(
    @Inject(CATALOG_TCP_CLIENT) private readonly client: ClientProxy,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }

  /** Throws NotFoundException if the restaurant does not exist in Catalog. */
  async getOwnerId(restaurantId: string): Promise<string> {
    const timeoutMs = this.config.get('CATALOG_RPC_TIMEOUT_MS', {
      infer: true,
    });
    try {
      const restaurant = await firstValueFrom(
        this.client
          .send<CatalogRestaurant>(CATALOG_RPC_PATTERNS.getRestaurant, {
            id: restaurantId,
          })
          .pipe(timeout(timeoutMs)),
      );
      return restaurant.ownerId;
    } catch (error) {
      const rpcError = catalogRpcErrorSchema.safeParse(error);
      if (rpcError.success) {
        if (rpcError.data.statusCode === 404) {
          throw new NotFoundException(`Restaurant ${restaurantId} not found`);
        }
        throw new ServiceUnavailableException(rpcError.data.message);
      }
      this.logger.error(
        `Catalog getRestaurant(${restaurantId}) failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new ServiceUnavailableException('Catalog service is unavailable.');
    }
  }
}
