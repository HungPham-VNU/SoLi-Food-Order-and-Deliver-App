import { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Store,
  CircleCheck,
  CircleX,
  AlertTriangle,
  Clock,
  ChevronRight,
  BadgeDollarSign,
  HandCoins,
  Award,
  ExternalLink,
  FileWarning,
} from 'lucide-react';
import { PlatformLoadChart } from '@/features/dashboard/components/PlatformLoadChart';
import { LiveOrderMap } from '@/features/dashboard/components/LiveOrderMap';
import { usePlatformAnalytics } from '@/features/dashboard/hooks/usePlatformAnalytics';
import { formatVND } from '@/features/dashboard/mockData';
import type { AnalyticsRange } from '@/features/dashboard/api/platformAnalytics.api';
import type {
  PlatformKpis,
  TopEarner,
  Bottleneck,
} from '@/features/dashboard/api/platformAnalytics.api';

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-container ${className ?? ''}`} />;
}

function KpiCard({
  label, value, subtext, delta, icon, accent,
}: {
  label: string; value: string; subtext?: string;
  delta?: { value: number | null; suffix: string };
  icon: React.ReactNode; accent?: boolean;
}) {
  const isPositive = (delta?.value ?? 0) >= 0;

  return (
    <div className={[
      'relative rounded-2xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)]',
      accent ? 'bg-primary-container border-primary/20' : 'bg-surface-container-lowest border-outline-variant/40',
    ].join(' ')}>
      <div className="flex items-start justify-between mb-4">
        <span className={[
          'flex h-9 w-9 items-center justify-center rounded-xl',
          accent ? 'bg-primary/15 text-on-primary-container' : 'bg-surface-container text-primary',
        ].join(' ')}>
          {icon}
        </span>
        {delta?.value != null && (
          <span className={[
            'inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full',
            isPositive ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error',
          ].join(' ')}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isPositive ? '+' : ''}{delta.value.toFixed(1)}{delta.suffix}
          </span>
        )}
      </div>
      <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${accent ? 'text-on-primary-container/70' : 'text-on-surface-variant'}`}>
        {label}
      </p>
      <p className={`font-headline font-extrabold text-3xl tracking-tight font-mono ${accent ? 'text-on-primary-container' : 'text-on-surface'}`}>
        {value}
      </p>
      {subtext && (
        <p className={`text-xs mt-2 font-medium ${accent ? 'text-on-primary-container/60' : 'text-on-surface-variant'}`}>
          {subtext}
        </p>
      )}
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="rounded-2xl p-5 bg-surface-container-lowest border border-outline-variant/40 space-y-3">
      <Skeleton className="h-9 w-9 rounded-xl" />
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}

