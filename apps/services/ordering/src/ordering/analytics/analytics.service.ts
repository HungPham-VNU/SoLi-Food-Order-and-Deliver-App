import { ForbiddenException, Injectable } from '@nestjs/common';
import { RestaurantSnapshotRepository } from '../acl/repositories/restaurant-snapshot.repository';
import {
  AnalyticsRepository,
  type AnalyticsWindowAggregates,
} from './analytics.repository';
import type { CancellationReason } from '../order/order.schema';
import { computeWindows, ANALYTICS_RANGES } from '@/shared/analytics-windows';
import {
  type AnalyticsRange,
  type AnalyticsBundleDto,
  type FailureSegmentDto,
  type HourlyDensityPointDto,
  type IncidentDto,
  type KitchenKpiDto,
  type KpiDeltaDto,
  type AnalyticsResponseDto,
  type OperationalStateDto,
  type RefundRatePointDto,
  type SlowItemDto,
} from './dto/analytics.dto';

const SLA_ACCEPT_SECONDS = 180; // 3-minute target — matches the analytics page

/**
 * AnalyticsService
 *
 * - Resolves the caller's restaurant from the auth snapshot.
 * - Computes the current and baseline window bounds for the requested range.
 * - Asks the repository for both windows in parallel.
 * - Maps raw aggregate rows into the DTO the frontend consumes.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly repo: AnalyticsRepository,
    private readonly restaurantSnapshotRepo: RestaurantSnapshotRepository,
  ) {}

  async getOperational(
    ownerId: string,
    range: AnalyticsRange = 'today',
  ): Promise<AnalyticsResponseDto> {
    const snapshot = await this.restaurantSnapshotRepo.findByOwnerId(ownerId);
    if (!snapshot) {
      throw new ForbiddenException(
        'No restaurant found for the authenticated user.',
      );
    }

    if (!ANALYTICS_RANGES.includes(range)) {
      range = 'today';
    }

    const now = new Date();
    const { current, baseline } = computeWindows(range, now);

    const [currentAgg, baselineAgg] = await Promise.all([
      this.repo.aggregateWindow(
        snapshot.restaurantId,
        current.start,
        current.end,
      ),
      this.repo.aggregateWindow(
        snapshot.restaurantId,
        baseline.start,
        baseline.end,
      ),
    ]);

    return {
      range,
      generatedAt: now.toISOString(),
      windowStart: current.start.toISOString(),
      windowEnd: current.end.toISOString(),
      current: buildBundle(currentAgg, baselineAgg),
      baseline: buildBundle(baselineAgg, baselineAgg),
    };
  }
}

// ---------------------------------------------------------------------------
// DTO mapping
// ---------------------------------------------------------------------------

function buildBundle(
  agg: AnalyticsWindowAggregates,
  baseline: AnalyticsWindowAggregates,
): AnalyticsBundleDto {
  return {
    operationalState: buildOperationalState(agg, baseline),
    kitchenKpi: buildKitchenKpi(agg, baseline),
    timeToAcceptBuckets: agg.acceptBuckets,
    failureSegments: agg.failureSegments.map<FailureSegmentDto>((s) => ({
      reasonCode: s.reasonCode,
      count: s.count,
    })),
    hourlyDensity: agg.hourlyDensity.map<HourlyDensityPointDto>((p) => ({
      hour: p.hour.toISOString(),
      count: p.count,
    })),
    refundRateSeries: agg.refundRateSeries.map<RefundRatePointDto>((p) => ({
      hour: p.hour.toISOString(),
      rate: round(p.rate, 4),
    })),
    slowItems: agg.slowItems.map<SlowItemDto>((s) => ({
      menuItemId: s.menuItemId,
      name: s.name,
      avgPrepSeconds: s.avgPrepSeconds,
    })),
    incidents: agg.incidents.map<IncidentDto>(toIncidentDto),
    totalRevenue: agg.totalRevenue,
    avgOrderValue: agg.avgOrderValue,
    orderCount: agg.orderCount,
  };
}

function buildOperationalState(
  agg: AnalyticsWindowAggregates,
  baseline: AnalyticsWindowAggregates,
): OperationalStateDto {
  const delta =
    agg.avgTimeToAcceptSeconds !== null &&
    baseline.avgTimeToAcceptSeconds !== null
      ? agg.avgTimeToAcceptSeconds - baseline.avgTimeToAcceptSeconds
      : 0;

  let status: 'healthy' | 'attention' | 'critical' = 'healthy';
  if (agg.stuckOrderCount > 0 || (agg.autoCancelRate ?? 0) > 0.05) {
    status = 'critical';
  } else if (
    delta > 30 ||
    (agg.avgTimeToAcceptSeconds ?? 0) > SLA_ACCEPT_SECONDS
  ) {
    status = 'attention';
  }

  return {
    status,
    deltaSeconds: Math.round(delta),
    stuckOrderCount: agg.stuckOrderCount,
    sparkline: agg.sparkline,
  };
}

function buildKitchenKpi(
  agg: AnalyticsWindowAggregates,
  baseline: AnalyticsWindowAggregates,
): KitchenKpiDto {
  return {
    hero: secondsKpi(
      'Average time to accept',
      agg.avgTimeToAcceptSeconds,
      baseline.avgTimeToAcceptSeconds,
    ),
    supporting: [
      secondsKpi(
        'Time to Ready',
        agg.avgTimeToReadySeconds,
        baseline.avgTimeToReadySeconds,
      ),
      percentKpi('Refund Rate', agg.refundRate, baseline.refundRate),
      percentKpi(
        'Auto-Cancel Rate',
        agg.autoCancelRate,
        baseline.autoCancelRate,
      ),
    ],
  };
}

function secondsKpi(
  label: string,
  current: number | null,
  baseline: number | null,
): KpiDeltaDto {
  if (current === null) {
    return { label, value: '—', delta: 0, direction: 'flat' };
  }
  const delta = baseline !== null ? current - baseline : 0;
  return {
    label,
    value: formatSeconds(current),
    delta: Math.round(delta),
    direction: classify(delta, 1),
  };
}

function percentKpi(
  label: string,
  current: number | null,
  baseline: number | null,
): KpiDeltaDto {
  if (current === null) {
    return { label, value: '—', delta: 0, direction: 'flat' };
  }
  const delta = baseline !== null ? current - baseline : 0;
  return {
    label,
    value: `${round(current * 100, 1).toFixed(1)}%`,
    delta: round(delta, 4),
    direction: classify(delta, 0.0005),
  };
}

function classify(
  delta: number,
  flatThreshold: number,
): 'up' | 'down' | 'flat' {
  if (Math.abs(delta) <= flatThreshold) return 'flat';
  return delta > 0 ? 'up' : 'down';
}

function formatSeconds(seconds: number): string {
  const safe = Math.max(Math.round(seconds), 0);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function toIncidentDto(row: {
  id: string;
  orderId: string;
  timestamp: Date;
  fromStatus: string | null;
  toStatus: string;
  cancellationReason: CancellationReason | null;
  note: string | null;
}): IncidentDto {
  return {
    id: row.id,
    orderId: row.orderId,
    timestamp: row.timestamp.toISOString(),
    title: incidentTitle(row),
    detail: row.note ?? '',
    state:
      row.toStatus === 'cancelled' || row.toStatus === 'refunded'
        ? 'resolved'
        : 'pending',
  };
}

function incidentTitle(row: {
  toStatus: string;
  cancellationReason: CancellationReason | null;
}): string {
  if (row.toStatus === 'refunded') return 'Refund processed';
  if (row.toStatus === 'cancelled') {
    switch (row.cancellationReason) {
      case 'timeout':
        return 'Order auto-cancelled (timeout)';
      case 'payment_failed':
        return 'Order cancelled (payment failed)';
      case 'driver_no_show':
        return 'Cancelled — driver no-show';
      case 'kitchen_cancel':
        return 'Kitchen cancellation';
      case 'out_of_stock':
        return 'Cancelled — out of stock';
      case 'customer_request':
        return 'Customer-requested cancellation';
      default:
        return 'Order cancelled';
    }
  }
  return `System transition → ${row.toStatus}`;
}
