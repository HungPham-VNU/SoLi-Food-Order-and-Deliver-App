import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  sql,
  and,
  or,
  gte,
  lt,
  eq,
  inArray,
  desc,
  asc,
  isNotNull,
  count,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import * as schema from '@/drizzle/schema';
import type { CancellationReason } from '../order/order.schema';

/**
 * Raw, pre-DTO shape returned by aggregate queries. Numeric strings from pg are
 * coerced to `number` here so the service layer can stay shape-pure.
 */
export interface AnalyticsWindowAggregates {
  /** avg seconds between order creation and the 'confirmed' transition */
  avgTimeToAcceptSeconds: number | null;
  /** avg seconds between order creation and the 'ready_for_pickup' transition */
  avgTimeToReadySeconds: number | null;
  /** count(refunded) / count(delivered + refunded) — 0..1, or null when no delivered+refunded rows */
  refundRate: number | null;
  /** count(system + cancelled) / count(* in window) — 0..1, or null when no orders in window */
  autoCancelRate: number | null;
  /** Total orders created in the window */
  orderCount: number;
  /** Sum of totalAmount for all orders in the window (integer VND) */
  totalRevenue: number;
  /** Average totalAmount across all orders in the window (integer VND, 0 when no orders) */
  avgOrderValue: number;
  /** Active orders currently past their expiresAt (snapshot, not window-bounded) */
  stuckOrderCount: number;
  /** Histogram buckets for accept latency in 30-second wide bins from 0 to 5 min (10 buckets) */
  acceptBuckets: number[];
  /** Cancellation/refund counts grouped by reason code */
  failureSegments: Array<{ reasonCode: CancellationReason; count: number }>;
  /** Hourly created-order counts, oldest hour first */
  hourlyDensity: Array<{ hour: Date; count: number }>;
  /** Hourly refund rate (0..1) */
  refundRateSeries: Array<{ hour: Date; rate: number }>;
  /** Slowest-to-prep menu items by avg confirmed → ready latency */
  slowItems: Array<{
    menuItemId: string;
    name: string;
    avgPrepSeconds: number;
  }>;
  /** System-triggered transitions in window (auto-cancels, timeouts, etc.) */
  incidents: Array<{
    id: string;
    orderId: string;
    timestamp: Date;
    fromStatus: string | null;
    toStatus: string;
    cancellationReason: CancellationReason | null;
    note: string | null;
  }>;
  /** Sparkline: avg accept seconds bucketed across 10 sub-windows of the window */
  sparkline: number[];
}

/**
 * AnalyticsRepository
 *
 * One method per window. Each method runs the aggregation via Drizzle's typed
 * query builder with $with CTEs where multiple passes are needed. All queries
 * are scoped by `restaurantId` + `[windowStart, windowEnd)`.
 */
@Injectable()
export class AnalyticsRepository {
  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async aggregateWindow(
    restaurantId: string,
    windowStart: Date,
    windowEnd: Date,
  ): Promise<AnalyticsWindowAggregates> {
    const [
      scalars,
      acceptBuckets,
      failureSegments,
      hourlyDensity,
      refundSeries,
      slowItems,
      incidents,
      sparkline,
      stuckCount,
    ] = await Promise.all([
      this.queryScalars(restaurantId, windowStart, windowEnd),
      this.queryAcceptBuckets(restaurantId, windowStart, windowEnd),
      this.queryFailureSegments(restaurantId, windowStart, windowEnd),
      this.queryHourlyDensity(restaurantId, windowStart, windowEnd),
      this.queryRefundRateSeries(restaurantId, windowStart, windowEnd),
      this.querySlowItems(restaurantId, windowStart, windowEnd),
      this.queryIncidents(restaurantId, windowStart, windowEnd),
      this.querySparkline(restaurantId, windowStart, windowEnd),
      this.queryStuckCount(restaurantId),
    ]);

    return {
      ...scalars,
      stuckOrderCount: stuckCount,
      acceptBuckets,
      failureSegments,
      hourlyDensity,
      refundRateSeries: refundSeries,
      slowItems,
      incidents,
      sparkline,
    };
  }

