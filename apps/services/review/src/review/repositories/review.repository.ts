import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq } from 'drizzle-orm';
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
}
