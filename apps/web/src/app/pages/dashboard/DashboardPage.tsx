import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useMyRestaurant,
  useUpdateRestaurant,
} from '@/features/restaurant/hooks/useRestaurants';
import { useOrderCounts } from '@/features/dashboard/hooks/useOrderCounts';
import { useActiveOrders } from '@/features/orders/hooks/useOrders';
import { useDashboardRevenue } from '@/features/dashboard/hooks/useDashboardRevenue';
import type { OrderListItem } from '@/features/orders/types';

const PAD2 = (n: number) => String(n).padStart(2, '0');

function minutesAgo(isoString: string): number {
  return Math.floor((Date.now() - new Date(isoString).getTime()) / 60_000);
}

function isUrgent(order: OrderListItem): boolean {
  return (
    (order.status === 'pending' || order.status === 'paid') &&
    minutesAgo(order.createdAt) >= 10
  );
}

function formatAmount(vnd: number): string {
  if (vnd >= 1_000_000) return `₫${(vnd / 1_000_000).toFixed(1)}M`;
  return `₫${Math.round(vnd / 1_000)}k`;
}

function formatRevenue(vnd: number | null): string {
  if (vnd === null) return '—';
  if (vnd >= 1_000_000_000) return `₫${(vnd / 1_000_000_000).toFixed(1)}B`;
  if (vnd >= 1_000_000) return `₫${(vnd / 1_000_000).toFixed(1)}M`;
  return `₫${Math.round(vnd / 1_000)}k`;
}

