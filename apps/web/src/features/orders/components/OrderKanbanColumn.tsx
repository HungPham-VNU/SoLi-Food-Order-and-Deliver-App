import { cn } from '@/lib/utils';
import type { KanbanGroup, OrderListItem } from '@/features/orders/types';
import { KANBAN_COLUMNS } from '@/features/orders/types';
import { OrderCard } from '@/features/orders/components/OrderCard';

type OrderKanbanColumnProps = {
  group: KanbanGroup;
  orders: OrderListItem[];
  onConfirm?: (id: string) => void;
  onStartPreparing?: (id: string) => void;
  onMarkReady?: (id: string) => void;
  isPending?: boolean;
};

const CONTAINER_CLASS: Record<KanbanGroup, string> = {
  incoming:
    'bg-surface-container-high/60 border-2 border-dashed border-outline-variant/60',
  preparing: 'bg-surface-container',
  ready: 'bg-surface-container',
  done: 'bg-surface-container',
};

export function OrderKanbanColumn({
  group,
  orders,
  onConfirm,
  onStartPreparing,
  onMarkReady,
  isPending,
}: OrderKanbanColumnProps) {
  const config = KANBAN_COLUMNS.find((column) => column.id === group);

  if (!config) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg h-full w-[300px] xl:w-[340px] flex-shrink-0 transition-all duration-200',
        CONTAINER_CLASS[group],
      )}
    >
      <div className="px-4 pt-4 pb-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant font-headline">
            {config.label}
          </h3>
          <span className="text-xs font-bold text-muted-foreground">
            {orders.length}
          </span>
        </div>
        <span
          className="material-symbols-outlined text-muted-foreground text-sm"
          aria-hidden="true"
        >
          {config.icon}
        </span>
      </div>

      <div className="flex-1 px-2 pb-2 space-y-2.5 overflow-y-auto min-h-0">
        {orders.map((order) => (
          <OrderCard
            key={order.orderId}
            order={order}
            onConfirm={onConfirm}
            onStartPreparing={onStartPreparing}
            onMarkReady={onMarkReady}
            isPending={isPending}
          />
        ))}
        {orders.length === 0 && (
          <p className="text-center py-8 text-muted-foreground text-xs font-medium opacity-60">
            No orders
          </p>
        )}
      </div>
    </div>
  );
}
