import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OrderListItem, OrderStatus } from "../types";
import { KANBAN_GROUP, STATUS_LABEL } from "../types";
import type { VariantProps } from "class-variance-authority";
import { badgeVariants } from "@/components/ui/badge";

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

function shortId(id: string): string {
  return `#${id.slice(-6).toUpperCase()}`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

type OrderCardProps = {
  order: OrderListItem;
  onConfirm?:       (id: string) => void;
  onStartPreparing?:(id: string) => void;
  onMarkReady?:     (id: string) => void;
  isPending?:       boolean;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function OrderCard({
  order,
  onConfirm,
  onStartPreparing,
  onMarkReady,
  isPending,
}: OrderCardProps) {
  const navigate = useNavigate();
  const group = KANBAN_GROUP[order.status];
  const badge = STATUS_BADGE[order.status] ?? "order-neutral";

  const title =
    order.itemCount > 1
      ? `${order.firstItemName} +${order.itemCount - 1} more`
      : order.firstItemName;

  const borderAccent =
    group === "incoming"  ? "border-l-4 border-l-outline-variant" :
    group === "preparing" ? "border-l-4 border-l-blue-500"       :
    group === "ready"     ? "border-l-4 border-l-primary"        : "";

  // Quick action for this card's current status
  let action: React.ReactNode = null;
  if (group === "incoming" && onConfirm) {
    action = (
      <Button
        size="sm"
        onClick={(e) => { e.stopPropagation(); onConfirm(order.orderId); }}
        disabled={isPending}
        className="h-7 px-3 text-xs rounded-full bg-primary text-white font-bold"
      >
        Confirm
      </Button>
    );
  } else if (order.status === "confirmed" && onStartPreparing) {
    action = (
      <Button
        size="sm"
        onClick={(e) => { e.stopPropagation(); onStartPreparing(order.orderId); }}
        disabled={isPending}
        className="h-7 px-3 text-xs rounded-full bg-blue-500 text-white font-bold"
      >
        Start
      </Button>
    );
  } else if (order.status === "preparing" && onMarkReady) {
    action = (
      <Button
        size="sm"
        onClick={(e) => { e.stopPropagation(); onMarkReady(order.orderId); }}
        disabled={isPending}
        className="h-7 px-3 text-xs rounded-full bg-secondary-container text-on-secondary-container font-bold"
      >
        Ready
      </Button>
    );
  }

  return (
    <div
      onClick={() => navigate(`/orders/${order.orderId}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/orders/${order.orderId}`);
        }
      }}
      className={cn(
        "bg-surface-container-lowest p-4 rounded-lg",
        "shadow-[0_1px_4px_rgba(0,0,0,0.06)]",
        "hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]",
        "transition-all duration-200 cursor-pointer",
        borderAccent,
        group === "incoming" && "opacity-80",
      )}
    >
      {/* Title */}
      <h4 className="text-sm font-medium text-on-surface font-headline leading-snug mb-2 truncate">
        {title}
      </h4>

      {/* Status badge */}
      <div className="mb-4">
        <Badge variant={badge}>{STATUS_LABEL[order.status]}</Badge>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-outline uppercase font-body">
          {shortId(order.orderId)}
        </span>
        <div className="flex items-center gap-2">
          {action}
          {!action && (
            <span className="text-[10px] font-bold text-outline italic font-body">
              {timeAgo(order.createdAt)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
