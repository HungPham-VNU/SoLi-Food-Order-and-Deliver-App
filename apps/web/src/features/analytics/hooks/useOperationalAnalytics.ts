import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../api/analytics.api';
import type { AnalyticsRange } from '../types';

export const analyticsKeys = {
  operational: (range: AnalyticsRange) => ['analytics', 'operational', range] as const,
};

export function useOperationalAnalytics(range: AnalyticsRange) {
  return useQuery({
    queryKey: analyticsKeys.operational(range),
    queryFn: () => analyticsApi.getOperational(range),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
