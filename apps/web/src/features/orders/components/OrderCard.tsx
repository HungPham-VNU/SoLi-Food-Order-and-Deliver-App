import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { Order } from '@/features/orders/types/order.types';
import { Draggable } from '@hello-pangea/dnd';
import { canDragFromColumn } from '@/features/orders/utils/dragTransitions';
import { getColumnForStatus } from '@/features/orders/utils/statusMapping';
import { useOrderCardDetail } from '@/features/orders/hooks/useOrderCardDetail';
import { OrderCardItems } from '@/features/orders/components/OrderCardItems';
import {
  formatElapsedTime,
  formatVND,
} from '@/features/orders/utils/timeFormat';

// ── Status icon mapping ───────────────────────────────────────────────────────
type StatusConfig = { icon: string; iconColor: string };

function getStatusConfig(order: Order): StatusConfig {
  if (order.status === 'requesting')
    return { icon: 'pending', iconColor: 'text-outline' };
  if (order.status === 'todo') {
    return order.tag.variant === 'high_priority'
      ? { icon: 'error', iconColor: 'text-primary' }
      : { icon: 'radio_button_unchecked', iconColor: 'text-outline' };
  }
  if (order.status === 'in_progress')
    return { icon: 'schedule', iconColor: 'text-blue-500' };
  return { icon: 'check_circle', iconColor: 'text-primary' };
}

// ── Left-border accent mapping ────────────────────────────────────────────────
function getBorderAccent(order: Order): string {
  if (order.status === 'requesting')
    return 'border-l-4 border-l-outline-variant';
  if (order.status === 'in_progress') return 'border-l-4 border-l-blue-500';
  if (order.status === 'done') return 'border-l-4 border-l-primary';
  return '';
}

// ── Component ────────────────────────────────────────────────────────────────
type OrderCardProps = {
  order: Order;
  index?: number;
  isOverlay?: boolean;
};

export function OrderCard({ order, index = 0, isOverlay }: OrderCardProps) {
  const navigate = useNavigate();
  const statusConfig = getStatusConfig(order);
  const borderAccent = getBorderAccent(order);
  const isOpaque = order.status === 'requesting';
  const column = getColumnForStatus(order.status);
  const isDragDisabled = !canDragFromColumn(column);

  const { data: detail, isLoading } = useOrderCardDetail(order.id);

  return (
    <Draggable
      draggableId={order.id}
      index={index}
      isDragDisabled={isDragDisabled}
    >
      {(provided, snapshot) => {
        const isDragging = snapshot.isDragging;
        return (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            onClick={() => !isOverlay && navigate(`/orders/${order.id}`)}
            role={!isOverlay ? 'button' : undefined}
            tabIndex={!isOverlay ? 0 : undefined}
            onKeyDown={(e) => {
              if (!isOverlay && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                navigate(`/orders/${order.id}`);
              }
            }}
            className={cn(
              'bg-surface-container-lowest p-4 rounded-lg',
              'shadow-[0_1px_4px_rgba(0,0,0,0.06)]',
              'transition-all duration-200',
              isOverlay || isDragging
                ? 'cursor-grabbing shadow-[0_8px_30px_rgba(0,0,0,0.12)] rotate-2 z-50 bg-white'
                : 'hover:-translate-y-0.5 cursor-pointer',
              !(isOverlay || isDragging) &&
                'hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]',
              borderAccent,
              isOpaque && 'opacity-80',
            )}
            style={{
              ...provided.draggableProps.style,
              ...(snapshot.isDropAnimating
                ? { transitionDuration: '0.1s' }
                : {}),
            }}
          >
            {/* ── Header: order number ─────────────────────────────────────── */}
            <div className="flex items-center mb-3 gap-2">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'material-symbols-outlined text-sm',
                    statusConfig.iconColor,
                  )}
                  aria-hidden="true"
                >
                  {statusConfig.icon}
                </span>
                <span className="text-xs font-bold text-on-surface uppercase font-body">
                  {order.orderNumber}
                </span>
              </div>
            </div>

            {/* ── Items list ─────────────────────────────────────────────────── */}
            <div className="mb-3 pb-3 border-b border-outline-variant/30">
              {isLoading ? (
                <div className="space-y-1.5 animate-pulse">
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-2 bg-muted rounded w-1/2 ml-2" />
                </div>
              ) : detail?.items && detail.items.length > 0 ? (
                <OrderCardItems items={detail.items} maxVisible={3} />
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  {order.title}
                </p>
              )}
            </div>

            {/* ── Customer note (if exists) ───────────────────────────────────── */}
            {detail?.note && (
              <div className="mb-3 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-900">
                <span className="font-bold">📝 Note:</span> {detail.note}
              </div>
            )}

            {/* ── Footer: total + elapsed time ─────────────────────────────── */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface">
                {detail ? formatVND(detail.totalAmount) : ''}
              </span>
              <span className="text-[10px] font-medium text-muted-foreground italic flex items-center gap-1">
                <span
                  className="material-symbols-outlined text-[10px]"
                  aria-hidden="true"
                >
                  schedule
                </span>
                {formatElapsedTime(detail?.createdAt || new Date())}
              </span>
            </div>
          </div>
        );
      }}
    </Draggable>
  );
}
