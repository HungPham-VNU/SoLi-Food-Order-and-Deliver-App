import { OrderBoardHeader } from "@/features/orders/components/OrderBoardHeader";
import { OrderKanbanColumn } from "@/features/orders/components/OrderKanbanColumn";
import { NewOrderToast } from "@/features/orders/components/NewOrderToast";
import { Separator } from "@/components/ui/separator";
import type { OrderStatus } from "@/features/orders/types/order.types";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { useOrderStore } from "@/features/orders/stores/orderStore";
import { useInitializeOrderStore } from "@/features/orders/hooks/useInitializeOrderStore";
import { useConfirmOrder, useStartPreparing, useMarkReady } from "@/features/orders/hooks/useOrderMutations";
import { getTransition } from "@/features/orders/utils/dragTransitions";
import { getColumnForStatus } from "@/features/orders/utils/statusMapping";
import type { KitchenColumn } from "@/features/orders/utils/statusMapping";

const COLUMN_ORDER: OrderStatus[] = [
  "requesting",
  "todo",
  "in_progress",
  "done",
];

export function OrdersPage() {
  useInitializeOrderStore();

  const orders = useOrderStore((s) => s.orders);
  const reorderOrder = useOrderStore((s) => s.reorderOrder);

  const confirmOrderMutation = useConfirmOrder();
  const startPreparingMutation = useStartPreparing();
  const markReadyMutation = useMarkReady();

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    // Find the order being dragged
    const order = orders.find((o) => o.id === draggableId);
    if (!order) return;

    // Map frontend status to backend status for transition validation
    const fromColumn = source.droppableId as KitchenColumn;
    const toColumn = destination.droppableId as KitchenColumn;

    // Check if this transition is valid
    const transition = getTransition(fromColumn, toColumn, order.status);
    if (!transition) {
      return; // Invalid transition, revert
    }

    // Optimistically update the local store
    reorderOrder(
      draggableId,
      source.droppableId as OrderStatus,
      destination.droppableId as OrderStatus,
      source.index,
      destination.index
    );

    // Call the appropriate API mutation
    switch (transition.apiCall) {
      case 'confirmOrder':
        confirmOrderMutation.mutate(draggableId);
        break;
      case 'startPreparing':
        startPreparingMutation.mutate(draggableId);
        break;
      case 'markReady':
        markReadyMutation.mutate(draggableId);
        break;
    }
  };

  return (
    // Negate MainLayout's padding so the grey Kanban background bleeds full-width
    <div
      className="-m-4 lg:-m-6 flex flex-col bg-[#F4F5F7] overflow-hidden"
      style={{ height: "calc(100vh - 4rem)" }}
    >
      {/* Board header */}
      <div className="p-6 pb-0 flex-shrink-0">
        <OrderBoardHeader />
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        {/* Kanban columns */}
        <div className="flex-1 flex gap-4 overflow-x-auto overflow-y-hidden px-6 pb-6 min-h-0">
          {COLUMN_ORDER.map((columnId, index) => (
            <div key={columnId} className="flex gap-4 h-full flex-shrink-0">
              <OrderKanbanColumn columnId={columnId} />
              {/* shadcn Separator between columns */}
              {index < COLUMN_ORDER.length - 1 && (
                <Separator
                  orientation="vertical"
                  className="self-stretch my-4 h-auto opacity-40"
                />
              )}
            </div>
          ))}
        </div>
      </DragDropContext>

      <NewOrderToast />
    </div>
  );
}