  // ---------------------------------------------------------------------------
  // Private query builders
  // ---------------------------------------------------------------------------

  /**
   * Four parallel Drizzle queries that produce all scalar KPI values:
   *  1. avg time-to-accept (epoch seconds) — join orders + status_logs on 'confirmed'
   *  2. avg time-to-ready (epoch seconds)  — join orders + status_logs on 'ready_for_pickup'
   *  3. order counts (total / refunded / terminal) — orders table only
   *  4. auto-cancel count — COUNT(DISTINCT orderId) where role='system' & to='cancelled'
   */
  private async queryScalars(
    restaurantId: string,
    start: Date,
    end: Date,
  ): Promise<{
    avgTimeToAcceptSeconds: number | null;
    avgTimeToReadySeconds: number | null;
    refundRate: number | null;
    autoCancelRate: number | null;
    orderCount: number;
    totalRevenue: number;
    avgOrderValue: number;
  }> {
    // Reusable WHERE clause for the window on the orders table.
    const windowFilter = and(
      eq(schema.orders.restaurantId, restaurantId),
      gte(schema.orders.createdAt, start),
      lt(schema.orders.createdAt, end),
    );

    const [acceptRows, readyRows, countsRows, autoCancelRows] =
      await Promise.all([
        // 1. avg time-to-accept
        this.db
          .select({
            avg: sql<
              number | null
            >`EXTRACT(EPOCH FROM AVG(${schema.orderStatusLogs.createdAt} - ${schema.orders.createdAt}))`,
          })
          .from(schema.orders)
          .innerJoin(
            schema.orderStatusLogs,
            and(
              eq(schema.orderStatusLogs.orderId, schema.orders.id),
              eq(schema.orderStatusLogs.toStatus, 'confirmed'),
            ),
          )
          .where(windowFilter),

        // 2. avg time-to-ready
        this.db
          .select({
            avg: sql<
              number | null
            >`EXTRACT(EPOCH FROM AVG(${schema.orderStatusLogs.createdAt} - ${schema.orders.createdAt}))`,
          })
          .from(schema.orders)
          .innerJoin(
            schema.orderStatusLogs,
            and(
              eq(schema.orderStatusLogs.orderId, schema.orders.id),
              eq(schema.orderStatusLogs.toStatus, 'ready_for_pickup'),
            ),
          )
          .where(windowFilter),

        // 3. order counts + revenue — orders table only, no join needed
        this.db
          .select({
            total: count(),
            refunded: sql<number>`COUNT(*) FILTER (WHERE ${schema.orders.status} = 'refunded')::int`,
            terminal: sql<number>`COUNT(*) FILTER (WHERE ${schema.orders.status} IN ('delivered', 'refunded'))::int`,
            totalRevenue: sql<number>`COALESCE(SUM(${schema.orders.totalAmount}), 0)::int`,
            avgOrderValue: sql<number>`COALESCE(AVG(${schema.orders.totalAmount}), 0)::int`,
          })
          .from(schema.orders)
          .where(windowFilter),

        // 4. auto-cancel count (distinct orders, system-triggered)
        this.db
          .select({
            n: sql<number>`COUNT(DISTINCT ${schema.orderStatusLogs.orderId})::int`,
          })
          .from(schema.orderStatusLogs)
          .innerJoin(
            schema.orders,
            eq(schema.orders.id, schema.orderStatusLogs.orderId),
          )
          .where(
            and(
              windowFilter,
              eq(schema.orderStatusLogs.toStatus, 'cancelled'),
              eq(schema.orderStatusLogs.triggeredByRole, 'system'),
            ),
          ),
      ]);

    const orderCount = Number(countsRows[0]?.total ?? 0);
    const refundedCount = countsRows[0]?.refunded ?? 0;
    const terminalCount = countsRows[0]?.terminal ?? 0;
    const autoCancelCount = autoCancelRows[0]?.n ?? 0;

    return {
      avgTimeToAcceptSeconds: acceptRows[0]?.avg ?? null,
      avgTimeToReadySeconds: readyRows[0]?.avg ?? null,
      refundRate: terminalCount > 0 ? refundedCount / terminalCount : null,
      autoCancelRate: orderCount > 0 ? autoCancelCount / orderCount : null,
      orderCount,
      totalRevenue: countsRows[0]?.totalRevenue ?? 0,
      avgOrderValue: Math.round(countsRows[0]?.avgOrderValue ?? 0),
    };
  }

