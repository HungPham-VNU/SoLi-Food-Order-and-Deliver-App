import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '../api/orders.api';
import type { OrderHistoryFilters } from '../types';

export const orderKeys = {
  all:      ()         => ['orders']                              as const,
  active:   ()         => ['orders', 'restaurant', 'active']     as const,
  list:     (f?: OrderHistoryFilters) => ['orders', 'restaurant', 'list', f] as const,
  detail:   (id: string) => ['orders', id]                       as const,
  timeline: (id: string) => ['orders', id, 'timeline']           as const,
};

/** Kitchen Kanban data source — active orders for the caller's restaurant */
export function useActiveOrders() {
  return useQuery({
    queryKey: orderKeys.active(),
    queryFn:  () => ordersApi.getRestaurantActiveOrders(),
    refetchInterval: 30_000, // fallback polling until WebSocket is wired
  });
}

/** Paginated order list — for history / filter views */
export function useRestaurantOrders(filters?: OrderHistoryFilters) {
  return useQuery({
    queryKey: orderKeys.list(filters),
    queryFn:  () => ordersApi.getRestaurantOrders(filters),
  });
}

/** Single order: state + items (no timeline) */
export function useOrderDetail(id: string | undefined) {
  return useQuery({
    queryKey: orderKeys.detail(id ?? ''),
    queryFn:  () => ordersApi.getOrderDetail(id!),
    enabled:  !!id,
  });
}

/** Status transition audit trail */
export function useOrderTimeline(id: string | undefined) {
  return useQuery({
    queryKey: orderKeys.timeline(id ?? ''),
    queryFn:  () => ordersApi.getOrderTimeline(id!),
    enabled:  !!id,
  });
}
