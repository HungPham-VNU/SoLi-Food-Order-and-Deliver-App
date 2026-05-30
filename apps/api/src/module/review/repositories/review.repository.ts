import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import * as schema from '@/drizzle/schema';
import { reviews, type Review } from '../domain/review.schema';

/**
 * ReviewRepository
 *
 * Data-access layer for the `reviews` table. All queries are parameterized
 * Drizzle expressions — never raw SQL string interpolation (QA-S-05).
 *
 * Phase: RV-2
 */
@Injectable()
export class ReviewRepository {
  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Find the review for a given order — used by:
   *  - SubmitReviewHandler optimistic pre-check (BR-22.9)
   *  - GET /reviews/my/:orderId
   *
   * Returns the single review row (UNIQUE on order_id guarantees ≤ 1).
   */
  async findByOrderId(orderId: string): Promise<Review | null> {
    const rows = await this.db
      .select()
      .from(reviews)
      .where(eq(reviews.orderId, orderId))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Find a review only if it belongs to the given customer.
   * Used by GET /reviews/my/:orderId to enforce ownership without a
   * separate authorization round-trip.
   */
  async findByOrderIdAndCustomerId(
    orderId: string,
    customerId: string,
  ): Promise<Review | null> {
    const rows = await this.db
      .select()
      .from(reviews)
      .where(
        and(eq(reviews.orderId, orderId), eq(reviews.customerId, customerId)),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Paginated public listing for a restaurant.
   * Excludes reviews with moderationStatus !== 'visible' (BR-22.13).
   *
   * @param page  — 1-based page index
   * @param limit — page size (caller validates max 50)
   */
  async findByRestaurantId(
    restaurantId: string,
    page: number,
    limit: number,
  ): Promise<{ data: Review[]; total: number }> {
    const where = and(
      eq(reviews.restaurantId, restaurantId),
      eq(reviews.moderationStatus, 'visible'),
    );

    const offset = (page - 1) * limit;

    const [data, totalRows] = await Promise.all([
      this.db
        .select()
        .from(reviews)
        .where(where)
        .orderBy(desc(reviews.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ value: count() }).from(reviews).where(where),
    ]);

    return { data, total: Number(totalRows[0]?.value ?? 0) };
  }
}
