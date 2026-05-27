import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Tag,
  TrendingUp,
  Percent,
  Pause,
  Play,
  Pencil,
  X,
  MoreVertical,
  Globe,
  Store,
  Calendar,
  Ticket,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  usePromotions,
  useActivatePromotion,
  usePausePromotion,
  useCancelPromotion,
} from '@/features/promotions/hooks/usePromotions';
import type {
  Promotion,
  PromotionStatus,
} from '@/features/promotions/api/promotions.api';
import {
  STATUS_META,
  PROMOTION_TYPE_LABELS,
  formatDateRange,
  formatDiscount,
  formatVND,
  isScheduled,
} from '@/features/promotions/utils/format';
import { PageHero } from '@/components/layout/PageHero';

type FilterId =
  | 'all'
  | 'active'
  | 'scheduled'
  | 'draft'
  | 'paused'
  | 'expired'
  | 'cancelled';

const FILTER_PILLS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'draft', label: 'Draft' },
  { id: 'paused', label: 'Paused' },
  { id: 'expired', label: 'Expired' },
  { id: 'cancelled', label: 'Cancelled' },
];

export function PromotionsPage() {
  const [filter, setFilter] = useState<FilterId>('all');
  const { data, isLoading } = usePromotions({ limit: 100 });

  const promotions = useMemo(() => data?.items ?? [], [data?.items]);

  const counts = useMemo(() => {
    const c: Record<FilterId, number> = {
      all: promotions.length,
      active: 0,
      scheduled: 0,
      draft: 0,
      paused: 0,
      expired: 0,
      cancelled: 0,
    };
    for (const p of promotions) {
      if (isScheduled(p)) c.scheduled++;
      else if (p.status === 'active') c.active++;
      if (p.status === 'draft') c.draft++;
      if (p.status === 'paused') c.paused++;
      if (p.status === 'expired') c.expired++;
      if (p.status === 'cancelled') c.cancelled++;
    }
    return c;
  }, [promotions]);

  const filtered = useMemo(() => {
    if (filter === 'all') return promotions;
    if (filter === 'scheduled') return promotions.filter(isScheduled);
    if (filter === 'active') {
      return promotions.filter((p) => p.status === 'active' && !isScheduled(p));
    }
    return promotions.filter((p) => p.status === (filter as PromotionStatus));
  }, [promotions, filter]);

  const stats = useMemo(() => {
    const active = promotions.filter(
      (p) => p.status === 'active' && !isScheduled(p),
    ).length;
    const redemptions = promotions.reduce(
      (acc, p) => acc + p.currentTotalUses,
      0,
    );
    return { active, redemptions };
  }, [promotions]);

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        eyebrow="Marketing"
        title="Promotions"
        subtitle="Create and manage platform-wide and restaurant-specific promotions."
        icon={<Tag className="h-6 w-6" />}
        actions={
          <Button asChild className="gap-2 shadow-md shadow-primary/20">
            <Link to="/promotions/new">
              <Plus className="h-4 w-4" />
              New Promotion
            </Link>
          </Button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard
          icon={<Tag className="h-5 w-5 text-green-600" />}
          label="Active Promotions"
          value={String(stats.active)}
          tone="green"
        />
        <SummaryCard
          icon={<TrendingUp className="h-5 w-5 text-blue-600" />}
          label="Total Redemptions"
          value={stats.redemptions.toLocaleString()}
          tone="blue"
        />
        <SummaryCard
          icon={<Percent className="h-5 w-5 text-violet-600" />}
          label="Total Promotions"
          value={String(promotions.length)}
          tone="violet"
        />
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTER_PILLS.map((pill) => {
          const active = filter === pill.id;
          return (
            <button
              key={pill.id}
              onClick={() => setFilter(pill.id)}
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
                {counts[pill.id]}
              </span>
            </button>
          );
        })}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <span className="material-symbols-outlined animate-spin text-primary text-3xl">
            progress_activity
          </span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <div className="rounded-full bg-surface-container p-3 inline-flex mb-4">
            <Tag className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-on-surface">
            No promotions found
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {filter === 'all'
              ? 'Create your first promotion to get started.'
              : `No promotions match the "${filter}" filter.`}
          </p>
          {filter === 'all' && (
            <Button asChild className="mt-4 gap-2">
              <Link to="/promotions/new">
                <Plus className="h-4 w-4" />
                New Promotion
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((p) => (
            <PromotionCard key={p.id} promotion={p} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Promotion card
// ---------------------------------------------------------------------------

function PromotionCard({ promotion: p }: { promotion: Promotion }) {
  const activate = useActivatePromotion();
  const pause = usePausePromotion();
  const cancel = useCancelPromotion();

  const meta = STATUS_META[p.status];
  const usagePct = p.maxTotalUses
    ? Math.min(100, Math.round((p.currentTotalUses / p.maxTotalUses) * 100))
    : null;

  return (
    <div className="rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        {/* Left side: info */}
        <div className="min-w-0 flex-1 space-y-3">
          {/* Title row */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`${meta.badge} hover:${meta.badge} gap-1.5`}>
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                {meta.label}
              </Badge>
              {p.trigger === 'coupon_code' && (
                <Badge className="bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100 gap-1">
                  <Ticket className="h-3 w-3" />
                  Coupon
                </Badge>
              )}
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50 gap-1">
                {p.scope === 'platform' ? (
                  <Globe className="h-3 w-3" />
                ) : (
                  <Store className="h-3 w-3" />
                )}
                {p.scope === 'platform' ? 'Platform' : 'Restaurant'}
              </Badge>
            </div>
            <h3 className="text-base font-semibold text-on-surface mt-2">
              {p.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {PROMOTION_TYPE_LABELS[p.type]}
            </p>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-sm">
            <Detail label="Discount" value={formatDiscount(p)} />
            <Detail
              label="Min order"
              value={p.minOrderAmount ? formatVND(p.minOrderAmount) : '—'}
            />
            <Detail
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Active"
              value={formatDateRange(p.startsAt, p.endsAt)}
            />
            <Detail
              label="Usage"
              value={
                p.maxTotalUses
                  ? `${p.currentTotalUses.toLocaleString()} / ${p.maxTotalUses.toLocaleString()}`
                  : `${p.currentTotalUses.toLocaleString()} / ∞`
              }
            />
          </div>

          {/* Usage bar */}
          {usagePct != null && (
            <div className="h-1.5 rounded-full bg-surface-container overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  usagePct >= 90
                    ? 'bg-red-500'
                    : usagePct >= 70
                      ? 'bg-amber-500'
                      : 'bg-primary'
                }`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
          )}
        </div>

        {/* Right side: actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button asChild variant="outline" size="sm" className="gap-1">
            <Link to={`/promotions/${p.id}/edit`}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Link>
          </Button>

          {/* Pause/Resume button — context-sensitive */}
          {p.status === 'active' && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => pause.mutate(p.id)}
              disabled={pause.isPending}
            >
              <Pause className="h-3.5 w-3.5" />
              Pause
            </Button>
          )}
          {(p.status === 'draft' || p.status === 'paused') && (
            <Button
              size="sm"
              className="gap-1"
              onClick={() => activate.mutate(p.id)}
              disabled={activate.isPending}
            >
              <Play className="h-3.5 w-3.5" />
              {p.status === 'draft' ? 'Publish' : 'Resume'}
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link to={`/promotions/${p.id}/edit`}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Link>
                </DropdownMenuItem>
                {p.trigger === 'coupon_code' && (
                  <DropdownMenuItem disabled className="text-muted-foreground">
                    <Ticket className="mr-2 h-4 w-4" />
                    View coupons (soon)
                  </DropdownMenuItem>
                )}
                {p.status !== 'cancelled' && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => {
                      if (confirm(`Cancel "${p.name}"? This cannot be undone.`)) {
                        cancel.mutate(p.id);
                      }
                    }}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel promotion
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="text-sm font-medium text-on-surface truncate">{value}</p>
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
  tone: 'green' | 'blue' | 'violet';
}

function SummaryCard({ icon, label, value, tone }: SummaryCardProps) {
  const bg: Record<string, string> = {
    green: 'bg-green-50 border-green-200',
    blue: 'bg-blue-50 border-blue-200',
    violet: 'bg-violet-50 border-violet-200',
  };
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-3 ${bg[tone]}`}>
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-on-surface truncate">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
