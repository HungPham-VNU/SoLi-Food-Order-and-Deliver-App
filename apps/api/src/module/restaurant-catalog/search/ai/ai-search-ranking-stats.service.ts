import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';

export interface AiSearchRankingStatsRefreshResult {
  refreshedAt: Date;
  window30dStart: Date;
  window90dStart: Date;
}

@Injectable()
export class AiSearchRankingStatsService {
  constructor(@Inject(DB_CONNECTION) private readonly db: NodePgDatabase) {}

  async refresh(now = new Date()): Promise<AiSearchRankingStatsRefreshResult> {
    const window30dStart = daysBefore(now, 30);
    const window90dStart = daysBefore(now, 90);

    await this.db.transaction(async (tx) => {
      await tx.execute(sql`DELETE FROM ai_search_item_ranking_stats`);
      await tx.execute(sql`DELETE FROM ai_search_restaurant_ranking_stats`);

      await tx.execute(sql`
        WITH production_orders AS (
          SELECT o.id, o.restaurant_id, o.created_at
          FROM orders o
          INNER JOIN "user" u ON u.id = o.customer_id
          WHERE o.status = 'delivered'
            AND LOWER(COALESCE(u.email, '')) NOT LIKE '%@test.com'
            AND LOWER(COALESCE(u.email, '')) NOT LIKE '%@test.soli'
            AND LOWER(COALESCE(u.email, '')) NOT LIKE '%@demo.com'
        )
        INSERT INTO ai_search_item_ranking_stats (
          menu_item_id,
          restaurant_id,
          delivered_order_count_30d,
          delivered_order_count_90d,
          ordered_quantity_30d,
          ordered_quantity_90d,
          last_ordered_at,
          updated_at
        )
        SELECT
          oi.menu_item_id,
          po.restaurant_id,
          COUNT(DISTINCT po.id) FILTER (
            WHERE po.created_at >= ${window30dStart}
          )::int,
          COUNT(DISTINCT po.id) FILTER (
            WHERE po.created_at >= ${window90dStart}
          )::int,
          COALESCE(SUM(oi.quantity) FILTER (
            WHERE po.created_at >= ${window30dStart}
          ), 0)::int,
          COALESCE(SUM(oi.quantity) FILTER (
            WHERE po.created_at >= ${window90dStart}
          ), 0)::int,
          MAX(po.created_at),
          ${now}
        FROM production_orders po
        INNER JOIN order_items oi ON oi.order_id = po.id
        GROUP BY oi.menu_item_id, po.restaurant_id
      `);

      await tx.execute(sql`
        WITH production_orders AS (
          SELECT o.id, o.restaurant_id, o.created_at
          FROM orders o
          INNER JOIN "user" u ON u.id = o.customer_id
          WHERE o.status = 'delivered'
            AND LOWER(COALESCE(u.email, '')) NOT LIKE '%@test.com'
            AND LOWER(COALESCE(u.email, '')) NOT LIKE '%@test.soli'
            AND LOWER(COALESCE(u.email, '')) NOT LIKE '%@demo.com'
        )
        INSERT INTO ai_search_restaurant_ranking_stats (
          restaurant_id,
          delivered_order_count_30d,
          delivered_order_count_90d,
          ordered_quantity_30d,
          ordered_quantity_90d,
          last_ordered_at,
          updated_at
        )
        SELECT
          po.restaurant_id,
          COUNT(DISTINCT po.id) FILTER (
            WHERE po.created_at >= ${window30dStart}
          )::int,
          COUNT(DISTINCT po.id) FILTER (
            WHERE po.created_at >= ${window90dStart}
          )::int,
          COALESCE(SUM(oi.quantity) FILTER (
            WHERE po.created_at >= ${window30dStart}
          ), 0)::int,
          COALESCE(SUM(oi.quantity) FILTER (
            WHERE po.created_at >= ${window90dStart}
          ), 0)::int,
          MAX(po.created_at),
          ${now}
        FROM production_orders po
        INNER JOIN order_items oi ON oi.order_id = po.id
        GROUP BY po.restaurant_id
      `);
    });

    return { refreshedAt: now, window30dStart, window90dStart };
  }
}

function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
