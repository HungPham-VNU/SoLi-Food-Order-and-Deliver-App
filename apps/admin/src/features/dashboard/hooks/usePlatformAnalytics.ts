import { useQuery } from '@tanstack/react-query';
import { platformAnalyticsApi, type AnalyticsRange } from '../api/platformAnalytics.api';

export const platformAnalyticsKeys = {
  all: () => ['admin', 'analytics', 'platform'] as const,
  byRange: (range: AnalyticsRange) => ['admin', 'analytics', 'platform', range] as const,
};

export function usePlatformAnalytics(range: AnalyticsRange = 'today') {
  return useQuery({
    queryKey: platformAnalyticsKeys.byRange(range),
    queryFn:  () => platformAnalyticsApi.get(range),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