function SeverityBadge({ severity }: { severity: 'critical' | 'warning' | 'info' }) {
  const map = {
    critical: 'bg-error/10 text-error border-error/20',
    warning:  'bg-secondary-container/40 text-on-secondary-container border-secondary/20',
    info:     'bg-surface-container text-on-surface-variant border-outline-variant',
  } as const;
  const label = { critical: 'Critical', warning: 'Warning', info: 'Watch' };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${map[severity]}`}>
      {label[severity]}
    </span>
  );
}

function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="font-headline font-bold text-base text-on-surface">{title}</h3>
        {subtitle && <p className="text-xs text-on-surface-variant mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI grid
// ---------------------------------------------------------------------------

function KpiGrid({ kpis }: { kpis: PlatformKpis }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        label="Platform GMV"
        value={formatVND(kpis.gmv)}
        subtext="Total order value today"
        delta={kpis.gmvDelta != null ? { value: kpis.gmvDelta, suffix: '%' } : undefined}
        icon={<BadgeDollarSign className="h-4 w-4" />}
        accent
      />
      <KpiCard
        label="Platform Revenue"
        value={formatVND(kpis.revenue)}
        subtext="Commission & fees (15%)"
        delta={kpis.gmvDelta != null ? { value: kpis.gmvDelta, suffix: '%' } : undefined}
        icon={<HandCoins className="h-4 w-4" />}
      />
      <KpiCard
        label="Active Operations"
        value={String(kpis.restaurantsOnline)}
        subtext={`${kpis.restaurantsOffline} offline · ${kpis.restaurantsPending} pending`}
        icon={<Store className="h-4 w-4" />}
      />
      <KpiCard
        label="Order Success Rate"
        value={formatPct(kpis.successRate)}
        subtext={`${kpis.deliveredCount} delivered · ${kpis.failedCount} failed`}
        icon={<CircleCheck className="h-4 w-4" />}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top earners
// ---------------------------------------------------------------------------

function TopEarnersList({ earners }: { earners: TopEarner[] }) {
  if (earners.length === 0) {
    return <p className="text-sm text-on-surface-variant py-6 text-center">No orders in this window.</p>;
  }
  return (
    <ol className="space-y-2">
      {earners.map((r, idx) => {
        const rank = idx + 1;
        return (
          <li key={r.restaurantId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-container transition-colors">
            <span className={[
              'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black shrink-0',
              rank === 1 ? 'bg-[#FFD700]/20 text-[#b8860b]'
              : rank === 2 ? 'bg-surface-container-high text-on-surface-variant'
              : rank === 3 ? 'bg-[#CD7F32]/15 text-[#8B4513]'
              : 'bg-surface-container text-on-surface-variant/60',
            ].join(' ')}>{rank}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-on-surface truncate">{r.restaurantName}</p>
              <p className="text-[11px] font-mono text-on-surface-variant">{r.orderCount} orders</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono font-bold text-sm text-on-surface">{formatVND(r.gmv)}</p>
            </div>
            {rank === 1 && <Award className="h-4 w-4 text-[#FFD700] shrink-0" />}
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Bottlenecks
// ---------------------------------------------------------------------------

function BottleneckList({ bottlenecks }: { bottlenecks: Bottleneck[] }) {
  if (bottlenecks.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 gap-2 text-center">
        <CircleCheck className="h-8 w-8 text-primary/40" />
        <p className="text-sm text-on-surface-variant">No bottlenecks detected.</p>
        <p className="text-xs text-on-surface-variant/60">All restaurants operating within normal thresholds.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {bottlenecks.map((b) => {
        const severity = b.cancelRate > 0.12 ? 'critical' : b.cancelRate > 0.05 ? 'warning' : 'info';
        return (
          <div key={b.restaurantId} className={[
            'p-3 rounded-xl border',
            severity === 'critical' ? 'bg-error/5 border-error/15'
            : severity === 'warning' ? 'bg-secondary-container/10 border-secondary/15'
            : 'bg-surface-container border-outline-variant/40',
          ].join(' ')}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-sm font-semibold text-on-surface leading-tight truncate">{b.restaurantName}</p>
              <SeverityBadge severity={severity} />
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              {b.primaryIssue === 'high-cancel' ? (
                <span className="flex items-center gap-1 text-error">
                  <CircleX className="h-3 w-3" />{formatPct(b.cancelRate)} cancel rate
                </span>
              ) : (
                <span className="flex items-center gap-1 text-on-surface-variant">
                  <Clock className="h-3 w-3" />{b.avgPrepMinutes}m avg prep
                </span>
              )}
              <span className="text-on-surface-variant">{b.orderCount} orders</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const RANGES: { key: AnalyticsRange; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: '7 Days' },
];

export function AdminDashboardPage() {
  const [range, setRange] = useState<AnalyticsRange>('today');
  const { data, isLoading, isError, error } = usePlatformAnalytics(range);

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto w-full pb-8">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-on-surface-variant/60">
            Platform Overview
          </span>
          <div className="h-px w-24 bg-outline-variant/40" />
          {!isLoading && (
            <span className="font-mono text-[10px] text-on-surface-variant/40">
              {data ? `Generated ${new Date(data.generatedAt).toLocaleTimeString()}` : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 bg-surface-container rounded-lg p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={[
                'px-3 py-1.5 rounded-md text-[11px] font-bold transition-colors',
                range === r.key ? 'bg-primary text-white' : 'text-on-surface-variant hover:text-on-surface',
              ].join(' ')}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {isError && (
        <div className="bg-error-container/30 border border-error/20 text-error rounded-xl px-4 py-3 text-sm">
          Failed to load analytics: {(error as Error)?.message ?? 'Unknown error'}
        </div>
      )}

      {/* Section 1: KPI cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <KpiSkeleton key={i} />)}
        </div>
      ) : data ? (
        <KpiGrid kpis={data.kpis} />
      ) : null}

      {/* Section 2: Chart + Map */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-5">
          <SectionHeader
            title="Live Platform Load"
            subtitle="Hourly orders and revenue"
            action={
              <div className="flex items-center gap-3 text-[11px] font-mono text-on-surface-variant">
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-primary inline-block rounded" /> Orders</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-secondary-container inline-block rounded" /> Revenue ₫M</span>
              </div>
            }
          />
          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : (
            <PlatformLoadChart data={data?.hourlyLoad ?? []} range={range} />
          )}
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-5">
          <SectionHeader title="System Heatmap" subtitle="Live order density across Ho Chi Minh City" />
          <LiveOrderMap districts={data?.ordersByDistrict ?? []} />
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: 'Active districts', value: isLoading ? '—' : String(data?.ordersByDistrict.length ?? 0) },
              { label: 'Top district', value: isLoading ? '—' : (data?.ordersByDistrict[0]?.district ?? '—') },
              { label: 'Peak hour', value: isLoading ? '—' : (data?.hourlyLoad.sort((a, b) => b.orders - a.orders)[0]?.hour.slice(11, 16) ?? '—') },
            ].map((stat) => (
              <div key={stat.label} className="bg-surface-container rounded-lg px-3 py-2 text-center">
                <p className="font-mono font-bold text-sm text-on-surface">{stat.value}</p>
                <p className="text-[10px] text-on-surface-variant mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 3: Leaderboard + Watchlist + Queue */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Top Earners */}
        <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-5">
          <SectionHeader
            title="Top Earners"
            subtitle="By GMV this period"
            action={<button className="text-[11px] font-semibold text-primary flex items-center gap-1 hover:underline">All <ChevronRight className="h-3 w-3" /></button>}
          />
          {isLoading
            ? <div className="space-y-2">{[0,1,2,3,4].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
            : <TopEarnersList earners={data?.topEarners ?? []} />}
        </div>

        {/* Bottleneck Watchlist */}
        <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-5">
          <SectionHeader
            title="Bottleneck Watchlist"
            subtitle="High cancel rate or slow prep"
            action={<AlertTriangle className="h-4 w-4 text-secondary-container" />}
          />
          {isLoading
            ? <div className="space-y-2">{[0,1,2,3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
            : <BottleneckList bottlenecks={data?.bottlenecks ?? []} />}
        </div>

        {/* Pending queue */}
        <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-5 flex flex-col gap-5">

          {/* Pending approvals — live count from KPI */}
          <div>
            <SectionHeader
              title="Pending Approvals"
              subtitle={data ? `${data.kpis.restaurantsPending} awaiting review` : '...'}
            />
            {data?.kpis.restaurantsPending === 0 ? (
              <div className="flex items-center gap-2 py-4 text-sm text-on-surface-variant">
                <CircleCheck className="h-4 w-4 text-primary/40 shrink-0" />
                No pending applications.
              </div>
            ) : (
              <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileWarning className="h-4 w-4 text-secondary-container shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-on-surface">
                      {isLoading ? '—' : data?.kpis.restaurantsPending} new {data?.kpis.restaurantsPending === 1 ? 'application' : 'applications'}
                    </p>
                    <p className="text-xs text-on-surface-variant">Require admin approval</p>
                  </div>
                </div>
                <a href="/restaurants" className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline shrink-0">
                  Review <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>


        </div>
      </section>
    </div>
  );
}
