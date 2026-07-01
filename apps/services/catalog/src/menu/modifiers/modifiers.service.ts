import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CATALOG_DATABASE } from '@/drizzle/database.constants';
import type { DrizzleExecutor } from '@/messaging/drizzle-executor';
import {
  ModifierGroupRepository,
  ModifierOptionRepository,
} from './modifiers.repository';
import { MenuRepository } from '@/menu/menu.repository';
import { RestaurantService } from '@/restaurant/restaurant.service';
import { MenuService } from '@/menu/menu.service';
import type { ModifierGroup, ModifierOption } from '@/menu/menu.schema';
import type {
  CreateModifierGroupDto,
  UpdateModifierGroupDto,
  CreateModifierOptionDto,
  UpdateModifierOptionDto,
  ModifierGroupResponseDto,
} from './modifiers.dto';
import type { MenuItemModifierSnapshot } from '@/shared/events/menu-item-updated.event';

@Injectable()
export class ModifiersService {
  constructor(
    private readonly groupRepo: ModifierGroupRepository,
    private readonly optionRepo: ModifierOptionRepository,
    private readonly menuRepo: MenuRepository,
    private readonly restaurantService: RestaurantService,
    private readonly menuService: MenuService,
    @Inject(CATALOG_DATABASE) private readonly db: NodePgDatabase,
  ) {}

  // -------------------------------------------------------------------------
  // Read
  // -------------------------------------------------------------------------

  /**
   * Returns all modifier groups for a menu item, each with their options embedded.
   */
  async findGroupsByMenuItem(
    menuItemId: string,
  ): Promise<ModifierGroupResponseDto[]> {
    await this.requireMenuItem(menuItemId);
    return this.buildGroupsWithOptions(menuItemId);
  }

  async findGroup(groupId: string, menuItemId: string): Promise<ModifierGroup> {
    const group = await this.groupRepo.findById(groupId);
    if (!group || group.menuItemId !== menuItemId) {
      throw new NotFoundException('Modifier group not found');
    }
    return group;
  }

  async findOption(optionId: string, groupId: string): Promise<ModifierOption> {
    const option = await this.optionRepo.findById(optionId);
    if (!option || option.groupId !== groupId) {
      throw new NotFoundException('Modifier option not found');
    }
    return option;
  }

  /**
   * Returns a single modifier group with its options embedded.
   * Used by GET /:groupId controller endpoint.
   */
  async findGroupWithOptions(
    groupId: string,
    menuItemId: string,
  ): Promise<ModifierGroupResponseDto> {
    const group = await this.findGroup(groupId, menuItemId); // validates group belongs to item
    const options = await this.optionRepo.findByGroup(groupId);
    return { ...group, options };
  }

  /**
   * Returns all options belonging to a modifier group.
   * Used by GET /:groupId/options controller endpoint.
   */
  async findOptionsByGroup(
    groupId: string,
    menuItemId: string,
  ): Promise<ModifierOption[]> {
    await this.findGroup(groupId, menuItemId); // validates group belongs to menu item
    return this.optionRepo.findByGroup(groupId);
  }

  // -------------------------------------------------------------------------
  // Modifier Groups
  // -------------------------------------------------------------------------

  async createGroup(
    menuItemId: string,
    requesterId: string,
    isAdmin: boolean,
    dto: CreateModifierGroupDto,
  ): Promise<ModifierGroup> {
    await this.assertMenuItemOwnership(menuItemId, requesterId, isAdmin);
    this.validateMinMax(dto.minSelections ?? 0, dto.maxSelections ?? 1);
    return this.db.transaction(async (tx) => {
      const group = await this.groupRepo.create(menuItemId, dto, tx);
      await this.writeMenuItemOutbox(tx, menuItemId);
      return group;
    });
  }

  async updateGroup(
    groupId: string,
    menuItemId: string,
    requesterId: string,
    isAdmin: boolean,
    dto: UpdateModifierGroupDto,
  ): Promise<ModifierGroup> {
    const existing = await this.findGroup(groupId, menuItemId); // existence check + fetch current values
    await this.assertMenuItemOwnership(menuItemId, requesterId, isAdmin);
    // Merge DTO values with existing record before validation (PartialType — either field may be absent)
    const resolvedMin = dto.minSelections ?? existing.minSelections;
    const resolvedMax = dto.maxSelections ?? existing.maxSelections;
    this.validateMinMax(resolvedMin, resolvedMax);
    return this.db.transaction(async (tx) => {
      const group = await this.groupRepo.update(groupId, dto, tx);
      await this.writeMenuItemOutbox(tx, menuItemId);
      return group;
    });
  }

