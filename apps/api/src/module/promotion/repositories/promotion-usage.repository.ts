import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, and, lt, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import * as schema from '@/drizzle/schema';
import {
  promotionUsages,
  type PromotionUsage,
  type NewPromotionUsage,
} from '../domain/promotion.schema';

/**
 * PromotionUsageRepository
 *
 * Data access layer for the `promotion_usages` table.
 * Handles the reservation → confirmed / rolled_back lifecycle.
 */
@Injectable()
export class PromotionUsageRepository {
  private readonly logger = new Logger(PromotionUsageRepository.name);

  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  // ---------------------------------------------------------------------------
  // Write
  // ---------------------------------------------------------------------------

  async create(data: NewPromotionUsage): Promise<PromotionUsage> {
    const [row] = await this.db
      .insert(promotionUsages)
      .values(data)
      .returning();
    return row;
  }

  /**
   * Confirms all 'reserved' usages for the given orderId.
   * Called after the order row is persisted.
   * Idempotent — already-confirmed rows are untouched.
   */
  async confirmByOrderId(orderId: string): Promise<void> {
    const now = new Date();
    await this.db
      .update(promotionUsages)
      .set({ status: 'confirmed', confirmedAt: now })
      .where(
        and(
          eq(promotionUsages.orderId, orderId),
          eq(promotionUsages.status, 'reserved'),
        ),
      );
  }

  /**
   * Rolls back all 'reserved' or 'confirmed' usages for the given orderId.
   * Called when an order fails or is cancelled.
   * Idempotent — already-rolled-back rows are untouched.
   *
   * @returns the list of usage rows that were rolled back
   *          (needed for counter decrement logic in PromotionService).
   */
  async rollbackByOrderId(orderId: string): Promise<PromotionUsage[]> {
    const now = new Date();
    return this.db
      .update(promotionUsages)
      .set({ status: 'rolled_back', rolledBackAt: now })
      .where(
        and(
          eq(promotionUsages.orderId, orderId),
          sql`${promotionUsages.status} IN ('reserved', 'confirmed')`,
        ),
      )
      .returning();
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  async findById(id: string): Promise<PromotionUsage | null> {
    const [row] = await this.db
      .select()
      .from(promotionUsages)
      .where(eq(promotionUsages.id, id))
      .limit(1);
    return row ?? null;
  }

  async findByOrderId(orderId: string): Promise<PromotionUsage[]> {
    return this.db
      .select()
      .from(promotionUsages)
      .where(eq(promotionUsages.orderId, orderId));
  }

  /**
   * Counts how many confirmed/reserved usages a customer has for a given promotion.
   * Used to enforce maxUsesPerUser quota.
   */
  async countActiveUsagesByCustomer(
    promotionId: string,
    customerId: string,
  ): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(promotionUsages)
      .where(
        and(
          eq(promotionUsages.promotionId, promotionId),
          eq(promotionUsages.customerId, customerId),
          sql`${promotionUsages.status} IN ('reserved', 'confirmed')`,
        ),
      );
    return Number(result?.count ?? 0);
  }

  /**
   * Returns stale 'reserved' usages older than the given cutoff.
   * Used by PromotionReservationCleanupTask (Phase PR-5).
   */
  async findStaleReservations(
    olderThan: Date,
    limit = 200,
  ): Promise<PromotionUsage[]> {
    return this.db
      .select()
      .from(promotionUsages)
      .where(
        and(
          eq(promotionUsages.status, 'reserved'),
          lt(promotionUsages.reservedAt, olderThan),
        ),
      )
      .limit(limit);
  }
}
