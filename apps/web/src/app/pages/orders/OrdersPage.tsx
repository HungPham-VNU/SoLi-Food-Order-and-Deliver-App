import { useMemo } from "react";
import { Separator } from "@/components/ui/separator";
import { OrderKanbanColumn } from "@/features/orders/components/OrderKanbanColumn";
import { useActiveOrders } from "@/features/orders/hooks/useOrders";
import { useConfirmOrder, useStartPreparing, useMarkReady } from "@/features/orders/hooks/useOrderMutations";
import { KANBAN_COLUMNS, KANBAN_GROUP } from "@/features/orders/types";
import type { KanbanGroup, OrderListItem } from "@/features/orders/types";

export function OrdersPage() {
  const { data: orders = [], isLoading } = useActiveOrders();

  const confirm      = useConfirmOrder();
  const startPrepare = useStartPreparing();
  const markReady    = useMarkReady();

  const isPending = confirm.isPending || startPrepare.isPending || markReady.isPending;

  const grouped = useMemo(() => {
    const map: Record<KanbanGroup, OrderListItem[]> = {
      incoming: [], preparing: [], ready: [], done: [],
    };
    for (const order of orders) {
      map[KANBAN_GROUP[order.status]].push(order);
    }
    return map;
  }, [orders]);

  return (
    <div
      className="-m-4 lg:-m-6 flex flex-col bg-[#F4F5F7] overflow-hidden"
      style={{ height: "calc(100vh - 4rem)" }}
    >
      {/* Board header */}
      <div className="p-6 pb-0 flex-shrink-0">
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-2xl font-extrabold text-on-surface tracking-tight font-headline">
            Kitchen Board
          </h2>
          {isLoading && (
            <span className="text-xs text-muted-foreground animate-pulse font-body">
              Updating…
            </span>
          )}
        </div>
      </div>

      {/* Kanban columns */}
      <div className="flex-1 flex gap-4 overflow-x-auto overflow-y-hidden px-6 pb-6 min-h-0">
        {KANBAN_COLUMNS.map((col, index) => (
          <div key={col.id} className="flex gap-4 h-full flex-shrink-0">
            <OrderKanbanColumn
              group={col.id}
              orders={grouped[col.id]}
              onConfirm={(id) => confirm.mutate(id)}
              onStartPreparing={(id) => startPrepare.mutate(id)}
              onMarkReady={(id) => markReady.mutate(id)}
              isPending={isPending}
            />
            {index < KANBAN_COLUMNS.length - 1 && (
              <Separator
                orientation="vertical"
                className="self-stretch my-4 h-auto opacity-40"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
