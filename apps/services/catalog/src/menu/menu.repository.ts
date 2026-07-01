import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { eq, and, count, ne } from 'drizzle-orm';
import {
  menuItems,
  menuCategories,
  type MenuItem,
  type MenuCategory,
  type NewMenuCategory,
} from '@/menu/menu.schema';
import type {
  CreateMenuItemDto,
  UpdateMenuItemDto,
  CreateMenuCategoryDto,
  UpdateMenuCategoryDto,
  MenuItemStatusFilter,
} from './dto/menu.dto';
import { CATALOG_DATABASE } from '@/drizzle/database.constants';
import type { DrizzleExecutor } from '@/messaging/drizzle-executor';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { menuItemNutrition } from '@/nutrition/domain/nutrition.schema';
import { NUTRITION_DISCLAIMER } from '@/nutrition/types/nutrition.types';
import { AiSearchIndexRepository } from '@/search/indexing/ai-search-index.repository';

// PostgreSQL unique-constraint violation error code.
const PG_UNIQUE_VIOLATION = '23505';

export interface FindMenuItemsOptions {
  categoryId?: string;
  /**
   * 'available' | 'unavailable' | 'out_of_stock' — filter to exact status.
   * 'all' — return every status (useful for owner/admin views).
   * 'visible' returns available and out-of-stock items for customer menus.
   * Defaults to 'available' when not provided.
   */
  status?: MenuItemStatusFilter;
  offset?: number;
  limit?: number;
}

export interface PaginatedMenuItems {
  data: MenuItem[];
  total: number;
}

export type MenuItemDetail = MenuItem & {
  nutrition?: {
    servings: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number | null;
    sugar: number | null;
    sodium: number | null;
    source: 'AI_ESTIMATED' | 'MANUALLY_ENTERED' | 'VERIFIED_BY_RESTAURANT';
    verifiedByRestaurant: boolean;
    disclaimer: string;
  } | null;
};

@Injectable()
export class MenuRepository {
  constructor(
    @Inject(CATALOG_DATABASE) readonly db: NodePgDatabase,
    private readonly searchIndex: AiSearchIndexRepository,
  ) {}

  // -------------------------------------------------------------------------
  // Menu Items
  // -------------------------------------------------------------------------

  async findByRestaurant(
    restaurantId: string,
    opts: FindMenuItemsOptions = {},
  ): Promise<PaginatedMenuItems> {
    const { categoryId, status = 'available', offset = 0, limit = 20 } = opts;

    const conditions = [eq(menuItems.restaurantId, restaurantId)];

    if (categoryId) {
      conditions.push(eq(menuItems.categoryId, categoryId));
    }

    // Public customer menus include sold-out items but never hidden/unavailable items.
    if (status === 'visible') {
      conditions.push(ne(menuItems.status, 'unavailable'));
    } else if (status !== 'all') {
      conditions.push(eq(menuItems.status, status));
    }

    const whereClause = and(...conditions);

    // Run count and data queries in parallel for efficiency.
    const [countResult, rows] = await Promise.all([
      this.db.select({ total: count() }).from(menuItems).where(whereClause),
      this.db
        .select()
        .from(menuItems)
        .where(whereClause)
        .orderBy(menuItems.createdAt)
        .offset(offset)
        .limit(limit),
    ]);

    return {
      data: rows,
      total: countResult[0]?.total ?? 0,
    };
  }

  async findById(
    id: string,
    executor: DrizzleExecutor = this.db,
  ): Promise<MenuItemDetail | null> {
    const result = await executor
      .select({
        item: menuItems,
        nutrition: menuItemNutrition,
      })
      .from(menuItems)
      .leftJoin(
        menuItemNutrition,
        and(
          eq(menuItemNutrition.menuItemId, menuItems.id),
          eq(menuItemNutrition.verifiedByRestaurant, true),
        ),
      )
      .where(eq(menuItems.id, id))
      .limit(1);
    const row = result[0];
    if (!row) return null;

    return {
      ...row.item,
      nutrition: row.nutrition
        ? {
            servings: row.nutrition.servings,
            calories: row.nutrition.calories,
            protein: row.nutrition.protein,
            carbs: row.nutrition.carbs,
            fat: row.nutrition.fat,
            fiber: row.nutrition.fiber,
            sugar: row.nutrition.sugar,
            sodium: row.nutrition.sodium,
            source: row.nutrition.source,
            verifiedByRestaurant: row.nutrition.verifiedByRestaurant,
            disclaimer: NUTRITION_DISCLAIMER,
          }
        : null,
    };
  }

