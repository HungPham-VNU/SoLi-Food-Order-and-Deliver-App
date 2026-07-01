import { Inject, Injectable } from '@nestjs/common';
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
  isNotNull,
} from 'drizzle-orm';
import { REPORTING_DATABASE } from '@/drizzle/database.constants';
import type { ReportingDatabase } from '@/drizzle/database.module';
import { reportingOrderFacts } from './projections/schema/order-fact.schema';
import { reportingOrderItemFacts } from './projections/schema/order-item-fact.schema';
import { reportingRestaurantFacts } from './projections/schema/restaurant-fact.schema';

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

export interface RestaurantAnalyticsData {
  totalRevenue: number;
  orderCount: number;
  deliveredCount: number;
  cancelledCount: number;
  avgPrepMinutes: number | null;
  revenueByDay: { date: string; revenue: number }[];
  ordersByDay: { date: string; count: number }[];
  topItems: {
    menuItemId: string;
    name: string;
    quantity: number;
    revenue: number;
  }[];
}

const COMMISSION_RATE = 0.15;

/**
 * AdminAnalyticsRepository — reads exclusively from Reporting's own event-fed
 * projection tables (`reporting_order_facts`, `reporting_order_item_facts`,
 * `reporting_restaurant_facts`). It NEVER touches another service's database, so
 * there are no cross-service joins; the prep-time metric uses the
 * confirmedAt/readyAt columns the order-projection consumer stamps.
 */
@Injectable()
export class AdminAnalyticsRepository {
  constructor(
    @Inject(REPORTING_DATABASE) private readonly db: ReportingDatabase,
  ) {}

  async getPlatformScalars(start: Date, end: Date): Promise<PlatformScalars> {
    const windowFilter = and(
      gte(reportingOrderFacts.placedAt, start),
      lt(reportingOrderFacts.placedAt, end),
    );

    const rows = await this.db
      .select({
        gmv: sql<number>`COALESCE(SUM(${reportingOrderFacts.totalAmount}), 0)::bigint`,
        orderCount: count(),
        deliveredCount: sql<number>`COUNT(*) FILTER (WHERE ${reportingOrderFacts.status} = 'delivered')::int`,
        failedCount: sql<number>`COUNT(*) FILTER (WHERE ${reportingOrderFacts.status} IN ('cancelled', 'refunded'))::int`,
      })
      .from(reportingOrderFacts)
      .where(windowFilter);

    const r = rows[0];
    return {
      gmv: Number(r?.gmv ?? 0),
      orderCount: Number(r?.orderCount ?? 0),
      deliveredCount: r?.deliveredCount ?? 0,
      failedCount: r?.failedCount ?? 0,
    };
  }

  async getRestaurantCounts(): Promise<RestaurantCounts> {
    const rows = await this.db
      .select({
        online: sql<number>`COUNT(*) FILTER (WHERE ${reportingRestaurantFacts.isApproved} = true  AND ${reportingRestaurantFacts.isOpen} = true)::int`,
        offline: sql<number>`COUNT(*) FILTER (WHERE ${reportingRestaurantFacts.isApproved} = true  AND ${reportingRestaurantFacts.isOpen} = false)::int`,
        pending: sql<number>`COUNT(*) FILTER (WHERE ${reportingRestaurantFacts.isApproved} = false)::int`,
      })
      .from(reportingRestaurantFacts);

    const r = rows[0];
    return {
      online: r?.online ?? 0,
      offline: r?.offline ?? 0,
      pending: r?.pending ?? 0,
    };
  }

