import { apiClient } from '@/lib/api-client';

export type AnalyticsRange = 'today' | 'yesterday' | '7d';

export interface PlatformKpis {
  gmv: number;
  revenue: number;
  gmvDelta: number | null;
  orderCount: number;
  deliveredCount: number;
  failedCount: number;
  successRate: number;
  restaurantsOnline: number;
  restaurantsOffline: number;
  restaurantsPending: number;
}

export interface HourlyLoadPoint {
  hour: string;
  orders: number;
  revenue: number;
}

export interface TopEarner {
  restaurantId: string;
  restaurantName: string;
  gmv: number;
  orderCount: number;
}

export interface Bottleneck {
  restaurantId: string;
  restaurantName: string;
  cancelRate: number;
  avgPrepMinutes: number | null;
  orderCount: number;
  primaryIssue: 'high-cancel' | 'slow-prep';
}

export interface OrderDistrict {
  district: string;
  orderCount: number;
}

export interface PlatformAnalyticsResponse {
  range: AnalyticsRange;
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  kpis: PlatformKpis;
  hourlyLoad: HourlyLoadPoint[];
  topEarners: TopEarner[];
  bottlenecks: Bottleneck[];
  ordersByDistrict: OrderDistrict[];
}

export const platformAnalyticsApi = {
  get: (range: AnalyticsRange = 'today') =>
    apiClient
      .get<PlatformAnalyticsResponse>('/api/admin/analytics/platform', { params: { range } })
      .then((r) => r.data),
};
