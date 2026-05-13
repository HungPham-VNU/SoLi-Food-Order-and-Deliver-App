import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import * as schema from '@/drizzle/schema';
import {
  promotions,
  type Promotion,
  type NewPromotion,
  type PromotionStatus,
} from '../domain/promotion.schema';

/**
 * PromotionRepository
 *
 * Data access layer for the `promotions` table.
 * No business logic — all decisions live in PromotionService / PromotionPricingEngine.
 */
@Injectable()
export class PromotionRepository {
  private readonly logger = new Logger(PromotionRepository.name);

  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  // ---------------------------------------------------------------------------
  // Write
  // ---------------------------------------------------------------------------

  async create(data: NewPromotion): Promise<Promotion> {
    const [row] = await this.db.insert(promotions).values(data).returning();
    return row;
  }

  async update(
    id: string,
    data: Partial<Omit<NewPromotion, 'id' | 'createdAt'>>,
  ): Promise<Promotion | null> {
    const [row] = await this.db
      .update(promotions)
      .set({ ...data, version: sql`${promotions.version} + 1` })
      .where(eq(promotions.id, id))
      .returning();
    return row ?? null;
  }

  /**
   * Atomically increments current_total_uses by 1 only if quota is not exceeded.
   * Returns true when the increment succeeded; false when the promotion is full.
   */
  async atomicIncrementUses(id: string): Promise<boolean> {
    const result = await this.db
      .update(promotions)
      .set({ currentTotalUses: sql`${promotions.currentTotalUses} + 1` })
      .where(
        and(
          eq(promotions.id, id),
          sql`(${promotions.maxTotalUses} IS NULL OR ${promotions.currentTotalUses} < ${promotions.maxTotalUses})`,
        ),
      )
      .returning({ id: promotions.id });

    return result.length > 0;
  }

  /**
   * Decrements current_total_uses by 1, clamped at 0 (rollback path).
   */
  async decrementUses(id: string): Promise<void> {
    await this.db
      .update(promotions)
      .set({
        currentTotalUses: sql`GREATEST(${promotions.currentTotalUses} - 1, 0)`,
      })
      .where(eq(promotions.id, id));
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  async findById(id: string): Promise<Promotion | null> {
    const [row] = await this.db
      .select()
      .from(promotions)
      .where(eq(promotions.id, id))
      .limit(1);
    return row ?? null;
  }

  async findByIdOrThrow(id: string): Promise<Promotion> {
    const row = await this.findById(id);
    if (!row) throw new NotFoundException(`Promotion ${id} not found`);
    return row;
  }

  /**
   * Returns active auto-apply promotions eligible for the given restaurant.
   * Used by the pricing engine at preview/reservation time.
   *
   * Fetches both:
   *   - platform-scoped auto-apply promotions
   *   - restaurant-scoped auto-apply promotions for the given restaurantId
   */
  async findActiveAutoApplyForRestaurant(
    restaurantId: string,
    now: Date,
  ): Promise<Promotion[]> {
    return this.db
      .select()
      .from(promotions)
      .where(
        and(
          eq(promotions.status, 'active'),
          eq(promotions.trigger, 'auto_apply'),
          sql`${promotions.startsAt} <= ${now}`,
          sql`${promotions.endsAt} >= ${now}`,
          sql`(${promotions.restaurantId} IS NULL OR ${promotions.restaurantId} = ${restaurantId})`,
        ),
      )
      .orderBy(desc(promotions.createdAt));
  }

  /**
   * Returns active coupon-trigger promotions for the given restaurant.
   * Used by the pricing engine when a coupon code is supplied.
   */
  async findActiveCouponPromotionForRestaurant(
    promotionId: string,
    restaurantId: string,
    now: Date,
  ): Promise<Promotion | null> {
    const [row] = await this.db
      .select()
      .from(promotions)
      .where(
        and(
          eq(promotions.id, promotionId),
          eq(promotions.status, 'active'),
          eq(promotions.trigger, 'coupon_code'),
          sql`${promotions.startsAt} <= ${now}`,
          sql`${promotions.endsAt} >= ${now}`,
          sql`(${promotions.restaurantId} IS NULL OR ${promotions.restaurantId} = ${restaurantId})`,
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /**
   * Admin list — returns all promotions with optional filters.
   */
  async findAll(filters: {
    status?: PromotionStatus;
    restaurantId?: string;
    offset?: number;
    limit?: number;
  }): Promise<{ rows: Promotion[]; total: number }> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (filters.status) conditions.push(eq(promotions.status, filters.status));
    if (filters.restaurantId)
      conditions.push(eq(promotions.restaurantId, filters.restaurantId));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(promotions)
        .where(whereClause)
        .orderBy(desc(promotions.createdAt))
        .offset(filters.offset ?? 0)
        .limit(filters.limit ?? 20),
      this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(promotions)
        .where(whereClause),
    ]);

    return { rows, total: Number(countResult[0]?.count ?? 0) };
  }

  /**
   * Restaurant owner list — returns promotions for the given restaurantId.
   */
  async findByRestaurantId(
    restaurantId: string,
    offset = 0,
    limit = 20,
  ): Promise<{ rows: Promotion[]; total: number }> {
    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(promotions)
        .where(
          and(
            eq(promotions.restaurantId, restaurantId),
            sql`${promotions.status} != 'cancelled'`,
          ),
        )
        .orderBy(desc(promotions.createdAt))
        .offset(offset)
        .limit(limit),
      this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(promotions)
        .where(
          and(
            eq(promotions.restaurantId, restaurantId),
            sql`${promotions.status} != 'cancelled'`,
          ),
        ),
    ]);
    return { rows, total: Number(countResult[0]?.count ?? 0) };
  }

  /**
   * Public list — active auto-apply promotions visible to customers.
   */
  async findPublicActive(
    restaurantId?: string,
    now?: Date,
  ): Promise<Promotion[]> {
    const ts = now ?? new Date();
    return this.db
      .select()
      .from(promotions)
      .where(
        and(
          eq(promotions.status, 'active'),
          eq(promotions.trigger, 'auto_apply'),
          sql`${promotions.startsAt} <= ${ts}`,
          sql`${promotions.endsAt} >= ${ts}`,
          restaurantId
            ? sql`(${promotions.restaurantId} IS NULL OR ${promotions.restaurantId} = ${restaurantId})`
            : sql`${promotions.restaurantId} IS NULL`,
        ),
      )
      .orderBy(desc(promotions.createdAt));
  }
}