  async getHourlyLoad(start: Date, end: Date): Promise<HourlyPoint[]> {
    const rows = await this.db
      .select({
        hour: sql<string>`date_trunc('hour', ${reportingOrderFacts.placedAt})`.as(
          'hour',
        ),
        orders: count().as('orders'),
        revenue:
          sql<number>`COALESCE(SUM(${reportingOrderFacts.totalAmount}), 0)::bigint`.as(
            'revenue',
          ),
      })
      .from(reportingOrderFacts)
      .where(
        and(
          gte(reportingOrderFacts.placedAt, start),
          lt(reportingOrderFacts.placedAt, end),
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

  async getTopEarners(
    start: Date,
    end: Date,
    limit = 5,
  ): Promise<TopEarnerRow[]> {
    const rows = await this.db
      .select({
        restaurantId: reportingOrderFacts.restaurantId,
        restaurantName: reportingOrderFacts.restaurantName,
        gmv: sql<number>`COALESCE(SUM(${reportingOrderFacts.totalAmount}), 0)::bigint`,
        orderCount: count(),
      })
      .from(reportingOrderFacts)
      .where(
        and(
          gte(reportingOrderFacts.placedAt, start),
          lt(reportingOrderFacts.placedAt, end),
          notInArray(reportingOrderFacts.status, ['cancelled', 'refunded']),
        ),
      )
      .groupBy(
        reportingOrderFacts.restaurantId,
        reportingOrderFacts.restaurantName,
      )
      .orderBy(desc(sql`COALESCE(SUM(${reportingOrderFacts.totalAmount}), 0)`))
      .limit(limit);

    return rows.map((r) => ({
      restaurantId: r.restaurantId,
      restaurantName: r.restaurantName,
      gmv: Number(r.gmv),
      orderCount: Number(r.orderCount),
    }));
  }

  async getBottlenecks(
    start: Date,
    end: Date,
    limit = 5,
  ): Promise<BottleneckRow[]> {
    const windowFilter = and(
      gte(reportingOrderFacts.placedAt, start),
      lt(reportingOrderFacts.placedAt, end),
    );

    // CTE 1: cancel rate per restaurant
    const orderStats = this.db.$with('order_stats').as(
      this.db
        .select({
          restaurantId: reportingOrderFacts.restaurantId,
          restaurantName: reportingOrderFacts.restaurantName,
          total: count().as('total'),
          failed:
            sql<number>`COUNT(*) FILTER (WHERE ${reportingOrderFacts.status} IN ('cancelled', 'refunded'))::int`.as(
              'failed',
            ),
        })
        .from(reportingOrderFacts)
        .where(windowFilter)
        .groupBy(
          reportingOrderFacts.restaurantId,
          reportingOrderFacts.restaurantName,
        ),
    );

    // CTE 2: avg prep time (confirmed → ready_for_pickup) per restaurant —
    // straight from the stamped columns, no status-log self-join needed.
    const prepLatency = this.db.$with('prep_latency').as(
      this.db
        .select({
          restaurantId: reportingOrderFacts.restaurantId,
          avgPrepSeconds:
            sql<number>`AVG(EXTRACT(EPOCH FROM (${reportingOrderFacts.readyAt} - ${reportingOrderFacts.confirmedAt})))::float8`.as(
              'avg_prep_seconds',
            ),
        })
        .from(reportingOrderFacts)
        .where(
          and(
            windowFilter,
            isNotNull(reportingOrderFacts.confirmedAt),
            isNotNull(reportingOrderFacts.readyAt),
          ),
        )
        .groupBy(reportingOrderFacts.restaurantId),
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
          sql`${orderStats.total} >= 5`,
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

  async getOrdersByDistrict(
    start: Date,
    end: Date,
    limit = 15,
  ): Promise<DistrictRow[]> {
    const rows = await this.db
      .select({
        district: reportingOrderFacts.district,
        orderCount: count().as('order_count'),
      })
      .from(reportingOrderFacts)
      .where(
        and(
          gte(reportingOrderFacts.placedAt, start),
          lt(reportingOrderFacts.placedAt, end),
          isNotNull(reportingOrderFacts.district),
          ne(reportingOrderFacts.district, ''),
        ),
      )
      .groupBy(reportingOrderFacts.district)
      .orderBy(desc(sql`order_count`))
      .limit(limit);

    return rows.map((r) => ({
      district: r.district ?? '',
      orderCount: Number(r.orderCount),
    }));
  }

  get commissionRate(): number {
    return COMMISSION_RATE;
  }

  async getRestaurantAnalyticsData(
    restaurantId: string,
    start: Date,
    end: Date,
  ): Promise<RestaurantAnalyticsData> {
    const windowFilter = and(
      eq(reportingOrderFacts.restaurantId, restaurantId),
      gte(reportingOrderFacts.placedAt, start),
      lt(reportingOrderFacts.placedAt, end),
    );

    const scalarsQuery = this.db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(${reportingOrderFacts.totalAmount} - ${reportingOrderFacts.shippingFee}) FILTER (WHERE ${reportingOrderFacts.status} = 'delivered'), 0)::bigint`,
        orderCount: count(),
        deliveredCount: sql<number>`COUNT(*) FILTER (WHERE ${reportingOrderFacts.status} = 'delivered')::int`,
        cancelledCount: sql<number>`COUNT(*) FILTER (WHERE ${reportingOrderFacts.status} IN ('cancelled', 'refunded'))::int`,
      })
      .from(reportingOrderFacts)
      .where(windowFilter);

    const prepQuery = this.db
      .select({
        avgPrepSeconds:
          sql<number>`AVG(EXTRACT(EPOCH FROM (${reportingOrderFacts.readyAt} - ${reportingOrderFacts.confirmedAt})))::float8`,
      })
      .from(reportingOrderFacts)
      .where(
        and(
          windowFilter,
          isNotNull(reportingOrderFacts.confirmedAt),
          isNotNull(reportingOrderFacts.readyAt),
        ),
      );

    const dailyQuery = this.db
      .select({
        day: sql<string>`date_trunc('day', ${reportingOrderFacts.placedAt})`.as(
          'day',
        ),
        orders: count().as('orders'),
        revenue:
          sql<number>`COALESCE(SUM(${reportingOrderFacts.totalAmount} - ${reportingOrderFacts.shippingFee}) FILTER (WHERE ${reportingOrderFacts.status} = 'delivered'), 0)::bigint`.as(
            'revenue',
          ),
      })
      .from(reportingOrderFacts)
      .where(windowFilter)
      .groupBy(sql`day`)
      .orderBy(asc(sql`day`));

    const topItemsQuery = this.db
      .select({
        menuItemId: reportingOrderItemFacts.menuItemId,
        name: reportingOrderItemFacts.itemName,
        quantity: sql<number>`SUM(${reportingOrderItemFacts.quantity})::bigint`,
        revenue: sql<number>`SUM(${reportingOrderItemFacts.revenue})::bigint`,
      })
      .from(reportingOrderItemFacts)
      .innerJoin(
        reportingOrderFacts,
        eq(reportingOrderFacts.orderId, reportingOrderItemFacts.orderId),
      )
      .where(and(windowFilter, eq(reportingOrderFacts.status, 'delivered')))
      .groupBy(
        reportingOrderItemFacts.menuItemId,
        reportingOrderItemFacts.itemName,
      )
      .orderBy(desc(sql`SUM(${reportingOrderItemFacts.quantity})`))
      .limit(10);

    const [scalarsRows, prepRows, dailyRows, itemsRows] = await Promise.all([
      scalarsQuery,
      prepQuery,
      dailyQuery,
      topItemsQuery,
    ]);

    const scalars = scalarsRows[0];
    const avgPrepMinutes =
      prepRows[0]?.avgPrepSeconds != null
        ? Math.round(Number(prepRows[0].avgPrepSeconds) / 60)
        : null;

    return {
      totalRevenue: Number(scalars?.totalRevenue ?? 0),
      orderCount: Number(scalars?.orderCount ?? 0),
      deliveredCount: Number(scalars?.deliveredCount ?? 0),
      cancelledCount: Number(scalars?.cancelledCount ?? 0),
      avgPrepMinutes,
      revenueByDay: dailyRows.map((row) => ({
        date: new Date(row.day).toISOString(),
        revenue: Number(row.revenue),
      })),
      ordersByDay: dailyRows.map((row) => ({
        date: new Date(row.day).toISOString(),
        count: Number(row.orders),
      })),
      topItems: itemsRows.map((row) => ({
        menuItemId: row.menuItemId,
        name: row.name,
        quantity: Number(row.quantity),
        revenue: Number(row.revenue),
      })),
    };
  }
}
