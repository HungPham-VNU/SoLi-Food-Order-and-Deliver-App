import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  createEnvelope,
  CATALOG_MENU_ITEM_CHANGED_V1,
} from '@uitfood/contracts';
import { CATALOG_DATABASE } from '@/drizzle/database.constants';
import { OutboxWriter } from '@/messaging/outbox/outbox.writer';
import type { DrizzleExecutor } from '@/messaging/drizzle-executor';
import {
  MenuRepository,
  type MenuItemDetail,
  type PaginatedMenuItems,
} from './menu.repository';
import type {
  CreateMenuItemDto,
  UpdateMenuItemDto,
  CreateMenuCategoryDto,
  UpdateMenuCategoryDto,
  MenuItemStatusFilter,
} from './dto/menu.dto';
import type { MenuItem, MenuCategory } from '@/menu/menu.schema';
import { RestaurantService } from '@/restaurant/restaurant.service';
import {
  IMAGE_MANAGEMENT_PORT,
  type IImageManagementPort,
} from '@/shared/ports/image-management.port';
import type { CreateImageDto } from '@/shared/contracts/image.dto';
import type { MenuItemModifierSnapshot } from '@/shared/events/menu-item-updated.event';

export interface FindByRestaurantOptions {
  categoryId?: string;
  status?: MenuItemStatusFilter;
  offset?: number;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Pagination constants
// ---------------------------------------------------------------------------
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

@Injectable()
export class MenuService {
  constructor(
    private readonly repo: MenuRepository,
    private readonly restaurantService: RestaurantService,
    @Inject(CATALOG_DATABASE) private readonly db: NodePgDatabase,
    private readonly outbox: OutboxWriter,
    @Inject(IMAGE_MANAGEMENT_PORT)
    private readonly imageService: IImageManagementPort,
  ) {}

  // -------------------------------------------------------------------------
  // Menu Items
  // -------------------------------------------------------------------------

