import { useMemo, useState } from 'react';
import {
  Search,
  Download,
  Receipt,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  XCircle,
  MoreVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOrders } from '@/features/orders/hooks/useOrders';
import type {
  OrderListFilters,
  OrderStatus,
} from '@/features/orders/api/orders.api';
import {
  STATUS_META,
  formatRelative,
  formatVND,
  shortId,
} from '@/features/orders/utils/format';
import { OrderDetailSheet } from '@/features/orders/components/OrderDetailSheet';
import { PageHero } from '@/components/layout/PageHero';

const PAGE_SIZE = 25;

// Status pills shown at the top of the table (subset of all 10 statuses).
const STATUS_PILLS: { id: OrderStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'ready_for_pickup', label: 'Ready' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
];

export function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cod' | 'vnpay'>(
    'all',
  );
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const filters = useMemo<OrderListFilters>(
    () => ({
      ...(statusFilter !== 'all' && { status: statusFilter }),
      ...(paymentFilter !== 'all' && { paymentMethod: paymentFilter }),
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      sortBy: 'created_at',
      sortOrder: 'desc',
    }),
    [statusFilter, paymentFilter, page],
  );

  const { data, isLoading } = useOrders(filters);
  const orders = data?.data ?? [];
  const total = data?.total ?? 0;

  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter(
      (o) =>
        o.orderId.toLowerCase().includes(q) ||
        o.restaurantName.toLowerCase().includes(q) ||
        o.firstItemName?.toLowerCase().includes(q),
    );
  }, [orders, search]);

  // Stats are derived from the current page's worth of data (cheap, no extra API).
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = orders.filter(
      (o) => new Date(o.createdAt) >= today,
    );
    const revenue = todayOrders.reduce((acc, o) => acc + o.totalAmount, 0);
    const cancelled = orders.filter((o) => o.status === 'cancelled').length;
    const avg =
      todayOrders.length > 0
        ? Math.round(revenue / todayOrders.length)
        : 0;
    const cancelRate =
      orders.length > 0
        ? Math.round((cancelled / orders.length) * 1000) / 10
        : 0;
    return {
      todayCount: todayOrders.length,
      revenue,
      avg,
      cancelRate,
    };
  }, [orders]);

  // Per-status counts shown in the pills.
  const statusCounts = useMemo(() => {
    const counts = new Map<OrderStatus, number>();
    for (const o of orders) {
      counts.set(o.status, (counts.get(o.status) ?? 0) + 1);
    }
    return counts;
  }, [orders]);

  const fromIndex = page * PAGE_SIZE + 1;
  const toIndex = Math.min(fromIndex + filtered.length - 1, total);

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        eyebrow="Operations"
        title="Platform Orders"
        subtitle="Real-time view of all orders across the platform."
        icon={<Receipt className="h-6 w-6" />}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          icon={<Receipt className="h-5 w-5 text-blue-600" />}
          label="Total Orders (page)"
          value={String(stats.todayCount > 0 ? stats.todayCount : orders.length)}
          tone="blue"
        />
        <SummaryCard
          icon={<TrendingUp className="h-5 w-5 text-green-600" />}
          label="Revenue (page)"
          value={formatVND(stats.revenue)}
          tone="green"
        />
        <SummaryCard
          icon={<ShoppingCart className="h-5 w-5 text-violet-600" />}
          label="Avg Order Value"
          value={formatVND(stats.avg)}
          tone="violet"
        />
        <SummaryCard
          icon={<TrendingDown className="h-5 w-5 text-red-600" />}
          label="Cancellation Rate"
          value={`${stats.cancelRate}%`}
          tone="red"
        />
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID, restaurant, or item…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <select
          className="rounded-lg border bg-card px-3 py-2 text-sm font-medium text-on-surface"
          value={paymentFilter}
          onChange={(e) =>
            setPaymentFilter(e.target.value as 'all' | 'cod' | 'vnpay')
          }
        >
          <option value="all">All payments</option>
          <option value="cod">Cash on Delivery</option>
          <option value="vnpay">VNPay</option>
        </select>

        <Button variant="outline" size="sm" className="gap-2 ml-auto">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_PILLS.map((pill) => {
          const active = statusFilter === pill.id;
          const count =
            pill.id === 'all'
              ? orders.length
              : statusCounts.get(pill.id as OrderStatus) ?? 0;
          return (
            <button
              key={pill.id}
              onClick={() => {
                setStatusFilter(pill.id);
                setPage(0);
              }}
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium border transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-on-surface-variant border-border hover:bg-surface-container'
              }`}
            >
              <span>{pill.label}</span>
              <span
                className={`inline-flex items-center justify-center min-w-[1.5rem] h-5 rounded-full text-xs font-semibold ${
                  active
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-surface-container text-muted-foreground'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-surface-container/40">
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Order ID</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Restaurant</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground hidden md:table-cell">Items</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Total</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground hidden lg:table-cell">Created</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted-foreground">
                    <span className="material-symbols-outlined animate-spin text-3xl">
                      progress_activity
                    </span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted-foreground">
                    No orders match the current filters
                  </td>
                </tr>
              ) : (
                filtered.map((o) => {
                  const meta = STATUS_META[o.status];
                  return (
                    <tr
                      key={o.orderId}
                      onClick={() => setSelectedOrderId(o.orderId)}
                      className="border-b last:border-b-0 hover:bg-surface-container/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-on-surface">
                        {shortId(o.orderId)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-on-surface truncate max-w-[180px]">
                          {o.restaurantName}
                        </p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="text-on-surface">
                          {o.itemCount} {o.itemCount === 1 ? 'item' : 'items'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {o.firstItemName}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-on-surface whitespace-nowrap">
                        {formatVND(o.totalAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`${meta.badge} hover:${meta.badge}`}>
                          {meta.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                        {formatRelative(o.createdAt)}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedOrderId(o.orderId)}
                          >
                            View
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuGroup>
                                <DropdownMenuItem onClick={() => setSelectedOrderId(o.orderId)}>
                                  <Receipt className="mr-2 h-4 w-4" />
                                  View details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    navigator.clipboard.writeText(o.orderId)
                                  }
                                >
                                  <span className="mr-2 font-mono text-xs">#</span>
                                  Copy Order ID
                                </DropdownMenuItem>
                                {o.status !== 'cancelled' && o.status !== 'delivered' && (
                                  <DropdownMenuItem className="text-muted-foreground" disabled>
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Cancel (coming soon)
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && total > 0 && (
          <div className="border-t px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {fromIndex}–{toIndex} of {total.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground px-2">
                Page {page + 1} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={(page + 1) * PAGE_SIZE >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <OrderDetailSheet
        orderId={selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'blue' | 'green' | 'violet' | 'red';
}

function SummaryCard({ icon, label, value, tone }: SummaryCardProps) {
  const bg: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    violet: 'bg-violet-50 border-violet-200',
    red: 'bg-red-50 border-red-200',
  };
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-3 ${bg[tone]}`}>
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-on-surface truncate">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
