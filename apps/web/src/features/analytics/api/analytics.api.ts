import { apiClient } from '@/lib/api-client';
import type { AnalyticsRange, OperationalAnalyticsResponse } from '../types';

export const analyticsApi = {
  /** GET /restaurant/analytics/operational?range=... */
  getOperational: (range: AnalyticsRange) =>
    apiClient
      .get<OperationalAnalyticsResponse>('/api/restaurant/analytics/operational', {
        params: { range },
      })
      .then((r) => r.data),
};