function formatDeltaPct(pct: number | null): string {
  if (pct === null) return '';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

function formatOrderId(id: string): string {
  return `#${id.slice(0, 4).toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function OrderRow({ order }: { order: OrderListItem }) {
  const urgent = isUrgent(order);
  const age = minutesAgo(order.createdAt);

  return (
    <div
      className={[
        'p-5 rounded-2xl flex items-center justify-between gap-4 transition-all hover:shadow-md',
        urgent
          ? 'bg-[#fffaf9] border border-error/15'
          : 'bg-surface-container-low border border-outline-variant/30',
      ].join(' ')}
    >
      <div className="space-y-2 min-w-0">
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-lg text-on-surface">
            {formatOrderId(order.orderId)}
          </span>
          {urgent && (
            <span className="bg-error text-on-error text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-widest shadow-sm">
              Urgent
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs font-medium">
          <span className={`flex items-center gap-1 ${urgent ? 'text-error' : 'text-on-surface-variant'}`}>
            <span className="material-symbols-outlined text-[14px]">schedule</span>
            {age === 0 ? 'Just now' : `${age} min ago`}
          </span>
          <span className="text-on-surface-variant flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">shopping_bag</span>
            {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
          </span>
        </div>
        <p className="font-body text-sm text-on-surface font-medium leading-relaxed truncate max-w-[200px]">
          {order.firstItemName}
        </p>
      </div>

      <div className="flex flex-col items-end gap-3 shrink-0">
        <span className="font-mono font-bold text-xl text-on-surface">
          {formatAmount(order.totalAmount)}
        </span>
        <Link
          to={`/orders/${order.orderId}`}
          className={[
            'font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm transition-all active:scale-95',
            urgent
              ? 'bg-primary text-on-primary hover:bg-primary/90'
              : 'border border-primary/20 text-primary hover:bg-primary/5',
          ].join(' ')}
        >
          View Order
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function DashboardPage() {
  const { data: restaurant, isLoading: loadingRestaurant } = useMyRestaurant();
  const { mutate: updateRestaurant, isPending: updatingStore } = useUpdateRestaurant();
  const { inProgress, readyForPickup, urgentReady, isLoading: loadingOrders } = useOrderCounts();
  const { data: activeOrders = [] } = useActiveOrders();
  const { totalRevenue, avgOrderValue, orderCount, revenueDeltaPct, isLoading: loadingRevenue } =
    useDashboardRevenue();
  const [alertDismissed, setAlertDismissed] = useState(false);

  const isOpen = restaurant?.isOpen ?? false;
  const toggleStore = (next: boolean) => {
    if (!restaurant || next === restaurant.isOpen) return;
    updateRestaurant({ id: restaurant.id, data: { isOpen: next } });
  };

  // Sort: urgent first, then by createdAt desc
  const sortedOrders = [...activeOrders]
    .filter((o) => o.status !== 'ready_for_pickup' && o.status !== 'picked_up' && o.status !== 'delivering' && o.status !== 'delivered')
    .sort((a, b) => {
      if (isUrgent(a) && !isUrgent(b)) return -1;
      if (!isUrgent(a) && isUrgent(b)) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, 8);

  return (
    <div className="space-y-8 max-w-7xl mx-auto w-full">

      {/* Eyebrow */}
      <div className="flex items-center gap-3 text-on-surface-variant/70">
        <span className="text-[10px] font-bold tracking-widest uppercase">
          Operational Hub
        </span>
        <div className="h-px bg-outline-variant flex-1" />
      </div>

      {/* ── Section 1: Global Control Bar ── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Store Status */}
        <div className="lg:col-span-8 bg-surface-container-lowest rounded-2xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.03),0_2px_8px_-2px_rgba(0,0,0,0.02)] border border-black/[0.04] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden transition-all hover:shadow-[0_10px_30px_-4px_rgba(0,0,0,0.05),0_4px_12px_-2px_rgba(0,0,0,0.03)] hover:-translate-y-0.5">
          <div className="absolute -left-6 -top-6 w-24 h-24 bg-primary/5 rounded-full blur-xl" />
          <div className="flex items-center gap-5 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-surface-container border border-outline-variant text-primary flex items-center justify-center shrink-0 shadow-inner">
              <span className="material-symbols-outlined text-2xl">storefront</span>
            </div>
            <div>
              <h2 className="font-headline font-bold text-xl text-on-surface">Store Status</h2>
              <p className="font-body text-sm text-on-surface-variant mt-1">
                {loadingRestaurant
                  ? 'Loading…'
                  : isOpen
                  ? 'Currently accepting orders through all channels.'
                  : 'Store is closed. Not accepting new orders.'}
              </p>
            </div>
          </div>
          <div className="bg-surface-container p-1.5 rounded-full flex items-center shrink-0 border border-outline-variant/50 shadow-inner">
            <button
              onClick={() => toggleStore(true)}
              disabled={updatingStore || loadingRestaurant}
              className={[
                'px-6 py-2.5 rounded-full font-headline font-semibold text-sm transition-all disabled:opacity-50',
                isOpen ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:text-on-surface',
              ].join(' ')}
            >
              Open
            </button>
            <button
              onClick={() => toggleStore(false)}
              disabled={updatingStore || loadingRestaurant}
              className={[
                'px-6 py-2.5 rounded-full font-headline font-semibold text-sm transition-all disabled:opacity-50',
                !isOpen ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:text-on-surface',
              ].join(' ')}
            >
              Closed
            </button>
          </div>
        </div>

        {/* Alerts */}
        <div className="lg:col-span-4 bg-surface-container-lowest rounded-2xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.03)] border border-black/[0.04] p-6 flex items-center transition-all hover:-translate-y-0.5">
          {!alertDismissed && urgentReady > 0 ? (
            <div className="flex-1 bg-[#fffaf9] border border-error/15 rounded-xl p-4 flex items-center gap-4 shadow-sm">
              <span className="material-symbols-outlined text-error text-xl shrink-0">warning</span>
              <div className="flex-1 min-w-0">
                <p className="font-headline font-bold text-sm text-on-error-container leading-tight">
                  {urgentReady} Urgent {urgentReady === 1 ? 'Order' : 'Orders'}
                </p>
                <p className="font-body text-xs text-on-error-container/70 mt-1">
                  Waiting &gt; 10 mins
                </p>
              </div>
              <button
                onClick={() => setAlertDismissed(true)}
                className="text-error/60 hover:text-error transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          ) : (
            <div className="flex-1 bg-surface-container-low border border-outline-variant/30 rounded-xl p-4 flex items-center gap-3 shadow-sm">
              <span className="material-symbols-outlined text-primary text-xl shrink-0">check_circle</span>
              <p className="text-sm text-on-surface-variant font-medium">No pending alerts</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Section 2: KPI Grid ── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* In Progress */}
        <div className="bg-primary-container rounded-2xl p-6 relative overflow-hidden group shadow-[0_4px_20px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_10px_30px_-4px_rgba(0,0,0,0.05)] hover:-translate-y-0.5 transition-all">
          <div className="absolute inset-0 opacity-[0.08] mix-blend-overlay bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E')]" />
          <div className="relative z-10">
            <p className="font-body text-sm font-medium text-on-primary-container/80 mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">local_dining</span>
              In Progress (Active)
            </p>
            <h3 className="font-mono font-bold text-5xl text-on-primary-container tracking-tight">
              {loadingOrders ? '—' : PAD2(inProgress)}
            </h3>
          </div>
          <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700" />
        </div>

        {/* Outbound */}
        <div className="bg-secondary-container rounded-2xl p-6 relative overflow-hidden group shadow-[0_4px_20px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_10px_30px_-4px_rgba(0,0,0,0.05)] hover:-translate-y-0.5 transition-all">
          <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E')]" />
          <div className="relative z-10">
            <p className="font-body text-sm font-medium text-on-secondary-container/80 mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">takeout_dining</span>
              Outbound (Ready)
            </p>
            <h3 className="font-mono font-bold text-5xl text-on-secondary-container tracking-tight">
              {loadingOrders ? '—' : PAD2(readyForPickup)}
            </h3>
          </div>
          <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700" />
        </div>

        {/* Today's Revenue */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 border border-black/[0.04] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_10px_30px_-4px_rgba(0,0,0,0.05)] hover:-translate-y-0.5 transition-all group">
          <p className="font-body text-sm font-medium text-on-surface-variant mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm opacity-70">payments</span>
            Today's Revenue
          </p>
          <h3 className={`font-mono font-bold text-4xl text-on-surface tracking-tight ${loadingRevenue ? 'animate-pulse text-on-surface/30' : ''}`}>
            {formatRevenue(totalRevenue)}
          </h3>
          {revenueDeltaPct !== null ? (
            <p className={`font-body text-xs font-semibold mt-3 inline-flex items-center gap-1 px-2 py-1 rounded-md ${revenueDeltaPct >= 0 ? 'bg-primary/5 text-primary' : 'bg-error-container/40 text-error'}`}>
              <span className="material-symbols-outlined text-[14px]">
                {revenueDeltaPct >= 0 ? 'trending_up' : 'trending_down'}
              </span>
              {formatDeltaPct(revenueDeltaPct)} vs last week
            </p>
          ) : (
            !loadingRevenue && (
              <p className="font-body text-xs text-on-surface-variant mt-3">
                No prior week data
              </p>
            )
          )}
        </div>

        {/* Avg Order Value */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 border border-black/[0.04] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_10px_30px_-4px_rgba(0,0,0,0.05)] hover:-translate-y-0.5 transition-all group">
          <p className="font-body text-sm font-medium text-on-surface-variant mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm opacity-70">receipt</span>
            Avg Order Value
          </p>
          <h3 className={`font-mono font-bold text-4xl text-on-surface tracking-tight ${loadingRevenue ? 'animate-pulse text-on-surface/30' : ''}`}>
            {formatRevenue(avgOrderValue)}
          </h3>
          <p className="font-body text-xs text-on-surface-variant mt-3 font-medium">
            {orderCount !== null
              ? <>Across <span className="font-mono">{orderCount}</span> order{orderCount !== 1 ? 's' : ''} today</>
              : 'Loading…'}
          </p>
        </div>
      </section>

      {/* ── Section 3: Active Orders ── */}
      <section className="pb-8">
        <div className="bg-surface-container-lowest rounded-2xl border border-black/[0.04] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.03)] overflow-hidden">
          <div className="p-6 pb-4 border-b border-outline-variant/50 bg-surface/50 backdrop-blur-sm">
            <h3 className="font-headline font-bold text-lg text-on-surface">
              Urgent &amp; Recent Orders
            </h3>
            <p className="font-body text-sm text-on-surface-variant">
              Managing real-time order flow
            </p>
          </div>

          <div className="p-6">
            {sortedOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant/40">receipt_long</span>
                <p className="text-sm text-on-surface-variant">No active orders right now.</p>
                <p className="text-xs text-on-surface-variant/60">New orders will appear here automatically.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {sortedOrders.map((order) => (
                  <OrderRow key={order.orderId} order={order} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
