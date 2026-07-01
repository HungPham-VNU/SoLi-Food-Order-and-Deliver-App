import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import type { ReviewDatabase } from '@/drizzle/database.module';
import { REVIEW_DATABASE } from '@/drizzle/database.constants';
import type { DrizzleExecutor } from '@/messaging/drizzle-executor';
import { reviews, type NewReview, type Review } from '../domain/review.schema';

@Injectable()
export class ReviewRepository {
  constructor(@Inject(REVIEW_DATABASE) private readonly db: ReviewDatabase) {}

  async create(
    values: NewReview,
    context?: { transaction?: DrizzleExecutor },
  ): Promise<Review> {
    const database = context?.transaction ?? this.db;
    const [created] = await database.insert(reviews).values(values).returning();
    return created;
  }

  async findByOrderId(orderId: string): Promise<Review | null> {
    const rows = await this.db
      .select()
      .from(reviews)
      .where(eq(reviews.orderId, orderId))
      .limit(1);
    return rows[0] ?? null;
  }

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

  async findAdminByRestaurantId(
    restaurantId: string,
    page: number,
    limit: number,
  ): Promise<{
    data: Review[];
    total: number;
    averageRating: number;
    ratingDistribution: Record<number, number>;
  }> {
    const where = eq(reviews.restaurantId, restaurantId);
    const offset = (page - 1) * limit;

    const [data, aggregateRows, distributionRows] = await Promise.all([
      this.db
        .select()
        .from(reviews)
        .where(where)
        .orderBy(desc(reviews.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({
          total: count(),
          averageRating: sql<number>`COALESCE(AVG(${reviews.stars}), 0)::float8`,
        })
        .from(reviews)
        .where(where),
      this.db
        .select({
          stars: reviews.stars,
          count: count(),
        })
        .from(reviews)
        .where(where)
        .groupBy(reviews.stars),
    ]);

    const ratingDistribution: Record<number, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    for (const row of distributionRows) {
      if (row.stars >= 1 && row.stars <= 5) {
        ratingDistribution[row.stars] = Number(row.count);
      }
    }

    return {
      data,
      total: Number(aggregateRows[0]?.total ?? 0),
      averageRating: Number(aggregateRows[0]?.averageRating ?? 0),
      ratingDistribution,
    };
  }
}
