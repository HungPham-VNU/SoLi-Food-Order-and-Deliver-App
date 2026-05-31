import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  sql,
  and,
  gte,
  lt,
  ne,
  eq,
  notInArray,
  desc,
  asc,
  count,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import * as schema from '@/drizzle/schema';

export interface PlatformScalars {
  gmv: number;
  orderCount: number;
  deliveredCount: number;
  failedCount: number;
}

export interface RestaurantCounts {
  online: number;
  offline: number;
  pending: number;
}

export interface HourlyPoint {
  hour: Date;
  orders: number;
  revenue: number;
}

export interface TopEarnerRow {
  restaurantId: string;
  restaurantName: string;
  gmv: number;
  orderCount: number;
}

export interface BottleneckRow {
  restaurantId: string;
  restaurantName: string;
  cancelRate: number;
  avgPrepMinutes: number | null;
  orderCount: number;
  primaryIssue: 'high-cancel' | 'slow-prep';
}

export interface DistrictRow {
  district: string;
  orderCount: number;
}

const COMMISSION_RATE = 0.15;

@Injectable()
export class AdminAnalyticsRepository {
  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  // ---------------------------------------------------------------------------
  // Platform-wide scalars (GMV, order counts)
  // ---------------------------------------------------------------------------

  async getPlatformScalars(start: Date, end: Date): Promise<PlatformScalars> {
    const windowFilter = and(
      gte(schema.orders.createdAt, start),
      lt(schema.orders.createdAt, end),
    );

    const rows = await this.db
      .select({
        gmv: sql<number>`COALESCE(SUM(${schema.orders.totalAmount}), 0)::bigint`,
        orderCount: count(),
        deliveredCount: sql<number>`COUNT(*) FILTER (WHERE ${schema.orders.status} = 'delivered')::int`,
        failedCount: sql<number>`COUNT(*) FILTER (WHERE ${schema.orders.status} IN ('cancelled', 'refunded'))::int`,
      })
      .from(schema.orders)
      .where(windowFilter);

    const r = rows[0];
    return {
      gmv: Number(r?.gmv ?? 0),
      orderCount: Number(r?.orderCount ?? 0),
      deliveredCount: r?.deliveredCount ?? 0,
      failedCount: r?.failedCount ?? 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Restaurant status counts (from the catalog, not window-bounded)
  // ---------------------------------------------------------------------------

  async getRestaurantCounts(): Promise<RestaurantCounts> {
    const rows = await this.db
      .select({
        online: sql<number>`COUNT(*) FILTER (WHERE ${schema.restaurants.isApproved} = true  AND ${schema.restaurants.isOpen} = true)::int`,
        offline: sql<number>`COUNT(*) FILTER (WHERE ${schema.restaurants.isApproved} = true  AND ${schema.restaurants.isOpen} = false)::int`,
        pending: sql<number>`COUNT(*) FILTER (WHERE ${schema.restaurants.isApproved} = false)::int`,
      })
      .from(schema.restaurants);

    const r = rows[0];
    return {
      online: r?.online ?? 0,
      offline: r?.offline ?? 0,
      pending: r?.pending ?? 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Hourly load: orders + revenue per UTC hour in the window
  // ---------------------------------------------------------------------------

  async getHourlyLoad(start: Date, end: Date): Promise<HourlyPoint[]> {
    const rows = await this.db
      .select({
        hour: sql<string>`date_trunc('hour', ${schema.orders.createdAt})`.as(
          'hour',
        ),
        orders: count().as('orders'),
        revenue:
          sql<number>`COALESCE(SUM(${schema.orders.totalAmount}), 0)::bigint`.as(
            'revenue',
          ),
      })
      .from(schema.orders)
      .where(
        and(
          gte(schema.orders.createdAt, start),
          lt(schema.orders.createdAt, end),
        ),
      )
      .groupBy(sql`hour`)
      .orderBy(asc(sql`hour`));

    return rows.map((r) => ({
      hour: new Date(r.hour),
      orders: Number(r.orders),
      revenue: Number(r.revenue),
    }));
  }

  // ---------------------------------------------------------------------------
  // Top 5 earners by GMV, excluding cancelled/refunded orders
  // ---------------------------------------------------------------------------

  async getTopEarners(
    start: Date,
    end: Date,
    limit = 5,
  ): Promise<TopEarnerRow[]> {
    const rows = await this.db
      .select({
        restaurantId: schema.orders.restaurantId,
        restaurantName: schema.orders.restaurantName,
        gmv: sql<number>`COALESCE(SUM(${schema.orders.totalAmount}), 0)::bigint`,
        orderCount: count(),
      })
      .from(schema.orders)
      .where(
        and(
          gte(schema.orders.createdAt, start),
          lt(schema.orders.createdAt, end),
          notInArray(schema.orders.status, ['cancelled', 'refunded']),
        ),
      )
      .groupBy(schema.orders.restaurantId, schema.orders.restaurantName)
      .orderBy(desc(sql`COALESCE(SUM(${schema.orders.totalAmount}), 0)`))
      .limit(limit);

    return rows.map((r) => ({
      restaurantId: r.restaurantId,
      restaurantName: r.restaurantName,
      gmv: Number(r.gmv),
      orderCount: Number(r.orderCount),
    }));
  }

  // ---------------------------------------------------------------------------
  // Bottleneck watchlist: restaurants with high cancel rate or slow prep
  // Minimum 5 orders in window to be included.
  // ---------------------------------------------------------------------------

  async getBottlenecks(
    start: Date,
    end: Date,
    limit = 5,
  ): Promise<BottleneckRow[]> {
    const lConf = alias(schema.orderStatusLogs, 'l_conf');
    const lReady = alias(schema.orderStatusLogs, 'l_ready');

    // CTE 1: cancel rate per restaurant
    const orderStats = this.db.$with('order_stats').as(
      this.db
        .select({
          restaurantId: schema.orders.restaurantId,
          restaurantName: schema.orders.restaurantName,
          total: count().as('total'),
          failed:
            sql<number>`COUNT(*) FILTER (WHERE ${schema.orders.status} IN ('cancelled', 'refunded'))::int`.as(
              'failed',
            ),
        })
        .from(schema.orders)
        .where(
          and(
            gte(schema.orders.createdAt, start),
            lt(schema.orders.createdAt, end),
          ),
        )
        .groupBy(schema.orders.restaurantId, schema.orders.restaurantName),
    );

    // CTE 2: avg prep time (confirmed → ready_for_pickup) per restaurant
    const prepLatency = this.db.$with('prep_latency').as(
      this.db
        .select({
          restaurantId: schema.orders.restaurantId,
          avgPrepSeconds:
            sql<number>`AVG(EXTRACT(EPOCH FROM (${lReady.createdAt} - ${lConf.createdAt})))::float8`.as(
              'avg_prep_seconds',
            ),
        })
        .from(schema.orders)
        .innerJoin(
          lConf,
          and(
            eq(lConf.orderId, schema.orders.id),
            eq(lConf.toStatus, 'confirmed'),
          ),
        )
        .innerJoin(
          lReady,
          and(
            eq(lReady.orderId, schema.orders.id),
            eq(lReady.toStatus, 'ready_for_pickup'),
          ),
        )
        .where(
          and(
            gte(schema.orders.createdAt, start),
            lt(schema.orders.createdAt, end),
          ),
        )
        .groupBy(schema.orders.restaurantId),
    );

    const rows = await this.db
      .with(orderStats, prepLatency)
      .select({
        restaurantId: orderStats.restaurantId,
        restaurantName: orderStats.restaurantName,
        total: orderStats.total,
        failed: orderStats.failed,
        avgPrepSeconds: prepLatency.avgPrepSeconds,
      })
      .from(orderStats)
      .leftJoin(
        prepLatency,
        eq(prepLatency.restaurantId, orderStats.restaurantId),
      )
      .where(
        and(
          // Require minimum volume before calling something a bottleneck
          sql`${orderStats.total} >= 5`,
          // Flag if cancel rate > 5% or avg prep > 30 minutes
          sql`(
            ${orderStats.failed}::float / NULLIF(${orderStats.total}, 0) > 0.05
            OR ${prepLatency.avgPrepSeconds} > 1800
          )`,
        ),
      )
      .orderBy(
        desc(sql`${orderStats.failed}::float / NULLIF(${orderStats.total}, 0)`),
      )
      .limit(limit);

    return rows.map((r) => {
      const cancelRate =
        Number(r.total) > 0 ? Number(r.failed) / Number(r.total) : 0;
      const avgPrepMinutes =
        r.avgPrepSeconds != null
          ? Math.round(Number(r.avgPrepSeconds) / 60)
          : null;
      const primaryIssue: BottleneckRow['primaryIssue'] =
        cancelRate > 0.05 ? 'high-cancel' : 'slow-prep';
      return {
        restaurantId: r.restaurantId,
        restaurantName: r.restaurantName,
        cancelRate,
        avgPrepMinutes,
        orderCount: Number(r.total),
        primaryIssue,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Orders grouped by district (from deliveryAddress JSONB)
  // ---------------------------------------------------------------------------

  async getOrdersByDistrict(
    start: Date,
    end: Date,
    limit = 15,
  ): Promise<DistrictRow[]> {
    const rows = await this.db
      .select({
        district: sql<string>`${schema.orders.deliveryAddress}->>'district'`.as(
          'district',
        ),
        orderCount: count().as('order_count'),
      })
      .from(schema.orders)
      .where(
        and(
          gte(schema.orders.createdAt, start),
          lt(schema.orders.createdAt, end),
          sql`${schema.orders.deliveryAddress}->>'district' IS NOT NULL`,
          ne(sql<string>`${schema.orders.deliveryAddress}->>'district'`, ''),
        ),
      )
      .groupBy(sql`district`)
      .orderBy(desc(sql`order_count`))
      .limit(limit);

    return rows.map((r) => ({
      district: r.district,
      orderCount: Number(r.orderCount),
    }));
  }

  get commissionRate(): number {
    return COMMISSION_RATE;
  }
}
