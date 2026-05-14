import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import * as schema from '@/drizzle/schema';
import {
  couponCodes,
  type CouponCode,
  type NewCouponCode,
} from '../domain/promotion.schema';

/**
 * CouponCodeRepository
 *
 * Data access layer for the `coupon_codes` table.
 */
@Injectable()
export class CouponCodeRepository {
  private readonly logger = new Logger(CouponCodeRepository.name);

  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  // ---------------------------------------------------------------------------
  // Write
  // ---------------------------------------------------------------------------

  async create(data: NewCouponCode): Promise<CouponCode> {
    const [row] = await this.db.insert(couponCodes).values(data).returning();
    return row;
  }

  async createMany(data: NewCouponCode[]): Promise<CouponCode[]> {
    return this.db.insert(couponCodes).values(data).returning();
  }

  /**
   * Atomically increments current_uses by 1, only if quota not exceeded.
   * Returns true on success; false when the code is exhausted or expired.
   */
  async atomicIncrementUses(id: string, now: Date): Promise<boolean> {
    const result = await this.db
      .update(couponCodes)
      .set({
        currentUses: sql`${couponCodes.currentUses} + 1`,
        version: sql`${couponCodes.version} + 1`,
      })
      .where(
        and(
          eq(couponCodes.id, id),
          eq(couponCodes.status, 'active'),
          sql`(${couponCodes.maxUses} IS NULL OR ${couponCodes.currentUses} < ${couponCodes.maxUses})`,
          sql`(${couponCodes.expiresAt} IS NULL OR ${couponCodes.expiresAt} > ${now})`,
        ),
      )
      .returning({ id: couponCodes.id });

    return result.length > 0;
  }

  /**
   * Decrements current_uses by 1, clamped at 0 (rollback path).
   * Also transitions 'exhausted' back to 'active' if needed.
   */
  async decrementUses(id: string): Promise<void> {
    await this.db
      .update(couponCodes)
      .set({
        currentUses: sql`GREATEST(${couponCodes.currentUses} - 1, 0)`,
        // If it was exhausted due to maxUses, it's now usable again
        status: sql`CASE
          WHEN ${couponCodes.status} = 'exhausted'
          THEN 'active'::coupon_status
          ELSE ${couponCodes.status}
        END`,
        version: sql`${couponCodes.version} + 1`,
      })
      .where(eq(couponCodes.id, id));
  }

  /**
   * Marks codes as 'exhausted' when maxUses is reached.
   * Called after atomicIncrementUses to keep status accurate.
   */
  async checkAndMarkExhausted(id: string): Promise<void> {
    await this.db
      .update(couponCodes)
      .set({ status: 'exhausted' })
      .where(
        and(
          eq(couponCodes.id, id),
          sql`${couponCodes.maxUses} IS NOT NULL`,
          sql`${couponCodes.currentUses} >= ${couponCodes.maxUses}`,
        ),
      );
  }

  async revokeCode(id: string): Promise<CouponCode | null> {
    const [row] = await this.db
      .update(couponCodes)
      .set({ status: 'revoked', version: sql`${couponCodes.version} + 1` })
      .where(eq(couponCodes.id, id))
      .returning();
    return row ?? null;
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  async findById(id: string): Promise<CouponCode | null> {
    const [row] = await this.db
      .select()
      .from(couponCodes)
      .where(eq(couponCodes.id, id))
      .limit(1);
    return row ?? null;
  }

  /**
   * Looks up an active coupon by its code string (case-sensitive).
   * The engine normalises input to uppercase before calling this.
   */
  async findActiveByCode(code: string, now: Date): Promise<CouponCode | null> {
    const [row] = await this.db
      .select()
      .from(couponCodes)
      .where(
        and(
          eq(couponCodes.code, code),
          eq(couponCodes.status, 'active'),
          sql`(${couponCodes.expiresAt} IS NULL OR ${couponCodes.expiresAt} > ${now})`,
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /**
   * Returns all coupon codes for a promotion (admin list).
   */
  async findByPromotionId(
    promotionId: string,
    offset = 0,
    limit = 50,
  ): Promise<{ rows: CouponCode[]; total: number }> {
    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(couponCodes)
        .where(eq(couponCodes.promotionId, promotionId))
        .orderBy(desc(couponCodes.createdAt))
        .offset(offset)
        .limit(limit),
      this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(couponCodes)
        .where(eq(couponCodes.promotionId, promotionId)),
    ]);
    return { rows, total: Number(countResult[0]?.count ?? 0) };
  }
}
