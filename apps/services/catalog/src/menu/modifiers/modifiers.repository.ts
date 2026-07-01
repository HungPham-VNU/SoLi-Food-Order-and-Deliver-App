import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  modifierGroups,
  modifierOptions,
  type ModifierGroup,
  type NewModifierGroup,
  type ModifierOption,
  type NewModifierOption,
} from '@/menu/menu.schema';
import { CATALOG_DATABASE } from '@/drizzle/database.constants';
import type { DrizzleExecutor } from '@/messaging/drizzle-executor';
import type {
  CreateModifierGroupDto,
  UpdateModifierGroupDto,
  CreateModifierOptionDto,
  UpdateModifierOptionDto,
} from './modifiers.dto';

// ---------------------------------------------------------------------------
// ModifierGroupRepository
// ---------------------------------------------------------------------------

@Injectable()
export class ModifierGroupRepository {
  constructor(@Inject(CATALOG_DATABASE) readonly db: NodePgDatabase) {}

  async findByMenuItem(
    menuItemId: string,
    executor: DrizzleExecutor = this.db,
  ): Promise<ModifierGroup[]> {
    return executor
      .select()
      .from(modifierGroups)
      .where(eq(modifierGroups.menuItemId, menuItemId))
      .orderBy(modifierGroups.displayOrder);
  }

  async findById(id: string): Promise<ModifierGroup | null> {
    const result = await this.db
      .select()
      .from(modifierGroups)
      .where(eq(modifierGroups.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  async create(
    menuItemId: string,
    dto: CreateModifierGroupDto,
    executor: DrizzleExecutor = this.db,
  ): Promise<ModifierGroup> {
    const data: NewModifierGroup = {
      menuItemId,
      name: dto.name,
      minSelections: dto.minSelections ?? 0,
      maxSelections: dto.maxSelections ?? 1,
      displayOrder: dto.displayOrder ?? 0,
    };
    const [row] = await executor
      .insert(modifierGroups)
      .values(data)
      .returning();
    return row;
  }

  async update(
    id: string,
    dto: UpdateModifierGroupDto,
    executor: DrizzleExecutor = this.db,
  ): Promise<ModifierGroup> {
    const [row] = await executor
      .update(modifierGroups)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(modifierGroups.id, id))
      .returning();
    return row;
  }

  async remove(id: string, executor: DrizzleExecutor = this.db): Promise<void> {
    await executor.delete(modifierGroups).where(eq(modifierGroups.id, id));
  }
}

// ---------------------------------------------------------------------------
// ModifierOptionRepository
// ---------------------------------------------------------------------------

@Injectable()
export class ModifierOptionRepository {
  constructor(@Inject(CATALOG_DATABASE) readonly db: NodePgDatabase) {}

  async findByGroup(groupId: string): Promise<ModifierOption[]> {
    return this.db
      .select()
      .from(modifierOptions)
      .where(eq(modifierOptions.groupId, groupId))
      .orderBy(modifierOptions.displayOrder);
  }

  async findById(id: string): Promise<ModifierOption | null> {
    const result = await this.db
      .select()
      .from(modifierOptions)
      .where(eq(modifierOptions.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  async create(
    groupId: string,
    dto: CreateModifierOptionDto,
    executor: DrizzleExecutor = this.db,
  ): Promise<ModifierOption> {
    const data: NewModifierOption = {
      groupId,
      name: dto.name,
      price: dto.price ?? 0,
      isDefault: dto.isDefault ?? false,
      displayOrder: dto.displayOrder ?? 0,
      isAvailable: dto.isAvailable ?? true,
    };
    const [row] = await executor
      .insert(modifierOptions)
      .values(data)
      .returning();
    return row;
  }

  async update(
    id: string,
    dto: UpdateModifierOptionDto,
    executor: DrizzleExecutor = this.db,
  ): Promise<ModifierOption> {
    const [row] = await executor
      .update(modifierOptions)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(modifierOptions.id, id))
      .returning();
    return row;
  }

  /**
   * Fetches all options whose parent group belongs to the given menu item.
   * Uses a 2-query approach (groups → options via inArray) to avoid N+1 while
   * keeping the return type cleanly typed as ModifierOption[].
   * Called by ModifiersService.buildGroupsWithOptions.
   */
  async findAllByMenuItem(
    menuItemId: string,
    executor: DrizzleExecutor = this.db,
  ): Promise<ModifierOption[]> {
    const groups = await executor
      .select({ id: modifierGroups.id })
      .from(modifierGroups)
      .where(eq(modifierGroups.menuItemId, menuItemId));
    if (groups.length === 0) return [];
    const groupIds = groups.map((g) => g.id);
    return executor
      .select()
      .from(modifierOptions)
      .where(inArray(modifierOptions.groupId, groupIds))
      .orderBy(modifierOptions.displayOrder);
  }

  async remove(id: string, executor: DrizzleExecutor = this.db): Promise<void> {
    await executor.delete(modifierOptions).where(eq(modifierOptions.id, id));
  }
}
