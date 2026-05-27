import { useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Phone,
  MapPin,
  CreditCard,
  Truck,
  Receipt,
  Clock,
  User,
  Store,
} from 'lucide-react';
import { useOrderDetail } from '../hooks/useOrders';
import {
  STATUS_META,
  formatTime,
  formatVND,
  shortId,
} from '../utils/format';
import type { OrderTimelineEntry } from '../api/orders.api';

interface Props {
  orderId: string | null;
  onClose: () => void;
}

type Tab = 'items' | 'timeline' | 'customer' | 'payment';

export function OrderDetailSheet({ orderId, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('items');
  const { data: order, isLoading } = useOrderDetail(orderId);

  return (
    <Sheet open={!!orderId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className="overflow-y-auto p-0 flex flex-col"
        style={{ width: '520px', maxWidth: '520px' }}
      >
        {isLoading || !order ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="material-symbols-outlined animate-spin text-primary text-3xl">
              progress_activity
            </span>
          </div>
        ) : (
          <>
            {/* Header — leave room on the right for the built-in close button */}
            <div className="border-b px-6 py-4 pr-14">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-on-surface">
                  Order {shortId(order.orderId)}
                </h2>
                <Badge className={`${STATUS_META[order.status].badge} hover:${STATUS_META[order.status].badge}`}>
                  {STATUS_META[order.status].label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Created {formatTime(order.createdAt)}
              </p>
            </div>

            {/* Tabs */}
            <div className="border-b px-6 flex gap-1 -mb-px">
              {(
                [
                  { id: 'items', label: 'Items', icon: Receipt },
                  { id: 'timeline', label: 'Timeline', icon: Clock },
                  { id: 'customer', label: 'Customer', icon: User },
                  { id: 'payment', label: 'Payment', icon: CreditCard },
                ] as const
              ).map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors ${
                      active
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-on-surface'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {tab === 'items' && <ItemsTab order={order} />}
              {tab === 'timeline' && <TimelineTab timeline={order.timeline} />}
              {tab === 'customer' && <CustomerTab order={order} />}
              {tab === 'payment' && <PaymentTab order={order} />}
            </div>

            {/* Footer */}
            <div className="border-t bg-background px-6 py-4 flex items-center justify-between gap-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Order total</p>
                <p className="text-lg font-bold text-on-surface">
                  {formatVND(order.totalAmount)}
                </p>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function ItemsTab({ order }: { order: NonNullable<ReturnType<typeof useOrderDetail>['data']> }) {
  const subtotal = order.items.reduce((acc, item) => acc + item.subtotal, 0);

  return (
    <div className="space-y-5">
      {/* Restaurant */}
      <div className="flex items-center gap-3 rounded-lg border bg-surface-container/40 px-3 py-2.5">
        <Store className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Restaurant</p>
          <p className="text-sm font-medium text-on-surface truncate">
            {order.restaurantName}
          </p>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-3">
        {order.items.map((item) => (
          <div key={item.orderItemId} className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-on-surface">
                  {item.itemName}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Qty {item.quantity} · {formatVND(item.unitPrice)}
                </p>
                {item.modifiers.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {item.modifiers.map((m) => (
                      <li
                        key={m.optionId}
                        className="text-xs text-on-surface-variant flex items-center gap-1.5"
                      >
                        <span className="text-muted-foreground">•</span>
                        <span>{m.optionName}</span>
                        {m.price > 0 && (
                          <span className="text-muted-foreground">
                            (+{formatVND(m.price)})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="text-sm font-semibold text-on-surface whitespace-nowrap">
                {formatVND(item.subtotal)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {order.note && (
        <div className="rounded-lg border-l-4 border-amber-400 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 mb-1">
            Customer note
          </p>
          {order.note}
        </div>
      )}

      {/* Summary */}
      <div className="rounded-lg border bg-surface-container/40 px-3 py-3 space-y-1.5 text-sm">
        <Row label="Subtotal" value={formatVND(subtotal)} />
        <Row label="Shipping fee" value={formatVND(order.shippingFee)} />
        <div className="h-px bg-border my-2" />
        <Row
          label="Total"
          value={formatVND(order.totalAmount)}
          emphasize
        />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={
          emphasize ? 'font-bold text-on-surface' : 'text-muted-foreground'
        }
      >
        {label}
      </span>
      <span
        className={
          emphasize ? 'font-bold text-on-surface' : 'text-on-surface'
        }
      >
        {value}
      </span>
    </div>
  );
}

function TimelineTab({ timeline }: { timeline: OrderTimelineEntry[] }) {
  if (timeline.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No status changes recorded yet.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {timeline.map((entry, idx) => {
        const meta = STATUS_META[entry.toStatus];
        const isLast = idx === timeline.length - 1;
        return (
          <li key={`${entry.createdAt}-${idx}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`h-3 w-3 rounded-full ${meta.dot}`} />
              {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
            </div>
            <div className="flex-1 pb-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-on-surface">
                  {meta.label}
                </p>
                <span className="text-xs text-muted-foreground">
                  {formatTime(entry.createdAt)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                by {entry.triggeredByRole}
                {entry.fromStatus && ` · from ${STATUS_META[entry.fromStatus].label}`}
              </p>
              {entry.note && (
                <p className="text-xs italic text-on-surface-variant mt-1">
                  "{entry.note}"
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function CustomerTab({ order }: { order: NonNullable<ReturnType<typeof useOrderDetail>['data']> }) {
  const addr = order.deliveryAddress;
  const addressLine = [addr.street, addr.district, addr.city]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Delivery address
        </h3>
        <div className="flex items-start gap-3 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <span className="text-on-surface">
            {addressLine || 'No address provided'}
          </span>
        </div>
        {(addr.latitude != null || addr.longitude != null) && (
          <p className="text-xs text-muted-foreground font-mono pl-7">
            {addr.latitude?.toFixed(5)}, {addr.longitude?.toFixed(5)}
          </p>
        )}
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Delivery
        </h3>
        <div className="flex items-center gap-3 text-sm">
          <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-on-surface">
            {order.shipperId
              ? `Shipper: ${order.shipperId.slice(0, 8)}…`
              : 'No shipper assigned'}
          </span>
        </div>
        {order.estimatedDeliveryMinutes != null && (
          <div className="flex items-center gap-3 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-on-surface">
              ETA ~ {Math.round(order.estimatedDeliveryMinutes)} min
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function PaymentTab({ order }: { order: NonNullable<ReturnType<typeof useOrderDetail>['data']> }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Method
        </h3>
        <div className="flex items-center gap-3 text-sm">
          {order.paymentMethod === 'vnpay' ? (
            <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <span className="text-on-surface font-medium">
            {order.paymentMethod === 'vnpay' ? 'VNPay' : 'Cash on Delivery'}
          </span>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-2 text-sm">
        <Row label="Subtotal" value={formatVND(order.totalAmount - order.shippingFee)} />
        <Row label="Shipping" value={formatVND(order.shippingFee)} />
        <div className="h-px bg-border my-1" />
        <Row label="Total paid" value={formatVND(order.totalAmount)} emphasize />
      </div>

      {order.paymentUrl && (
        <a
          href={order.paymentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-sm text-primary underline-offset-4 hover:underline"
        >
          Open VNPay redirect URL ↗
        </a>
      )}
    </div>
  );
}
