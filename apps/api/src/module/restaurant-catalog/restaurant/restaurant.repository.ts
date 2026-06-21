import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  restaurants,
  type Restaurant,
} from '@/module/restaurant-catalog/restaurant/restaurant.schema';
import { CreateRestaurantDto, UpdateRestaurantDto } from './dto/restaurant.dto';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import { AiSearchIndexRepository } from '@/module/restaurant-catalog/search/indexing/ai-search-index.repository';
import type { UnitOfWorkContext } from '@/shared/ports/unit-of-work-context';

export interface FindAllOptions {
  offset?: number;
  limit?: number;
  /** When true, only approved restaurants are returned (public-facing endpoint). */
  approvedOnly?: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
}

@Injectable()
export class RestaurantRepository {
  constructor(
    @Inject(DB_CONNECTION) readonly db: NodePgDatabase,
    private readonly searchIndex: AiSearchIndexRepository,
  ) {}

  async findAll(
    opts: FindAllOptions = {},
  ): Promise<PaginatedResult<Restaurant>> {
    const { offset, limit, approvedOnly } = opts;

    // Build the WHERE conditions based on options.
    const conditions = approvedOnly ? [eq(restaurants.isApproved, true)] : [];
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Run count and data queries in parallel for efficiency.
    const [countResult, rows] = await Promise.all([
      this.db.select({ total: count() }).from(restaurants).where(whereClause),
      this.db
        .select()
        .from(restaurants)
        .where(whereClause)
        .orderBy(asc(restaurants.isApproved), asc(restaurants.createdAt))
        .offset(offset ?? 0)
        // limit is always supplied by RestaurantService (DEFAULT_PAGE_SIZE / MAX_PAGE_SIZE),
        // but we fall back to 20 here so the repository remains usable in isolation.
        .limit(limit ?? 20),
    ]);

    return {
      data: rows,
      total: countResult[0]?.total ?? 0,
    };
  }

  async findById(id: string): Promise<Restaurant | null> {
    const result = await this.db
      .select()
      .from(restaurants)
      .where(eq(restaurants.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Returns the first restaurant owned by the given user, or null. The
   * data model permits one owner → many restaurants, but the current UX
   * assumes one. If that changes, callers should switch to a list endpoint.
   */
  async findByOwner(ownerId: string): Promise<Restaurant | null> {
    const result = await this.db
      .select()
      .from(restaurants)
      .where(eq(restaurants.ownerId, ownerId))
      .orderBy(asc(restaurants.createdAt))
      .limit(1);
    return result[0] ?? null;
  }

  async create(ownerId: string, dto: CreateRestaurantDto): Promise<Restaurant> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(restaurants)
        .values({ ...dto, ownerId })
        .returning();
      await this.searchIndex.refreshRestaurantSearchMetadata(row.id, tx);
      return row;
    });
  }

  /**
   * Returns `undefined` when no row with the given `id` exists.
   * Callers are responsible for handling the not-found case.
   */
  async update(
    id: string,
    dto: UpdateRestaurantDto,
  ): Promise<Restaurant | undefined> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(restaurants)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(restaurants.id, id))
        .returning();
      if (row) {
        await this.searchIndex.refreshRestaurantSearchMetadata(row.id, tx);
        await this.searchIndex.refreshMenuItemsForRestaurant(row.id, tx);
      }
      return row;
    });
  }

  async incrementRating(
    restaurantId: string,
    stars: number,
    context?: UnitOfWorkContext,
  ): Promise<void> {
    const database =
      (context?.transaction as NodePgDatabase | undefined) ?? this.db;
    await database
      .update(restaurants)
      .set({
        ratingSum: sql`${restaurants.ratingSum} + ${stars}`,
        reviewCount: sql`${restaurants.reviewCount} + 1`,
        averageRating: sql`(${restaurants.ratingSum} + ${stars})::real / (${restaurants.reviewCount} + 1)`,
        updatedAt: new Date(),
      })
      .where(eq(restaurants.id, restaurantId));
  }
  async remove(id: string): Promise<void> {
    await this.db.delete(restaurants).where(eq(restaurants.id, id));
  }
}
