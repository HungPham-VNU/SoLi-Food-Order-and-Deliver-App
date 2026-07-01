import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CATALOG_RPC_PATTERNS } from '@uitfood/contracts';
import { MenuService } from '@/menu/menu.service';
import { InternalAuthService } from '@/auth/internal-auth.service';
import type {
  CreateMenuItemDto,
  UpdateMenuItemDto,
  CreateMenuCategoryDto,
  UpdateMenuCategoryDto,
  MenuItemStatusFilter,
} from '@/menu/dto/menu.dto';
import type { CreateImageDto } from '@/shared/contracts/image.dto';
import { asCatalogRpcException } from './catalog-rpc.errors';

interface Mutation {
  internalAuth: string;
}

@Controller()
export class MenuRpcController {
  constructor(
    private readonly service: MenuService,
    private readonly auth: InternalAuthService,
  ) {}

  // --- Items ---

  @MessagePattern(CATALOG_RPC_PATTERNS.listMenuItems)
  async list(
    @Payload()
    p: {
      restaurantId: string;
      categoryId?: string;
      status?: MenuItemStatusFilter;
      offset?: number;
      limit?: number;
    },
  ) {
    try {
      return await this.service.findByRestaurant(p.restaurantId, {
        categoryId: p.categoryId,
        status: p.status,
        offset: p.offset,
        limit: p.limit,
      });
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.getMenuItem)
  async get(@Payload() p: { id: string }) {
    try {
      return await this.service.findOne(p.id);
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.createMenuItem)
  async create(@Payload() p: Mutation & { dto: CreateMenuItemDto }) {
    try {
      const c = this.auth.verifyCatalogToken(p.internalAuth);
      return await this.service.create(c.userId, c.isAdmin, p.dto);
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.updateMenuItem)
  async update(
    @Payload() p: Mutation & { id: string; dto: UpdateMenuItemDto },
  ) {
    try {
      const c = this.auth.verifyCatalogToken(p.internalAuth);
      return await this.service.update(p.id, c.userId, c.isAdmin, p.dto);
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.updateMenuItemImage)
  async updateImage(
    @Payload() p: Mutation & { id: string; image: CreateImageDto },
  ) {
    try {
      const c = this.auth.verifyCatalogToken(p.internalAuth);
      return await this.service.updateImage(p.id, c.userId, c.isAdmin, p.image);
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.toggleMenuItemSoldOut)
  async toggleSoldOut(@Payload() p: Mutation & { id: string }) {
    try {
      const c = this.auth.verifyCatalogToken(p.internalAuth);
      return await this.service.toggleSoldOut(p.id, c.userId, c.isAdmin);
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.removeMenuItem)
  async remove(@Payload() p: Mutation & { id: string }) {
    try {
      const c = this.auth.verifyCatalogToken(p.internalAuth);
      await this.service.remove(p.id, c.userId, c.isAdmin);
      return { id: p.id, removed: true };
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  // --- Categories ---

  @MessagePattern(CATALOG_RPC_PATTERNS.listMenuCategories)
  async listCategories(@Payload() p: { restaurantId: string }) {
    try {
      return await this.service.findCategoriesByRestaurant(p.restaurantId);
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.createMenuCategory)
  async createCategory(
    @Payload() p: Mutation & { dto: CreateMenuCategoryDto },
  ) {
    try {
      const c = this.auth.verifyCatalogToken(p.internalAuth);
      return await this.service.createCategory(c.userId, c.isAdmin, p.dto);
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.updateMenuCategory)
  async updateCategory(
    @Payload() p: Mutation & { id: string; dto: UpdateMenuCategoryDto },
  ) {
    try {
      const c = this.auth.verifyCatalogToken(p.internalAuth);
      return await this.service.updateCategory(
        p.id,
        c.userId,
        c.isAdmin,
        p.dto,
      );
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.removeMenuCategory)
  async removeCategory(@Payload() p: Mutation & { id: string }) {
    try {
      const c = this.auth.verifyCatalogToken(p.internalAuth);
      await this.service.removeCategory(p.id, c.userId, c.isAdmin);
      return { id: p.id, removed: true };
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }
}
