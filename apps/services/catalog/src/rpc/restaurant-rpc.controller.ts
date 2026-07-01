import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CATALOG_RPC_PATTERNS } from '@uitfood/contracts';
import { RestaurantService } from '@/restaurant/restaurant.service';
import { InternalAuthService } from '@/auth/internal-auth.service';
import type {
  CreateRestaurantDto,
  UpdateRestaurantDto,
} from '@/restaurant/dto/restaurant.dto';
import type { CreateImageDto } from '@/shared/contracts/image.dto';
import { asCatalogRpcException } from './catalog-rpc.errors';

interface Paginated {
  offset?: number;
  limit?: number;
}
interface Mutation {
  internalAuth: string;
}

@Controller()
export class RestaurantRpcController {
  constructor(
    private readonly service: RestaurantService,
    private readonly auth: InternalAuthService,
  ) {}

  @MessagePattern(CATALOG_RPC_PATTERNS.listRestaurants)
  async list(@Payload() p: Paginated) {
    try {
      return await this.service.findAll(p.offset, p.limit);
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.listRestaurantsAdmin)
  async listAdmin(@Payload() p: Paginated & Mutation) {
    try {
      this.auth.verifyCatalogToken(p.internalAuth);
      return await this.service.findAllAdmin(p.offset, p.limit);
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.getRestaurant)
  async get(@Payload() p: { id: string }) {
    try {
      return await this.service.findOne(p.id);
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.getRestaurantByOwner)
  async getByOwner(@Payload() p: { ownerId: string }) {
    try {
      return await this.service.findMine(p.ownerId);
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.createRestaurant)
  async create(@Payload() p: Mutation & { dto: CreateRestaurantDto }) {
    try {
      const caller = this.auth.verifyCatalogToken(p.internalAuth);
      return await this.service.create(caller.userId, p.dto);
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.updateRestaurant)
  async update(
    @Payload() p: Mutation & { id: string; dto: UpdateRestaurantDto },
  ) {
    try {
      const caller = this.auth.verifyCatalogToken(p.internalAuth);
      return await this.service.update(
        p.id,
        caller.userId,
        caller.isAdmin,
        p.dto,
      );
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.setRestaurantApproved)
  async setApproved(
    @Payload() p: Mutation & { id: string; isApproved: boolean },
  ) {
    try {
      this.auth.verifyCatalogToken(p.internalAuth);
      return await this.service.setApproved(p.id, p.isApproved);
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.removeRestaurant)
  async remove(@Payload() p: Mutation & { id: string }) {
    try {
      this.auth.verifyCatalogToken(p.internalAuth);
      await this.service.remove(p.id);
      return { id: p.id, removed: true };
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.attachRestaurantLogo)
  async attachLogo(
    @Payload() p: Mutation & { id: string; image: CreateImageDto },
  ) {
    try {
      const caller = this.auth.verifyCatalogToken(p.internalAuth);
      return await this.service.updateLogoImage(
        p.id,
        caller.userId,
        caller.isAdmin,
        p.image,
      );
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.attachRestaurantCover)
  async attachCover(
    @Payload() p: Mutation & { id: string; image: CreateImageDto },
  ) {
    try {
      const caller = this.auth.verifyCatalogToken(p.internalAuth);
      return await this.service.updateCoverImage(
        p.id,
        caller.userId,
        caller.isAdmin,
        p.image,
      );
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }
}