  /**
   * Accept-latency histogram: 10 buckets × 30 seconds (0–300 s).
   * Uses a $with CTE to scope the joined latency rows, then width_bucket to assign bins.
   */
  private async queryAcceptBuckets(
    restaurantId: string,
    start: Date,
    end: Date,
  ): Promise<number[]> {
    const acceptLatency = this.db.$with('accept_latency').as(
      this.db
        .select({
          seconds:
            sql<number>`EXTRACT(EPOCH FROM (${schema.orderStatusLogs.createdAt} - ${schema.orders.createdAt}))`.as(
              'seconds',
            ),
        })
        .from(schema.orders)
        .innerJoin(
          schema.orderStatusLogs,
          eq(schema.orderStatusLogs.orderId, schema.orders.id),
        )
        .where(
          and(
            eq(schema.orders.restaurantId, restaurantId),
            gte(schema.orders.createdAt, start),
            lt(schema.orders.createdAt, end),
            eq(schema.orderStatusLogs.toStatus, 'confirmed'),
          ),
        ),
    );

    const rows = await this.db
      .with(acceptLatency)
      .select({
        bucket:
          sql<number>`width_bucket(LEAST(${acceptLatency.seconds}, 299.999), 0, 300, 10)`.as(
            'bucket',
          ),
        n: count().as('n'),
      })
      .from(acceptLatency)
      .where(gte(acceptLatency.seconds, 0))
      .groupBy(sql`bucket`)
      .orderBy(asc(sql`bucket`));

    const buckets = new Array<number>(10).fill(0);
    for (const r of rows) {
      const b = r.bucket;
      if (b >= 1 && b <= 10) buckets[b - 1] = Number(r.n);
    }
    return buckets;
  }

  /**
   * Groups cancelled/refunded status-log rows by cancellation_reason.
   * Defaults to 'other' when the field is NULL (pre-enum orders).
   */
  private async queryFailureSegments(
    restaurantId: string,
    start: Date,
    end: Date,
  ): Promise<Array<{ reasonCode: CancellationReason; count: number }>> {
    const rows = await this.db
      .select({
        reasonCode:
          sql<string>`COALESCE(${schema.orderStatusLogs.cancellationReason}, 'other')`.as(
            'reason_code',
          ),
        n: count().as('n'),
      })
      .from(schema.orders)
      .innerJoin(
        schema.orderStatusLogs,
        eq(schema.orderStatusLogs.orderId, schema.orders.id),
      )
      .where(
        and(
          eq(schema.orders.restaurantId, restaurantId),
          gte(schema.orders.createdAt, start),
          lt(schema.orders.createdAt, end),
          inArray(schema.orderStatusLogs.toStatus, ['cancelled', 'refunded']),
        ),
      )
      .groupBy(sql`reason_code`)
      .orderBy(desc(sql`n`));

    return rows.map((r) => ({
      reasonCode: r.reasonCode as CancellationReason,
      count: Number(r.n),
    }));
  }

