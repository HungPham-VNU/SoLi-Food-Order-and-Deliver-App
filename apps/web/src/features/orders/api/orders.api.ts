import { apiClient } from '@/lib/api-client';
import type {
  OrderDetail,
  OrderHistoryFilters,
  OrderListItem,
  OrderListResponse,
  OrderStatusLogEntry,
} from '../types';

export const ordersApi = {
  // -------------------------------------------------------------------------
  // Restaurant queries
  // -------------------------------------------------------------------------

  /** GET /restaurant/orders — paginated order list for the caller's restaurant */
  getRestaurantOrders: (params?: OrderHistoryFilters) =>
    apiClient
      .get<OrderListResponse>('/api/restaurant/orders', { params })
      .then((r) => r.data),

  /** GET /restaurant/orders/active — kitchen view: confirmed/preparing/ready, oldest-first, no pagination */
  getRestaurantActiveOrders: () =>
    apiClient
      .get<OrderListItem[]>('/api/restaurant/orders/active')
      .then((r) => r.data),

  // -------------------------------------------------------------------------
  // Order detail (lifecycle controller — any authenticated user)
  // -------------------------------------------------------------------------

  /**
   * GET /orders/:id — order state + items (timeline excluded, fetch separately)
   *
   * Backend returns nested `{ order, items }` — we flatten to OrderDetail shape
   * so consumers can access fields uniformly (matches /orders/my/:id contract).
   */
  getOrderDetail: (id: string) =>
    apiClient
      .get<{ order: any; items: any[] }>(`/api/orders/${id}`)
      .then((r): Omit<OrderDetail, 'timeline'> => {
        const { order, items } = r.data;
        return {
          orderId: order.id,
          status: order.status,
          restaurantId: order.restaurantId,
          restaurantName: order.restaurantName,
          paymentMethod: order.paymentMethod,
          totalAmount: Number(order.totalAmount),
          shippingFee: Number(order.shippingFee),
          estimatedDeliveryMinutes: order.estimatedDeliveryMinutes ?? null,
          note: order.note ?? null,
          paymentUrl: order.paymentUrl ?? null,
          deliveryAddress: order.deliveryAddress,
          shipperId: order.shipperId ?? null,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          items: items.map((item) => ({
            orderItemId: item.id,
            menuItemId: item.menuItemId,
            itemName: item.itemName,
            unitPrice: Number(item.unitPrice),
            modifiersPrice: Number(item.modifiersPrice),
            quantity: item.quantity,
            subtotal: Number(item.subtotal),
            modifiers: item.modifiers || [],
          })),
        };
      }),

  /** GET /orders/:id/timeline — full audit trail of status transitions */
  getOrderTimeline: (id: string) =>
    apiClient
      .get<OrderStatusLogEntry[]>(`/api/orders/${id}/timeline`)
      .then((r) => r.data),

  // -------------------------------------------------------------------------
  // Order lifecycle mutations (restaurant role)
  // -------------------------------------------------------------------------

  /** PATCH /orders/:id/confirm — T-01: pending/paid → confirmed */
  confirmOrder: (id: string) =>
    apiClient.patch(`/api/orders/${id}/confirm`),

  /** PATCH /orders/:id/start-preparing — T-06: confirmed → preparing */
  startPreparing: (id: string) =>
    apiClient.patch(`/api/orders/${id}/start-preparing`),

  /** PATCH /orders/:id/ready — T-08: preparing → ready_for_pickup */
  markReady: (id: string) =>
    apiClient.patch(`/api/orders/${id}/ready`),

  /** PATCH /orders/:id/cancel — T-03/T-05/T-07: cancel from any cancellable state */
  cancelOrder: (id: string, reason: string, reasonCode?: string) =>
    apiClient.patch(`/api/orders/${id}/cancel`, { reason, reasonCode }),
};
