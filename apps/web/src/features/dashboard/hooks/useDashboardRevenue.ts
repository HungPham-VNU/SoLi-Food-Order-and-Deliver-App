import { useOperationalAnalytics } from '@/features/analytics/hooks/useOperationalAnalytics';

/** Revenue stats for today, derived from the analytics bundle. */
export function useDashboardRevenue() {
  const { data, isLoading } = useOperationalAnalytics('today');

  const current = data?.current;
  const baseline = data?.baseline;

  const totalRevenue = current?.totalRevenue ?? null;
  const avgOrderValue = current?.avgOrderValue ?? null;
  const orderCount = current?.orderCount ?? null;

  // Week-over-week delta for the revenue badge
  const baselineRevenue = baseline?.totalRevenue ?? null;
  const revenueDeltaPct =
    baselineRevenue && baselineRevenue > 0 && totalRevenue !== null
      ? ((totalRevenue - baselineRevenue) / baselineRevenue) * 100
      : null;

  return { totalRevenue, avgOrderValue, orderCount, revenueDeltaPct, isLoading };
}
