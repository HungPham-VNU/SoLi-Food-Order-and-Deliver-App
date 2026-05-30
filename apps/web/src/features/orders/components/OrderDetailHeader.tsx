import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";
import { badgeVariants } from "@/components/ui/badge-variants";
import type { OrderDetail, OrderStatus } from "@/features/orders/types";
import { STATUS_LABEL, KANBAN_GROUP } from "@/features/orders/types";

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

const STATUS_BADGE: Partial<Record<OrderStatus, BadgeVariant>> = {
  pending:          "order-neutral",
  paid:             "order-delivery",
  confirmed:        "order-preparing",
  preparing:        "order-preparing",
  ready_for_pickup: "order-ready",
  picked_up:        "order-ready",
  delivering:       "order-delivery",
  delivered:        "order-ready",
  cancelled:        "order-neutral",
  refunded:         "order-neutral",
};

type OrderDetailHeaderProps = {
  order: Omit<OrderDetail, "timeline">;
  onConfirm?:        () => void;
  onStartPreparing?: () => void;
  onMarkReady?:      () => void;
  onCancel?:         () => void;
  isPending?:        boolean;
};

export function OrderDetailHeader({
  order,
  onConfirm,
  onStartPreparing,
  onMarkReady,
  onCancel,
  isPending,
}: OrderDetailHeaderProps) {
  const badge   = STATUS_BADGE[order.status] ?? "order-neutral";
  const group   = KANBAN_GROUP[order.status];
  const shortId = `#${order.orderId.slice(-6).toUpperCase()}`;

  const placedAt = new Date(order.createdAt).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const cancellable = order.status === "pending" || order.status === "paid" || order.status === "confirmed";

  return (
    <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
      <div className="space-y-1">
        <Link
          to="/orders"
          className="inline-flex items-center gap-2 text-primary font-headline font-bold text-sm mb-4 hover:opacity-80 transition-opacity w-fit"
        >
          <span className="material-symbols-outlined text-lg" aria-hidden="true">
            arrow_back
          </span>
          Back to Board
        </Link>

        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-extrabold text-on-surface tracking-tight font-headline">
            Order {shortId}
          </h1>
          <Badge
            variant={badge}
            className="px-3 py-1 h-auto rounded-full text-xs font-bold uppercase tracking-wider"
          >
            {STATUS_LABEL[order.status]}
          </Badge>
        </div>

        <p className="text-stone-500 font-medium font-body">
          Placed on {placedAt}
        </p>
      </div>

      {/* Action buttons — shown based on current group/status */}
      <div className="flex items-center gap-3">
        {cancellable && onCancel && (
          <Button
            variant="outline"
            className="rounded-full border-destructive/40 text-destructive font-bold hover:bg-destructive/10 px-6 py-2.5 h-auto"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel Order
          </Button>
        )}

        {group === "incoming" && onConfirm && (
          <Button
            className="rounded-full bg-primary text-white font-bold px-6 py-2.5 h-auto"
            onClick={onConfirm}
            disabled={isPending}
          >
            Confirm Order
          </Button>
        )}

        {order.status === "confirmed" && onStartPreparing && (
          <Button
            className="rounded-full bg-blue-500 text-white font-bold px-6 py-2.5 h-auto"
            onClick={onStartPreparing}
            disabled={isPending}
          >
            Start Preparing
          </Button>
        )}

        {order.status === "preparing" && onMarkReady && (
          <Button
            className="rounded-full bg-secondary-container text-on-secondary-container font-bold shadow-sm px-6 py-2.5 h-auto"
            onClick={onMarkReady}
            disabled={isPending}
          >
            Mark as Ready
          </Button>
        )}
      </div>
    </header>
  );
}
