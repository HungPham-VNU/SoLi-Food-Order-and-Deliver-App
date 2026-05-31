import { useState } from 'react';
import type { AnalyticsRange } from '@/features/analytics/types';
import { decorateFailureSegment } from '@/features/analytics/types';
import { useOperationalAnalytics } from '@/features/analytics/hooks/useOperationalAnalytics';
import { OperationalStateBanner } from '@/features/analytics/components/OperationalStateBanner';
import { KpiRow } from '@/features/analytics/components/KpiRow';
import { TimeToAcceptHistogram } from '@/features/analytics/components/TimeToAcceptHistogram';
import { FailureDonut } from '@/features/analytics/components/FailureDonut';
import { HourlyDensityChart } from '@/features/analytics/components/HourlyDensityChart';
import { RefundRateChart } from '@/features/analytics/components/RefundRateChart';
import { SlowItemsTable } from '@/features/analytics/components/SlowItemsTable';
import { IncidentsList } from '@/features/analytics/components/IncidentsList';
import { Skeleton } from '@/components/ui/skeleton';

const RANGES: { key: AnalyticsRange; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: 'Last 7 Days' },
];

export function AnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>('today');
  const [compareBaseline, setCompareBaseline] = useState(true);

  const { data, isLoading, isError, error } = useOperationalAnalytics(range);

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-headline text-2xl font-bold text-on-surface">
            Operational Analytics
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            How the kitchen is performing right now, and where to look first.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 self-start sm:self-auto px-4 py-2 bg-surface-container-lowest border border-outline-variant text-primary rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-surface-container transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          Export
        </button>
      </header>

      <section className="sticky top-0 z-30 -mx-4 px-4 py-3 bg-background/95 backdrop-blur-sm border-b border-outline-variant/40 flex flex-wrap items-center gap-3 sm:flex-nowrap sm:justify-between lg:-mx-6 lg:px-6">
        <div className="flex items-center gap-2">
          {RANGES.map((r) => {
            const isActive = r.key === range;
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                className={[
                  'px-4 py-1.5 rounded-full text-xs font-semibold transition-colors',
                  isActive
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-surface-container-lowest border border-outline-variant text-on-surface hover:bg-surface-container',
                ].join(' ')}
              >
                {r.label}
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <span className="text-xs font-semibold text-on-surface-variant">vs 7-day baseline</span>
          <span
            className={[
              'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
              compareBaseline ? 'bg-primary' : 'bg-surface-container-highest',
            ].join(' ')}
            onClick={() => setCompareBaseline((v) => !v)}
          >
            <span
              className={[
                'inline-block h-4 w-4 transform rounded-full bg-white shadow transition',
                compareBaseline ? 'translate-x-4' : 'translate-x-0.5',
              ].join(' ')}
            />
          </span>
        </label>
      </section>

      {isLoading && <AnalyticsSkeleton />}

      {isError && (
        <div className="bg-error-container/30 border border-error/30 text-error rounded-2xl p-6 text-sm">
          Couldn't load analytics: {(error as Error)?.message ?? 'Unknown error'}.
        </div>
      )}

      {data && (
        <>
          <OperationalStateBanner state={data.current.operationalState} />

          <KpiRow kpi={data.current.kitchenKpi} />

          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7">
              <TimeToAcceptHistogram buckets={data.current.timeToAcceptBuckets} />
            </div>
            <div className="lg:col-span-5">
              <FailureDonut
                segments={data.current.failureSegments.map(decorateFailureSegment)}
              />
            </div>
          </section>

          <HourlyDensityChart
            current={data.current.hourlyDensity}
            baseline={data.baseline.hourlyDensity}
            showBaseline={compareBaseline}
          />

          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
              <RefundRateChart series={data.current.refundRateSeries} />
            </div>
            <div className="lg:col-span-4">
              <SlowItemsTable items={data.current.slowItems} />
            </div>
          </section>

          <IncidentsList incidents={data.current.incidents} />
        </>
      )}
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <Skeleton className="md:col-span-4 h-44 rounded-2xl" />
        <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Skeleton className="lg:col-span-7 h-80 rounded-2xl" />
        <Skeleton className="lg:col-span-5 h-80 rounded-2xl" />
      </div>
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}