  async create(
    dto: CreateMenuItemDto,
    executor?: DrizzleExecutor,
  ): Promise<MenuItem> {
    const run = async (tx: DrizzleExecutor) => {
      const [row] = await tx.insert(menuItems).values(dto).returning();
      await this.searchIndex.refreshMenuItemSearchMetadata(row.id, tx);
      return row;
    };
    // Join the caller's transaction when provided (atomic with the outbox
    // write); otherwise open our own so the search-index refresh stays atomic.
    return executor ? run(executor) : this.db.transaction(run);
  }

  async update(
    id: string,
    dto: UpdateMenuItemDto,
    executor?: DrizzleExecutor,
  ): Promise<MenuItem> {
    const run = async (tx: DrizzleExecutor) => {
      const [row] = await tx
        .update(menuItems)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(menuItems.id, id))
        .returning();
      await this.searchIndex.refreshMenuItemSearchMetadata(row.id, tx);
      return row;
    };
    return executor ? run(executor) : this.db.transaction(run);
  }

  async remove(id: string, executor: DrizzleExecutor = this.db): Promise<void> {
    await executor.delete(menuItems).where(eq(menuItems.id, id));
  }

  // -------------------------------------------------------------------------
  // Menu Categories
  // -------------------------------------------------------------------------

  async findCategoriesByRestaurant(
    restaurantId: string,
  ): Promise<MenuCategory[]> {
    return this.db
      .select()
      .from(menuCategories)
      .where(eq(menuCategories.restaurantId, restaurantId))
      .orderBy(menuCategories.displayOrder);
  }

  async findCategoryById(id: string): Promise<MenuCategory | null> {
    const result = await this.db
      .select()
      .from(menuCategories)
      .where(eq(menuCategories.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  async createCategory(dto: CreateMenuCategoryDto): Promise<MenuCategory> {
    const data: NewMenuCategory = {
      restaurantId: dto.restaurantId,
      name: dto.name,

      displayOrder: dto.displayOrder ?? 0,
    };

    try {
      const [row] = await this.db
        .insert(menuCategories)
        .values(data)
        .returning();
      return row;
    } catch (err: unknown) {
      // Map PostgreSQL unique-constraint violation (Issue #13) to a 409 so
      // the service layer doesn't need to understand DB error codes.
      if ((err as { code?: string }).code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException(
          `Category "${dto.name}" already exists for this restaurant`,
        );
      }
      throw err;
    }
  }

  async updateCategory(
    id: string,
    dto: UpdateMenuCategoryDto,
  ): Promise<MenuCategory> {
    try {
      return await this.db.transaction(async (tx) => {
        const [row] = await tx
          .update(menuCategories)
          .set({ ...dto, updatedAt: new Date() })
          .where(eq(menuCategories.id, id))
          .returning();
        await this.searchIndex.refreshMenuItemsForCategory(id, tx);
        return row;
      });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException(
          `A category named "${dto.name}" already exists for this restaurant`,
        );
      }
      throw err;
    }
  }

  async removeCategory(id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [category] = await tx
        .select({ restaurantId: menuCategories.restaurantId })
        .from(menuCategories)
        .where(eq(menuCategories.id, id))
        .limit(1);
      await tx.delete(menuCategories).where(eq(menuCategories.id, id));
      if (category) {
        await this.searchIndex.refreshMenuItemsForRestaurant(
          category.restaurantId,
          tx,
        );
      }
    });
  }
}
