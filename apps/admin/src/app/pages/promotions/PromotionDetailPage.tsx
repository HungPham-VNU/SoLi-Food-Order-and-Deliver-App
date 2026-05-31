import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Pencil,
  Play,
  Pause,
  X,
  Ticket,
  Plus,
  Loader2,
} from 'lucide-react';
import {
  usePromotion,
  usePromotionCoupons,
  useGenerateCoupons,
  useRevokeCoupon,
  useActivatePromotion,
  usePausePromotion,
  useCancelPromotion,
} from '@/features/promotions/hooks/usePromotions';
import type {
  Promotion,
  CouponStatus,
} from '@/features/promotions/api/promotions.api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  STATUS_META,
  PROMOTION_TYPE_LABELS,
  formatDateRange,
  formatDiscount,
  formatVND,
} from '@/features/promotions/utils/format';

export function PromotionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<'details' | 'coupons'>('details');

  const { data: promotion, isLoading, isError } = usePromotion(id ?? null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (isError || !promotion) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center text-destructive">
        Failed to load promotion.
      </div>
    );
  }

  const meta = STATUS_META[promotion.status];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            to="/promotions"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-on-surface transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Promotions
          </Link>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-on-surface">
              {promotion.name}
            </h1>
            <Badge className={`${meta.badge} hover:${meta.badge} gap-1.5`}>
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {promotion.description || PROMOTION_TYPE_LABELS[promotion.type]}
          </p>
        </div>

        <PromotionActions promotion={promotion} />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-border">
        <TabButton
          active={activeTab === 'details'}
          onClick={() => setActiveTab('details')}
        >
          Details
        </TabButton>
        {promotion.trigger === 'coupon_code' && (
          <TabButton
            active={activeTab === 'coupons'}
            onClick={() => setActiveTab('coupons')}
          >
            Coupon Codes
          </TabButton>
        )}
      </div>

      {activeTab === 'details' && <PromotionDetails promotion={promotion} />}
      {activeTab === 'coupons' && promotion.trigger === 'coupon_code' && (
        <PromotionCoupons promotionId={promotion.id} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header actions
// ---------------------------------------------------------------------------

function PromotionActions({ promotion: p }: { promotion: Promotion }) {
  const activate = useActivatePromotion();
  const pause = usePausePromotion();
  const cancel = useCancelPromotion();

  return (
    <div className="flex items-center gap-2 shrink-0">
      <Button asChild variant="outline" size="sm" className="gap-1.5">
        <Link to={`/promotions/${p.id}/edit`}>
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Link>
      </Button>

      {p.status === 'active' && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
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
          className="gap-1.5"
          onClick={() => activate.mutate(p.id)}
          disabled={activate.isPending}
        >
          <Play className="h-3.5 w-3.5" />
          {p.status === 'draft' ? 'Publish' : 'Resume'}
        </Button>
      )}
      {p.status !== 'cancelled' && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-destructive hover:text-destructive"
          onClick={() => {
            if (window.confirm(`Cancel "${p.name}"? This cannot be undone.`)) {
              cancel.mutate(p.id);
            }
          }}
          disabled={cancel.isPending}
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </Button>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-1 pb-2.5 text-sm font-medium transition-colors ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:border-border hover:text-on-surface'
      }`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Details tab
// ---------------------------------------------------------------------------

function PromotionDetails({ promotion: p }: { promotion: Promotion }) {
  const usagePct = p.maxTotalUses
    ? Math.min(100, Math.round((p.currentTotalUses / p.maxTotalUses) * 100))
    : null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Section title="Configuration">
        <Field label="Type" value={PROMOTION_TYPE_LABELS[p.type]} />
        <Field label="Discount" value={formatDiscount(p)} />
        <Field label="Scope" value={p.scope === 'platform' ? 'Platform' : 'Restaurant'} />
        <Field
          label="Trigger"
          value={p.trigger === 'coupon_code' ? 'Coupon code' : 'Auto-apply'}
        />
        <Field
          label="Stacking"
          value={p.stackingMode.replace(/_/g, ' ')}
          className="capitalize"
        />
        {p.maxDiscountAmount != null && (
          <Field label="Max discount" value={formatVND(p.maxDiscountAmount)} />
        )}
      </Section>

      <Section title="Rules & Usage">
        <Field
          label="Min order"
          value={p.minOrderAmount ? formatVND(p.minOrderAmount) : 'None'}
        />
        <Field
          label="Per-user limit"
          value={p.maxUsesPerUser ? String(p.maxUsesPerUser) : 'Unlimited'}
        />
        <Field
          label="Total uses"
          value={
            p.maxTotalUses
              ? `${p.currentTotalUses.toLocaleString()} / ${p.maxTotalUses.toLocaleString()}`
              : `${p.currentTotalUses.toLocaleString()} / ∞`
          }
        />
        <Field label="Active window" value={formatDateRange(p.startsAt, p.endsAt)} />

        {usagePct != null && (
          <div className="col-span-2 mt-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-container">
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
            <p className="mt-1 text-xs text-muted-foreground">
              {usagePct}% of total quota used
            </p>
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="text-sm font-semibold text-on-surface">{title}</h2>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`text-sm text-on-surface mt-0.5 ${className ?? ''}`}>
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coupon Codes tab
// ---------------------------------------------------------------------------

const COUPON_STATUS_META: Record<CouponStatus, string> = {
  active: 'bg-green-100 text-green-700 border-green-200',
  exhausted: 'bg-gray-100 text-gray-600 border-gray-200',
  expired: 'bg-amber-100 text-amber-700 border-amber-200',
  revoked: 'bg-red-100 text-red-700 border-red-200',
};

/** Generates `count` random 8-char uppercase alphanumeric codes. */
function generateRandomCodes(count: number): string[] {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: count }, () => {
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return code;
  });
}

function PromotionCoupons({ promotionId }: { promotionId: string }) {
  const { data: response, isLoading } = usePromotionCoupons(promotionId);
  const generateMut = useGenerateCoupons();
  const revokeMut = useRevokeCoupon();

  const [manualCodes, setManualCodes] = useState('');
  const [quantity, setQuantity] = useState(10);
  const [maxUsesPerCode, setMaxUsesPerCode] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = () => {
    setError(null);

    // Manual codes (one per line) take precedence; otherwise generate random.
    const typed = manualCodes
      .split('\n')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    const codes = typed.length > 0 ? typed : generateRandomCodes(quantity);

    if (codes.length === 0) {
      setError('Enter at least one code or a quantity to generate.');
      return;
    }
    if (codes.length > 200) {
      setError('A maximum of 200 codes can be created at once.');
      return;
    }

    generateMut.mutate(
      {
        promotionId,
        dto: {
          codes,
          ...(maxUsesPerCode ? { maxUsesPerCode: Number(maxUsesPerCode) } : {}),
          ...(expiresAt
            ? { expiresAt: new Date(expiresAt).toISOString() }
            : {}),
        },
      },
      {
        onSuccess: () => {
          setManualCodes('');
          setExpiresAt('');
          setMaxUsesPerCode('');
        },
        onError: (err) => {
          const message =
            err instanceof Error ? err.message : 'Failed to generate codes';
          setError(message);
        },
      },
    );
  };

  const handleRevoke = (couponId: string) => {
    if (window.confirm('Revoke this coupon code? It can no longer be used.')) {
      revokeMut.mutate({ promotionId, couponId });
    }
  };

  const coupons = response?.items ?? [];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Generate form */}
      <div className="rounded-xl border bg-card p-5 lg:col-span-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-on-surface">
          <Plus className="h-4 w-4" />
          Generate codes
        </h2>

        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="quantity">Quantity (random)</Label>
            <Input
              id="quantity"
              type="number"
              min={1}
              max={200}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              disabled={manualCodes.trim().length > 0}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Number of random 8-char codes. Ignored if you paste codes below.
            </p>
          </div>

          <div>
            <Label htmlFor="manualCodes">Custom codes (one per line)</Label>
            <textarea
              id="manualCodes"
              rows={4}
              value={manualCodes}
              onChange={(e) => setManualCodes(e.target.value)}
              placeholder="SUMMER15&#10;VIP-2025"
              className="mt-1 flex w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div>
            <Label htmlFor="maxUsesPerCode">Max uses per code</Label>
            <Input
              id="maxUsesPerCode"
              type="number"
              min={1}
              value={maxUsesPerCode}
              onChange={(e) => setMaxUsesPerCode(e.target.value)}
              placeholder="Unlimited"
            />
          </div>

          <div>
            <Label htmlFor="expiresAt">Expires at</Label>
            <Input
              id="expiresAt"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button
            className="w-full gap-1.5"
            onClick={handleGenerate}
            disabled={generateMut.isPending}
          >
            {generateMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Generate
          </Button>
        </div>
      </div>

      {/* Codes table */}
      <div className="rounded-xl border bg-card lg:col-span-2">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-on-surface">
            Coupon codes
          </h2>
          {response && (
            <span className="text-xs text-muted-foreground">
              {response.total} total
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : coupons.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto mb-3 inline-flex rounded-full bg-surface-container p-3">
              <Ticket className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No coupon codes yet. Generate a batch to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-5 py-3 font-medium">Code</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Uses</th>
                  <th className="px-5 py-3 font-medium">Expires</th>
                  <th className="px-5 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="px-5 py-3 font-mono font-medium text-on-surface">
                      {c.code}
                    </td>
                    <td className="px-5 py-3">
                      <Badge
                        className={`${COUPON_STATUS_META[c.status]} hover:${COUPON_STATUS_META[c.status]}`}
                      >
                        {c.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-on-surface">
                      {c.currentUses} / {c.maxUses ?? '∞'}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {c.expiresAt
                        ? new Date(c.expiresAt).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {c.status === 'active' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRevoke(c.id)}
                          disabled={revokeMut.isPending}
                        >
                          Revoke
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
