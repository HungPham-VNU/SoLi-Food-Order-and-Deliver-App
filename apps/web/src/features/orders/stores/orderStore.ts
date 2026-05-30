import { create } from "zustand";
import type { Order, OrderStatus } from "@/features/orders/types/order.types";
import type { OrderListItem } from "@/features/orders/types";

function mapOrderListItemToOrder(item: OrderListItem): Order {
  const statusMap: Record<string, OrderStatus> = {
    'pending': 'requesting',
    'paid': 'requesting',
    'confirmed': 'todo',
    'preparing': 'in_progress',
    'ready_for_pickup': 'done',
    'picked_up': 'done',
    'delivering': 'done',
    'delivered': 'done',
    'cancelled': 'done',
    'refunded': 'done',
  };

  const tagVariantMap: Record<string, string> = {
    'pending': 'unaccepted',
    'paid': 'unaccepted',
    'confirmed': 'high_priority',
    'preparing': 'preparing',
    'ready_for_pickup': 'ready',
  };

  const mappedStatus = (statusMap[item.status] || 'requesting') as OrderStatus;

  return {
    id: item.orderId,
    orderNumber: `#${item.orderId.slice(0, 6).toUpperCase()}`,
    title: item.firstItemName || 'Order',
    status: mappedStatus,
    tag: {
      label: item.status.charAt(0).toUpperCase() + item.status.slice(1).replace(/_/g, ' '),
      variant: (tagVariantMap[item.status] || 'order-neutral') as any,
    },
    timestamp: new Date(item.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  };
}


type OrderStore = {
  orders: Order[];
  searchQuery: string;
  newOrderToast: Order | null;
  /** True while the store is fetching orders from the API. */
  isLoading: boolean;
  setSearchQuery: (q: string) => void;
  setOrders: (items: OrderListItem[]) => void;
  reorderOrder: (
    orderId: string,
    sourceStatus: OrderStatus,
    destinationStatus: OrderStatus,
    sourceIndex: number,
    destinationIndex: number
  ) => void;
  acceptOrder: (orderId: string) => void;
  dismissToast: () => void;
  getOrdersByStatus: (status: OrderStatus) => Order[];
};

export const useOrderStore = create<OrderStore>((set, get) => ({
  orders: [],
  searchQuery: "",
  isLoading: false,
  newOrderToast: null,

  setSearchQuery: (q) => set({ searchQuery: q }),

  setOrders: (items) =>
    set({
      orders: items
        .filter((item) => item.status !== 'cancelled' && item.status !== 'refunded')
        .map(mapOrderListItemToOrder),
    }),

  reorderOrder: (orderId, sourceStatus, destinationStatus, sourceIndex, destinationIndex) =>
    set((state) => {
      const grouped: Record<OrderStatus, Order[]> = {
        requesting: [],
        todo: [],
        in_progress: [],
        done: [],
      };

      state.orders.forEach((o) => {
        if (grouped[o.status]) grouped[o.status].push(o);
      });

      const sourceList = grouped[sourceStatus];
      const destList = grouped[destinationStatus];

      if (!sourceList || !destList) return state;

      // Prefer the caller-supplied sourceIndex; fall back to a find for safety.
      const resolvedSourceIndex =
        sourceIndex >= 0 && sourceIndex < sourceList.length && sourceList[sourceIndex]?.id === orderId
          ? sourceIndex
          : sourceList.findIndex((o) => o.id === orderId);

      if (resolvedSourceIndex === -1) return state;

      // Remove without mutating the original order object.
      const [originalOrder] = sourceList.splice(resolvedSourceIndex, 1);
      const movedOrder: Order = { ...originalOrder, status: destinationStatus };

      destList.splice(destinationIndex, 0, movedOrder);

      return {
        orders: [
          ...grouped.requesting,
          ...grouped.todo,
          ...grouped.in_progress,
          ...grouped.done,
        ],
      };
    }),

  acceptOrder: (orderId) =>
    set((state) => ({
      orders: state.orders.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: "todo",
              tag: { label: "High Priority", variant: "high_priority" },
            }
          : o,
      ),
      newOrderToast: null,
    })),

  dismissToast: () => set({ newOrderToast: null }),

  getOrdersByStatus: (status) => {
    const { orders, searchQuery } = get();
    return orders
      .filter((o) => o.status === status)
      .filter(
        (o) =>
          !searchQuery ||
          o.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()),
      );
  },
}));
