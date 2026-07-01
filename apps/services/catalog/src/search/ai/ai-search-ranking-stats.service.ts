import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CATALOG_DATABASE } from '@/drizzle/database.constants';

export interface AiSearchRankingStatsRefreshResult {
  refreshedAt: Date;
  window30dStart: Date;
  window90dStart: Date;
}

@Injectable()
export class AiSearchRankingStatsService {
  constructor(@Inject(CATALOG_DATABASE) private readonly db: NodePgDatabase) {}

  async refresh(now = new Date()): Promise<AiSearchRankingStatsRefreshResult> {
    const window30dStart = daysBefore(now, 30);
    const window90dStart = daysBefore(now, 90);

    await this.db.transaction(async (tx) => {
      await tx.execute(sql`DELETE FROM ai_search_item_ranking_stats`);
      await tx.execute(sql`DELETE FROM ai_search_restaurant_ranking_stats`);

      await tx.execute(sql`
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
          o.restaurant_id,
          COUNT(DISTINCT o.order_id) FILTER (
            WHERE o.delivered_at >= ${window30dStart}
          )::int,
          COUNT(DISTINCT o.order_id) FILTER (
            WHERE o.delivered_at >= ${window90dStart}
          )::int,
          COALESCE(SUM(oi.quantity) FILTER (
            WHERE o.delivered_at >= ${window30dStart}
          ), 0)::int,
          COALESCE(SUM(oi.quantity) FILTER (
            WHERE o.delivered_at >= ${window90dStart}
          ), 0)::int,
          MAX(o.delivered_at),
          ${now}
        FROM delivered_order_snapshots o
        INNER JOIN delivered_order_item_snapshots oi ON oi.order_id = o.order_id
        GROUP BY oi.menu_item_id, o.restaurant_id
      `);

      await tx.execute(sql`
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
          o.restaurant_id,
          COUNT(DISTINCT o.order_id) FILTER (
            WHERE o.delivered_at >= ${window30dStart}
          )::int,
          COUNT(DISTINCT o.order_id) FILTER (
            WHERE o.delivered_at >= ${window90dStart}
          )::int,
          COALESCE(SUM(oi.quantity) FILTER (
            WHERE o.delivered_at >= ${window30dStart}
          ), 0)::int,
          COALESCE(SUM(oi.quantity) FILTER (
            WHERE o.delivered_at >= ${window90dStart}
          ), 0)::int,
          MAX(o.delivered_at),
          ${now}
        FROM delivered_order_snapshots o
        INNER JOIN delivered_order_item_snapshots oi ON oi.order_id = o.order_id
        GROUP BY o.restaurant_id
      `);
    });

    return { refreshedAt: now, window30dStart, window90dStart };
  }
}

function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