  async removeGroup(
    groupId: string,
    menuItemId: string,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<void> {
    await this.findGroup(groupId, menuItemId); // existence check
    await this.assertMenuItemOwnership(menuItemId, requesterId, isAdmin);
    await this.db.transaction(async (tx) => {
      await this.groupRepo.remove(groupId, tx);
      await this.writeMenuItemOutbox(tx, menuItemId);
    });
  }

  // -------------------------------------------------------------------------
  // Modifier Options
  // -------------------------------------------------------------------------

  async createOption(
    groupId: string,
    menuItemId: string,
    requesterId: string,
    isAdmin: boolean,
    dto: CreateModifierOptionDto,
  ): Promise<ModifierOption> {
    await this.findGroup(groupId, menuItemId); // group belongs to item
    await this.assertMenuItemOwnership(menuItemId, requesterId, isAdmin);
    return this.db.transaction(async (tx) => {
      const option = await this.optionRepo.create(groupId, dto, tx);
      await this.writeMenuItemOutbox(tx, menuItemId);
      return option;
    });
  }

  async updateOption(
    optionId: string,
    groupId: string,
    menuItemId: string,
    requesterId: string,
    isAdmin: boolean,
    dto: UpdateModifierOptionDto,
  ): Promise<ModifierOption> {
    await this.findOption(optionId, groupId); // existence check
    await this.findGroup(groupId, menuItemId); // group belongs to item
    await this.assertMenuItemOwnership(menuItemId, requesterId, isAdmin);
    return this.db.transaction(async (tx) => {
      const option = await this.optionRepo.update(optionId, dto, tx);
      await this.writeMenuItemOutbox(tx, menuItemId);
      return option;
    });
  }

  async removeOption(
    optionId: string,
    groupId: string,
    menuItemId: string,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<void> {
    await this.findOption(optionId, groupId); // existence check
    await this.findGroup(groupId, menuItemId); // group belongs to item
    await this.assertMenuItemOwnership(menuItemId, requesterId, isAdmin);
    await this.db.transaction(async (tx) => {
      await this.optionRepo.remove(optionId, tx);
      await this.writeMenuItemOutbox(tx, menuItemId);
    });
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async requireMenuItem(
    menuItemId: string,
    executor?: DrizzleExecutor,
  ) {
    const item = await this.menuRepo.findById(menuItemId, executor);
    if (!item) throw new NotFoundException(`Menu item ${menuItemId} not found`);
    return item;
  }

  /**
   * Fix S-1: resolves the actual restaurant owner via RestaurantService,
   * not a stub that returned the restaurant UUID as ownerId.
   */
  private async assertMenuItemOwnership(
    menuItemId: string,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<void> {
    if (isAdmin) return;
    const item = await this.requireMenuItem(menuItemId);
    const restaurant = await this.restaurantService.findOne(item.restaurantId);
    if (restaurant.ownerId !== requesterId) {
      throw new ForbiddenException('You do not own this menu item');
    }
  }

  private validateMinMax(min: number, max: number): void {
    if (max < min) {
      throw new BadRequestException(
        `maxSelections (${max}) must be ≥ minSelections (${min})`,
      );
    }
  }

  /**
   * Re-fetches the full menu item + all groups+options WITHIN the caller's
   * transaction (so it sees the just-written modifier change) and records a
   * catalog.menu-item.changed.v1 outbox event. Atomic with the modifier write.
   * Fix I-1: modifier mutations now produce events durably.
   */
  private async writeMenuItemOutbox(
    tx: DrizzleExecutor,
    menuItemId: string,
  ): Promise<void> {
    const item = await this.requireMenuItem(menuItemId, tx);
    const modifiers = await this.buildGroupsWithOptions(menuItemId, tx);
    const snapshot: MenuItemModifierSnapshot[] = modifiers.map((g) => ({
      groupId: g.id,
      groupName: g.name,
      minSelections: g.minSelections,
      maxSelections: g.maxSelections,
      options: g.options.map((o) => ({
        optionId: o.id,
        optionName: o.name,
        price: o.price,
        isDefault: o.isDefault,
        isAvailable: o.isAvailable,
      })),
    }));
    await this.menuService.writeMenuItemOutbox(tx, item, snapshot);
  }

  /**
   * Fetches all groups + options for a menu item in 2 DB round-trips (was N+1).
   * Runs on the provided executor (a transaction during outbox writes) so it
   * reflects uncommitted modifier changes.
   */
  private async buildGroupsWithOptions(
    menuItemId: string,
    executor?: DrizzleExecutor,
  ): Promise<ModifierGroupResponseDto[]> {
    const groups = await this.groupRepo.findByMenuItem(menuItemId, executor);
    if (groups.length === 0) return [];
    const allOptions = await this.optionRepo.findAllByMenuItem(
      menuItemId,
      executor,
    );
    const optionsByGroupId = new Map<string, ModifierOption[]>();
    for (const option of allOptions) {
      const list = optionsByGroupId.get(option.groupId) ?? [];
      list.push(option);
      optionsByGroupId.set(option.groupId, list);
    }
    return groups.map((group) => ({
      ...group,
      options: optionsByGroupId.get(group.id) ?? [],
    }));
  }
}
