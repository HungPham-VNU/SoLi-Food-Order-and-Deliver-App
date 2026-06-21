import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { eq, and, count } from 'drizzle-orm';
import {
  menuItems,
  menuCategories,
  type MenuItem,
  type MenuCategory,
  type NewMenuCategory,
} from '@/module/restaurant-catalog/menu/menu.schema';
import type {
  CreateMenuItemDto,
  UpdateMenuItemDto,
  CreateMenuCategoryDto,
  UpdateMenuCategoryDto,
  MenuItemStatusFilter,
} from './dto/menu.dto';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { menuItemNutrition } from '@/module/restaurant-catalog/nutrition/domain/nutrition.schema';
import { NUTRITION_DISCLAIMER } from '@/module/restaurant-catalog/nutrition/types/nutrition.types';
import { AiSearchIndexRepository } from '@/module/restaurant-catalog/search/indexing/ai-search-index.repository';

// PostgreSQL unique-constraint violation error code.
const PG_UNIQUE_VIOLATION = '23505';

export interface FindMenuItemsOptions {
  categoryId?: string;
  /**
   * 'available' | 'unavailable' | 'out_of_stock' — filter to exact status.
   * 'all' — return every status (useful for owner/admin views).
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
    @Inject(DB_CONNECTION) readonly db: NodePgDatabase,
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

    // Apply status filter unless caller explicitly requests all items.
    // Public endpoint defaults to 'available' so customers never see unavailable items.
    if (status !== 'all') {
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

  async findById(id: string): Promise<MenuItemDetail | null> {
    const result = await this.db
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

  async create(dto: CreateMenuItemDto): Promise<MenuItem> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx.insert(menuItems).values(dto).returning();
      await this.searchIndex.refreshMenuItemSearchMetadata(row.id, tx);
      return row;
    });
  }

  async update(id: string, dto: UpdateMenuItemDto): Promise<MenuItem> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(menuItems)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(menuItems.id, id))
        .returning();
      await this.searchIndex.refreshMenuItemSearchMetadata(row.id, tx);
      return row;
    });
  }

  async remove(id: string): Promise<void> {
    await this.db.delete(menuItems).where(eq(menuItems.id, id));
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