  /** Hour-by-hour order volume across the window. */
  private async queryHourlyDensity(
    restaurantId: string,
    start: Date,
    end: Date,
  ): Promise<Array<{ hour: Date; count: number }>> {
    const rows = await this.db
      .select({
        hour: sql<string>`date_trunc('hour', ${schema.orders.createdAt})`.as(
          'hour',
        ),
        n: count().as('n'),
      })
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.restaurantId, restaurantId),
          gte(schema.orders.createdAt, start),
          lt(schema.orders.createdAt, end),
        ),
      )
      .groupBy(sql`hour`)
      .orderBy(asc(sql`hour`));

    return rows.map((r) => ({ hour: new Date(r.hour), count: Number(r.n) }));
  }

  /** Hour-by-hour refund rate (refunded / terminal) across the window. */
  private async queryRefundRateSeries(
    restaurantId: string,
    start: Date,
    end: Date,
  ): Promise<Array<{ hour: Date; rate: number }>> {
    const rows = await this.db
      .select({
        hour: sql<string>`date_trunc('hour', ${schema.orders.createdAt})`.as(
          'hour',
        ),
        refunded: sql<number>`COUNT(*) FILTER (WHERE ${schema.orders.status} = 'refunded')::int`,
        terminal: sql<number>`COUNT(*) FILTER (WHERE ${schema.orders.status} IN ('delivered', 'refunded'))::int`,
      })
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.restaurantId, restaurantId),
          gte(schema.orders.createdAt, start),
          lt(schema.orders.createdAt, end),
        ),
      )
      .groupBy(sql`hour`)
      .orderBy(asc(sql`hour`));

    return rows.map((r) => ({
      hour: new Date(r.hour),
      rate: r.terminal > 0 ? r.refunded / r.terminal : 0,
    }));
  }

  /**
   * Top-5 slowest menu items by avg confirmed → ready_for_pickup latency.
   * Uses two aliased joins on order_status_logs to pick up both transition timestamps.
   */
  private async querySlowItems(
    restaurantId: string,
    start: Date,
    end: Date,
  ): Promise<
    Array<{ menuItemId: string; name: string; avgPrepSeconds: number }>
  > {
    const lConf = alias(schema.orderStatusLogs, 'l_conf');
    const lReady = alias(schema.orderStatusLogs, 'l_ready');

    const prepLatency = this.db.$with('prep_latency').as(
      this.db
        .select({
          orderId: schema.orders.id,
          seconds:
            sql<number>`EXTRACT(EPOCH FROM (${lReady.createdAt} - ${lConf.createdAt}))`.as(
              'seconds',
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
            eq(schema.orders.restaurantId, restaurantId),
            gte(schema.orders.createdAt, start),
            lt(schema.orders.createdAt, end),
          ),
        ),
    );

    const rows = await this.db
      .with(prepLatency)
      .select({
        menuItemId: schema.orderItems.menuItemId,
        name: schema.orderItems.itemName,
        avgSeconds: sql<number>`AVG(${prepLatency.seconds})::float8`.as(
          'avg_seconds',
        ),
      })
      .from(prepLatency)
      .innerJoin(
        schema.orderItems,
        eq(schema.orderItems.orderId, prepLatency.orderId),
      )
      .groupBy(schema.orderItems.menuItemId, schema.orderItems.itemName)
      .having(sql`COUNT(*) >= 2`)
      .orderBy(desc(sql`avg_seconds`))
      .limit(5);

    return rows.map((r) => ({
      menuItemId: r.menuItemId,
      name: r.name,
      avgPrepSeconds: Math.round(r.avgSeconds),
    }));
  }

  /**
   * Most-recent 10 notable events in the window: system-triggered transitions,
   * cancellations, or refunds.
   */
  private async queryIncidents(
    restaurantId: string,
    start: Date,
    end: Date,
  ): Promise<
    Array<{
      id: string;
      orderId: string;
      timestamp: Date;
      fromStatus: string | null;
      toStatus: string;
      cancellationReason: CancellationReason | null;
      note: string | null;
    }>
  > {
    const rows = await this.db
      .select({
        id: schema.orderStatusLogs.id,
        orderId: schema.orderStatusLogs.orderId,
        timestamp: schema.orderStatusLogs.createdAt,
        fromStatus: schema.orderStatusLogs.fromStatus,
        toStatus: schema.orderStatusLogs.toStatus,
        cancellationReason: schema.orderStatusLogs.cancellationReason,
        note: schema.orderStatusLogs.note,
      })
      .from(schema.orderStatusLogs)
      .innerJoin(
        schema.orders,
        eq(schema.orders.id, schema.orderStatusLogs.orderId),
      )
      .where(
        and(
          eq(schema.orders.restaurantId, restaurantId),
          gte(schema.orderStatusLogs.createdAt, start),
          lt(schema.orderStatusLogs.createdAt, end),
          or(
            and(
              eq(schema.orderStatusLogs.triggeredByRole, 'system'),
              isNotNull(schema.orderStatusLogs.fromStatus),
            ),
            eq(schema.orderStatusLogs.toStatus, 'cancelled'),
            eq(schema.orderStatusLogs.toStatus, 'refunded'),
          ),
        ),
      )
      .orderBy(desc(schema.orderStatusLogs.createdAt))
      .limit(10);

    return rows.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      timestamp: new Date(r.timestamp),
      fromStatus: r.fromStatus,
      toStatus: r.toStatus,
      cancellationReason: r.cancellationReason,
      note: r.note,
    }));
  }

  /**
   * Ten-point sparkline of avg accept latency across equal sub-windows of the period.
   * Used by the operational-state banner.
   */
  private async querySparkline(
    restaurantId: string,
    start: Date,
    end: Date,
  ): Promise<number[]> {
    const windowMs = end.getTime() - start.getTime();
    const sliceMs = Math.max(Math.floor(windowMs / 10), 1);

    const acceptLatency = this.db.$with('accept_latency').as(
      this.db
        .select({
          createdAt: schema.orders.createdAt,
          seconds:
            sql<number>`EXTRACT(EPOCH FROM (${schema.orderStatusLogs.createdAt} - ${schema.orders.createdAt}))`.as(
              'seconds',
            ),
        })
        .from(schema.orders)
        .innerJoin(
          schema.orderStatusLogs,
          eq(schema.orderStatusLogs.orderId, schema.orders.id),
        )
        .where(
          and(
            eq(schema.orders.restaurantId, restaurantId),
            gte(schema.orders.createdAt, start),
            lt(schema.orders.createdAt, end),
            eq(schema.orderStatusLogs.toStatus, 'confirmed'),
          ),
        ),
    );

    const rows = await this.db
      .with(acceptLatency)
      .select({
        slice:
          sql<number>`FLOOR(EXTRACT(EPOCH FROM (${acceptLatency.createdAt} - ${start.toISOString()}::timestamptz)) * 1000 / ${sliceMs})::int`.as(
            'slice',
          ),
        avgSeconds: sql<number>`AVG(${acceptLatency.seconds})::float8`.as(
          'avg_seconds',
        ),
      })
      .from(acceptLatency)
      .groupBy(sql`slice`)
      .orderBy(asc(sql`slice`));

    const series = new Array<number>(10).fill(0);
    for (const r of rows) {
      if (r.slice >= 0 && r.slice <= 9) {
        series[r.slice] = Math.round(r.avgSeconds);
      }
    }
    return series;
  }

  /** Count of active orders whose acceptance deadline has already passed. */
  private async queryStuckCount(restaurantId: string): Promise<number> {
    const rows = await this.db
      .select({ n: count() })
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.restaurantId, restaurantId),
          inArray(schema.orders.status, [
            'pending',
            'paid',
            'confirmed',
            'preparing',
            'ready_for_pickup',
          ]),
          isNotNull(schema.orders.expiresAt),
          lt(schema.orders.expiresAt, sql`now()`),
        ),
      );

    return Number(rows[0]?.n ?? 0);
  }
}
