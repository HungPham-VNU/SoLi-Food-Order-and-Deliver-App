import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CATALOG_RPC_PATTERNS } from '@uitfood/contracts';
import { ZonesService } from '@/restaurant/zones/zones.service';
import { InternalAuthService } from '@/auth/internal-auth.service';
import type { Coordinates } from '@/lib/geo/geo.service';
import type {
  CreateDeliveryZoneDto,
  UpdateDeliveryZoneDto,
} from '@/restaurant/zones/zones.dto';
import { asCatalogRpcException } from './catalog-rpc.errors';

interface Mutation {
  internalAuth: string;
}

@Controller()
export class ZonesRpcController {
  constructor(
    private readonly service: ZonesService,
    private readonly auth: InternalAuthService,
  ) {}

  @MessagePattern(CATALOG_RPC_PATTERNS.listDeliveryZones)
  async list(@Payload() p: { restaurantId: string }) {
    try {
      return await this.service.findByRestaurant(p.restaurantId);
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.estimateDelivery)
  async estimate(
    @Payload() p: { restaurantId: string; coordinates: Coordinates },
  ) {
    try {
      return await this.service.estimateDelivery(p.restaurantId, p.coordinates);
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.createDeliveryZone)
  async create(
    @Payload()
    p: Mutation & { restaurantId: string; dto: CreateDeliveryZoneDto },
  ) {
    try {
      const c = this.auth.verifyCatalogToken(p.internalAuth);
      return await this.service.create(
        p.restaurantId,
        c.userId,
        c.isAdmin,
        p.dto,
      );
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.updateDeliveryZone)
  async update(
    @Payload()
    p: Mutation & {
      id: string;
      restaurantId: string;
      dto: UpdateDeliveryZoneDto;
    },
  ) {
    try {
      const c = this.auth.verifyCatalogToken(p.internalAuth);
      return await this.service.update(
        p.id,
        p.restaurantId,
        c.userId,
        c.isAdmin,
        p.dto,
      );
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.removeDeliveryZone)
  async remove(@Payload() p: Mutation & { id: string; restaurantId: string }) {
    try {
      const c = this.auth.verifyCatalogToken(p.internalAuth);
      await this.service.remove(p.id, p.restaurantId, c.userId, c.isAdmin);
      return { id: p.id, removed: true };
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }
}
