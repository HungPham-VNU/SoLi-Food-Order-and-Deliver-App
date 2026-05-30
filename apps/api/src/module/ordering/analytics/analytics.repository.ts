import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql, and, gte, lt, eq, inArray, desc, asc, isNotNull, count } from 'drizzle-orm';
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
  slowItems: Array<{ menuItemId: string; name: string; avgPrepSeconds: number }>;
  /** System-triggered transitions in window (auto-cancels, timeouts, etc.) */
  incidents: Array<{
    id: string;
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
 * One method per window. Each method runs the aggregation in a few parallel
 * Drizzle calls.
 *
 * All queries are scoped by `restaurantId` + `[windowStart, windowEnd)`.
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
  }> {
    // For this highly multi-faceted query, we use Drizzle CTEs and raw sql helper for subqueries
    // as it allows grouping disparate subqueries in a single trip.
    
    const rows = await this.db.execute(sql`
      WITH window_orders AS (
        SELECT id, status, created_at
        FROM orders
        WHERE restaurant_id = ${restaurantId}
          AND created_at >= ${start.toISOString()}
          AND created_at < ${end.toISOString()}
      ),
      accept_latency AS (
        SELECT EXTRACT(EPOCH FROM (l.created_at - o.created_at)) AS seconds
        FROM window_orders o
        JOIN order_status_logs l ON l.order_id = o.id
        WHERE l.to_status = 'confirmed'
      ),
      ready_latency AS (
        SELECT EXTRACT(EPOCH FROM (l.created_at - o.created_at)) AS seconds
        FROM window_orders o
        JOIN order_status_logs l ON l.order_id = o.id
        WHERE l.to_status = 'ready_for_pickup'
      ),
      auto_cancel AS (
        SELECT
          COUNT(*) FILTER (
            WHERE l.to_status = 'cancelled' AND l.triggered_by_role = 'system'
          )::int AS auto_cancelled
        FROM window_orders o
        JOIN order_status_logs l ON l.order_id = o.id
      )
      SELECT
        (SELECT AVG(seconds) FROM accept_latency)::float8 AS avg_accept,
        (SELECT AVG(seconds) FROM ready_latency)::float8 AS avg_ready,
        (SELECT COUNT(*) FROM window_orders WHERE status = 'refunded')::int AS refunded_count,
        (SELECT COUNT(*) FROM window_orders WHERE status IN ('delivered', 'refunded'))::int AS terminal_count,
        (SELECT auto_cancelled FROM auto_cancel)::int AS auto_cancelled,
        (SELECT COUNT(*) FROM window_orders)::int AS order_count
    `);

    const row = (rows.rows[0] ?? {}) as {
      avg_accept: number | null;
      avg_ready: number | null;
      refunded_count: number;
      terminal_count: number;
      auto_cancelled: number;
      order_count: number;
    };

    const refundRate =
      row.terminal_count > 0 ? row.refunded_count / row.terminal_count : null;
    const autoCancelRate =
      row.order_count > 0 ? row.auto_cancelled / row.order_count : null;

    return {
      avgTimeToAcceptSeconds: row.avg_accept,
      avgTimeToReadySeconds: row.avg_ready,
      refundRate,
      autoCancelRate,
      orderCount: row.order_count,
    };
  }

  private async queryAcceptBuckets(
    restaurantId: string,
    start: Date,
    end: Date,
  ): Promise<number[]> {
    // 10 buckets, 30 seconds each, 0..300s. Overflow goes to bucket 11 which we drop.
    const acceptLatency = this.db.$with('accept_latency').as(
      this.db.select({
        seconds: sql<number>`EXTRACT(EPOCH FROM (${schema.orderStatusLogs.createdAt} - ${schema.orders.createdAt}))`.as('seconds')
      })
      .from(schema.orders)
      .innerJoin(schema.orderStatusLogs, eq(schema.orderStatusLogs.orderId, schema.orders.id))
      .where(
        and(
          eq(schema.orders.restaurantId, restaurantId),
          gte(schema.orders.createdAt, start),
          lt(schema.orders.createdAt, end),
          eq(schema.orderStatusLogs.toStatus, 'confirmed')
        )
      )
    );

    const rows = await this.db.with(acceptLatency)
      .select({
        bucket: sql<number>`width_bucket(LEAST(seconds, 299.999), 0, 300, 10)`.as('bucket'),
        n: count().as('n')
      })
      .from(acceptLatency)
      .where(gte(acceptLatency.seconds, 0))
      .groupBy(sql`bucket`)
      .orderBy(asc(sql`bucket`));

    const buckets = new Array<number>(10).fill(0);
    for (const r of rows as Array<{ bucket: number; n: number }>) {
      if (r.bucket >= 1 && r.bucket <= 10) buckets[r.bucket - 1] = r.n;
    }
    return buckets;
  }

  private async queryFailureSegments(
    restaurantId: string,
    start: Date,
    end: Date,
  ): Promise<Array<{ reasonCode: CancellationReason; count: number }>> {
    const rows = await this.db
      .select({
        reasonCode: sql<string>`COALESCE(${schema.orderStatusLogs.cancellationReason}, 'other')`.as('reason_code'),
        n: count().as('n')
      })
      .from(schema.orders)
      .innerJoin(schema.orderStatusLogs, eq(schema.orderStatusLogs.orderId, schema.orders.id))
      .where(
        and(
          eq(schema.orders.restaurantId, restaurantId),
          gte(schema.orders.createdAt, start),
          lt(schema.orders.createdAt, end),
          inArray(schema.orderStatusLogs.toStatus, ['cancelled', 'refunded'])
        )
      )
      .groupBy(sql`reason_code`)
      .orderBy(desc(sql`n`));

    return rows.map((r) => ({
      reasonCode: r.reasonCode as CancellationReason,
      count: r.n,
    }));
  }

  private async queryHourlyDensity(
    restaurantId: string,
    start: Date,
    end: Date,
  ): Promise<Array<{ hour: Date; count: number }>> {
    const rows = await this.db
      .select({
        hour: sql<string>`date_trunc('hour', ${schema.orders.createdAt})`.as('hour'),
        n: count().as('n')
      })
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.restaurantId, restaurantId),
          gte(schema.orders.createdAt, start),
          lt(schema.orders.createdAt, end)
        )
      )
      .groupBy(sql`hour`)
      .orderBy(asc(sql`hour`));

    return rows.map((r) => ({
      hour: new Date(r.hour),
      count: r.n,
    }));
  }

  private async queryRefundRateSeries(
    restaurantId: string,
    start: Date,
    end: Date,
  ): Promise<Array<{ hour: Date; rate: number }>> {
    const rows = await this.db
      .select({
        hour: sql<string>`date_trunc('hour', ${schema.orders.createdAt})`.as('hour'),
        refunded: sql<number>`COUNT(*) FILTER (WHERE ${schema.orders.status} = 'refunded')::int`.as('refunded'),
        terminal: sql<number>`COUNT(*) FILTER (WHERE ${schema.orders.status} IN ('delivered', 'refunded'))::int`.as('terminal')
      })
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.restaurantId, restaurantId),
          gte(schema.orders.createdAt, start),
          lt(schema.orders.createdAt, end)
        )
      )
      .groupBy(sql`hour`)
      .orderBy(asc(sql`hour`));

    return rows.map((r) => ({
      hour: new Date(r.hour),
      rate: r.terminal > 0 ? r.refunded / r.terminal : 0,
    }));
  }

  private async querySlowItems(
    restaurantId: string,
    start: Date,
    end: Date,
  ): Promise<Array<{ menuItemId: string; name: string; avgPrepSeconds: number }>> {
    const lConf = alias(schema.orderStatusLogs, 'l_conf');
    const lReady = alias(schema.orderStatusLogs, 'l_ready');

    const prepLatency = this.db.$with('prep_latency').as(
      this.db.select({
        orderId: schema.orders.id,
        seconds: sql<number>`EXTRACT(EPOCH FROM (${lReady.createdAt} - ${lConf.createdAt}))`.as('seconds')
      })
      .from(schema.orders)
      .innerJoin(lConf, and(eq(lConf.orderId, schema.orders.id), eq(lConf.toStatus, 'confirmed')))
      .innerJoin(lReady, and(eq(lReady.orderId, schema.orders.id), eq(lReady.toStatus, 'ready_for_pickup')))
      .where(
        and(
          eq(schema.orders.restaurantId, restaurantId),
          gte(schema.orders.createdAt, start),
          lt(schema.orders.createdAt, end)
        )
      )
    );

    const rows = await this.db.with(prepLatency)
      .select({
        menuItemId: schema.orderItems.menuItemId,
        name: schema.orderItems.itemName,
        avgSeconds: sql<number>`AVG(${prepLatency.seconds})::float8`.as('avg_seconds')
      })
      .from(prepLatency)
      .innerJoin(schema.orderItems, eq(schema.orderItems.orderId, prepLatency.orderId))
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

  private async queryIncidents(
    restaurantId: string,
    start: Date,
    end: Date,
  ): Promise<
    Array<{
      id: string;
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
        timestamp: schema.orderStatusLogs.createdAt,
        fromStatus: schema.orderStatusLogs.fromStatus,
        toStatus: schema.orderStatusLogs.toStatus,
        cancellationReason: schema.orderStatusLogs.cancellationReason,
        note: schema.orderStatusLogs.note,
      })
      .from(schema.orderStatusLogs)
      .innerJoin(schema.orders, eq(schema.orders.id, schema.orderStatusLogs.orderId))
      .where(
        and(
          eq(schema.orders.restaurantId, restaurantId),
          gte(schema.orderStatusLogs.createdAt, start),
          lt(schema.orderStatusLogs.createdAt, end),
          sql`(${schema.orderStatusLogs.triggeredByRole} = 'system' OR ${schema.orderStatusLogs.toStatus} = 'cancelled' OR ${schema.orderStatusLogs.toStatus} = 'refunded')`
        )
      )
      .orderBy(desc(schema.orderStatusLogs.createdAt))
      .limit(10);

    return rows.map((r) => ({
      id: r.id,
      timestamp: new Date(r.timestamp),
      fromStatus: r.fromStatus,
      toStatus: r.toStatus,
      cancellationReason: r.cancellationReason as CancellationReason | null,
      note: r.note,
    }));
  }

  private async querySparkline(
    restaurantId: string,
    start: Date,
    end: Date,
  ): Promise<number[]> {
    const windowMs = end.getTime() - start.getTime();
    const sliceMs = Math.max(Math.floor(windowMs / 10), 1);

    const acceptLatency = this.db.$with('accept_latency').as(
      this.db.select({
        createdAt: schema.orders.createdAt,
        seconds: sql<number>`EXTRACT(EPOCH FROM (${schema.orderStatusLogs.createdAt} - ${schema.orders.createdAt}))`.as('seconds')
      })
      .from(schema.orders)
      .innerJoin(schema.orderStatusLogs, eq(schema.orderStatusLogs.orderId, schema.orders.id))
      .where(
        and(
          eq(schema.orders.restaurantId, restaurantId),
          gte(schema.orders.createdAt, start),
          lt(schema.orders.createdAt, end),
          eq(schema.orderStatusLogs.toStatus, 'confirmed')
        )
      )
    );

    const rows = await this.db.with(acceptLatency)
      .select({
        slice: sql<number>`FLOOR(EXTRACT(EPOCH FROM (${acceptLatency.createdAt} - ${start.toISOString()}::timestamptz)) * 1000 / ${sliceMs})::int`.as('slice'),
        avgSeconds: sql<number>`AVG(${acceptLatency.seconds})::float8`.as('avg_seconds')
      })
      .from(acceptLatency)
      .groupBy(sql`slice`)
      .orderBy(asc(sql`slice`));

    const series = new Array<number>(10).fill(0);
    for (const r of rows as Array<{ slice: number; avgSeconds: number }>) {
      if (r.slice >= 0 && r.slice <= 9) {
        series[r.slice] = Math.round(r.avgSeconds);
      }
    }
    return series;
  }

  private async queryStuckCount(restaurantId: string): Promise<number> {
    const rows = await this.db
      .select({ n: sql<number>`COUNT(*)::int`.as('n') })
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.restaurantId, restaurantId),
          inArray(schema.orders.status, ['pending', 'paid', 'confirmed', 'preparing', 'ready_for_pickup']),
          isNotNull(schema.orders.expiresAt),
          sql`${schema.orders.expiresAt} < NOW()`
        )
      );

    return rows[0]?.n ?? 0;
  }
}
