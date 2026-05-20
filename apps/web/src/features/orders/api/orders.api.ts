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

  /** GET /orders/:id — order state + items (timeline excluded, fetch separately) */
  getOrderDetail: (id: string) =>
    apiClient
      .get<Omit<OrderDetail, 'timeline'>>(`/api/orders/${id}`)
      .then((r) => r.data),

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
  cancelOrder: (id: string, reason: string) =>
    apiClient.patch(`/api/orders/${id}/cancel`, { reason }),
};