  async findByRestaurant(
    restaurantId: string,
    opts: FindByRestaurantOptions = {},
  ): Promise<PaginatedMenuItems> {
    await this.restaurantService.findOne(restaurantId);
    const safeLimit = Math.min(opts.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    return this.repo.findByRestaurant(restaurantId, {
      ...opts,
      limit: safeLimit,
    });
  }

  async findOne(id: string): Promise<MenuItemDetail> {
    const item = await this.repo.findById(id);
    if (!item) {
      throw new NotFoundException(`Menu item ${id} not found`);
    }
    return item;
  }

  async create(
    requesterId: string,
    isAdmin: boolean,
    dto: CreateMenuItemDto,
  ): Promise<MenuItem> {
    const restaurant = await this.restaurantService.findOne(dto.restaurantId);
    if (!isAdmin && restaurant.ownerId !== requesterId) {
      throw new ForbiddenException('You do not own this restaurant');
    }
    return this.db.transaction(async (tx) => {
      const item = await this.repo.create(dto, tx);
      await this.writeMenuItemOutbox(tx, item, []);
      return item;
    });
  }

  async update(
    id: string,
    requesterId: string,
    isAdmin: boolean,
    dto: UpdateMenuItemDto,
  ): Promise<MenuItem> {
    await this.assertOwnership(id, requesterId, isAdmin);
    return this.db.transaction(async (tx) => {
      const item = await this.repo.update(id, dto, tx);
      // null = no modifier data; projector preserves existing snapshot modifiers.
      await this.writeMenuItemOutbox(tx, item, null);
      return item;
    });
  }

  async updateImage(
    id: string,
    requesterId: string,
    isAdmin: boolean,
    dto: CreateImageDto,
  ): Promise<MenuItem> {
    await this.assertOwnership(id, requesterId, isAdmin);
    await this.imageService.create(dto);
    return this.db.transaction(async (tx) => {
      const item = await this.repo.update(id, { imageUrl: dto.secureUrl }, tx);
      await this.writeMenuItemOutbox(tx, item, null);
      return item;
    });
  }

  async toggleSoldOut(
    id: string,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<MenuItem> {
    const item = await this.assertOwnership(id, requesterId, isAdmin);
    if (item.status === 'unavailable') {
      throw new ConflictException(
        'Cannot toggle sold-out on an unavailable item; mark it available first',
      );
    }
    const nextStatus =
      item.status === 'out_of_stock' ? 'available' : 'out_of_stock';
    return this.db.transaction(async (tx) => {
      const updated = await this.repo.update(id, { status: nextStatus }, tx);
      await this.writeMenuItemOutbox(tx, updated, null);
      return updated;
    });
  }

  async remove(
    id: string,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<void> {
    const item = await this.assertOwnership(id, requesterId, isAdmin);
    await this.db.transaction(async (tx) => {
      await this.repo.remove(id, tx);
      // Force 'unavailable' so the Ordering snapshot is invalidated on delete.
      await this.outbox.write(
        tx,
        this.buildMenuItemEnvelope({ ...item, status: 'unavailable' }, []),
      );
    });
  }

  /**
   * Fixed S-2: uses `status` as the single source of truth.
   * `isAvailable` field has been removed from the schema.
   */
  async assertItemAvailable(id: string): Promise<MenuItem> {
    const item = await this.findOne(id);
    if (item.status !== 'available') {
      const reason =
        item.status === 'out_of_stock' ? 'out of stock' : 'unavailable';
      throw new ConflictException(`Item is ${reason}`);
    }
    return item;
  }

  // -------------------------------------------------------------------------
  // Menu Categories
  // -------------------------------------------------------------------------

  async findCategoriesByRestaurant(
    restaurantId: string,
  ): Promise<MenuCategory[]> {
    await this.restaurantService.findOne(restaurantId);

    return this.repo.findCategoriesByRestaurant(restaurantId);
  }

  async createCategory(
    requesterId: string,
    isAdmin: boolean,
    dto: CreateMenuCategoryDto,
  ): Promise<MenuCategory> {
    const restaurant = await this.restaurantService.findOne(dto.restaurantId);
    if (!isAdmin && restaurant.ownerId !== requesterId) {
      throw new ForbiddenException('You do not own this restaurant');
    }
    return this.repo.createCategory(dto);
  }

  async updateCategory(
    id: string,
    requesterId: string,
    isAdmin: boolean,
    dto: UpdateMenuCategoryDto,
  ): Promise<MenuCategory> {
    const category = await this.repo.findCategoryById(id);
    if (!category) throw new NotFoundException(`Category ${id} not found`);
    const restaurant = await this.restaurantService.findOne(
      category.restaurantId,
    );
    if (!isAdmin && restaurant.ownerId !== requesterId) {
      throw new ForbiddenException('You do not own this restaurant');
    }
    return this.repo.updateCategory(id, dto);
  }

  async removeCategory(
    id: string,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<void> {
    const category = await this.repo.findCategoryById(id);
    if (!category) throw new NotFoundException(`Category ${id} not found`);
    const restaurant = await this.restaurantService.findOne(
      category.restaurantId,
    );
    if (!isAdmin && restaurant.ownerId !== requesterId) {
      throw new ForbiddenException('You do not own this restaurant');
    }
    await this.repo.removeCategory(id);
  }

  // -------------------------------------------------------------------------
  // Event publishing (called by MenuService and injected into ModifiersService)
  // -------------------------------------------------------------------------

  /**
   * Builds the catalog.menu-item.changed.v1 envelope for an item + modifier
   * snapshot. `modifiers === null` tells the projector to preserve existing
   * snapshot modifiers; `[]` means no modifier groups.
   */
  buildMenuItemEnvelope(
    item: MenuItem,
    modifiers: MenuItemModifierSnapshot[] | null,
  ) {
    return createEnvelope({
      eventType: CATALOG_MENU_ITEM_CHANGED_V1.eventType,
      eventVersion: CATALOG_MENU_ITEM_CHANGED_V1.eventVersion,
      aggregateId: item.id,
      aggregateVersion: 0,
      producer: 'catalog',
      payload: {
        menuItemId: item.id,
        restaurantId: item.restaurantId,
        name: item.name,
        price: item.price,
        status: item.status,
        modifiers,
      },
    });
  }

  /**
   * Records a menu-item-changed event in the outbox within the caller's
   * transaction. Reused by ModifiersService so modifier mutations stay atomic
   * with the event they produce.
   */
  writeMenuItemOutbox(
    tx: DrizzleExecutor,
    item: MenuItem,
    modifiers: MenuItemModifierSnapshot[] | null,
  ): Promise<void> {
    return this.outbox.write(tx, this.buildMenuItemEnvelope(item, modifiers));
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async assertOwnership(
    itemId: string,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<MenuItem> {
    const item = await this.findOne(itemId);
    if (!isAdmin) {
      const restaurant = await this.restaurantService.findOne(
        item.restaurantId,
      );
      if (restaurant.ownerId !== requesterId) {
        throw new ForbiddenException('You do not own this restaurant');
      }
    }
    return item;
  }
}
