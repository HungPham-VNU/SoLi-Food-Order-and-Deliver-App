import { Injectable } from '@nestjs/common';
import { AdminAnalyticsRepository } from './admin-analytics.repository';
import {
  computeWindows,
  type AnalyticsRange,
} from '@/shared/analytics-windows';
import type {
  PlatformAnalyticsResponseDto,
  PlatformKpisDto,
} from './dto/admin-analytics.dto';

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly repo: AdminAnalyticsRepository) {}

  async getPlatformAnalytics(
    range: AnalyticsRange = 'today',
  ): Promise<PlatformAnalyticsResponseDto> {
    const now = new Date();
    const { current, baseline } = computeWindows(range, now);

    // Run all queries in parallel — current window + baseline GMV for delta
    const [
      currentScalars,
      baselineScalars,
      restaurantCounts,
      hourlyLoad,
      topEarners,
      bottlenecks,
      ordersByDistrict,
    ] = await Promise.all([
      this.repo.getPlatformScalars(current.start, current.end),
      this.repo.getPlatformScalars(baseline.start, baseline.end),
      this.repo.getRestaurantCounts(),
      this.repo.getHourlyLoad(current.start, current.end),
      this.repo.getTopEarners(current.start, current.end),
      this.repo.getBottlenecks(current.start, current.end),
      this.repo.getOrdersByDistrict(current.start, current.end),
    ]);

    const cr = this.repo.commissionRate;
    const gmvDelta =
      baselineScalars.gmv > 0
        ? ((currentScalars.gmv - baselineScalars.gmv) / baselineScalars.gmv) *
          100
        : null;

    const terminal = currentScalars.deliveredCount + currentScalars.failedCount;
    const successRate =
      terminal > 0 ? currentScalars.deliveredCount / terminal : 1;

    const kpis: PlatformKpisDto = {
      gmv: currentScalars.gmv,
      revenue: Math.round(currentScalars.gmv * cr),
      gmvDelta: gmvDelta !== null ? Math.round(gmvDelta * 10) / 10 : null,
      orderCount: currentScalars.orderCount,
      deliveredCount: currentScalars.deliveredCount,
      failedCount: currentScalars.failedCount,
      successRate: Math.round(successRate * 1000) / 1000,
      restaurantsOnline: restaurantCounts.online,
      restaurantsOffline: restaurantCounts.offline,
      restaurantsPending: restaurantCounts.pending,
    };

    return {
      range,
      generatedAt: now.toISOString(),
      windowStart: current.start.toISOString(),
      windowEnd: current.end.toISOString(),
      kpis,
      hourlyLoad: hourlyLoad.map((p) => ({
        hour: p.hour.toISOString(),
        orders: p.orders,
        revenue: p.revenue,
      })),
      topEarners: topEarners.map((r) => ({
        restaurantId: r.restaurantId,
        restaurantName: r.restaurantName,
        gmv: r.gmv,
        orderCount: r.orderCount,
      })),
      bottlenecks: bottlenecks.map((b) => ({
        restaurantId: b.restaurantId,
        restaurantName: b.restaurantName,
        cancelRate: Math.round(b.cancelRate * 1000) / 1000,
        avgPrepMinutes: b.avgPrepMinutes,
        orderCount: b.orderCount,
        primaryIssue: b.primaryIssue,
      })),
      ordersByDistrict: ordersByDistrict.map((d) => ({
        district: d.district,
        orderCount: d.orderCount,
      })),
    };
  }
}
