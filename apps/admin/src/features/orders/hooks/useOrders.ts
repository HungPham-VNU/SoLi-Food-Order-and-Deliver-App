import { useQuery } from '@tanstack/react-query';
import { ordersApi, type OrderListFilters } from '../api/orders.api';

const LIST_KEY = 'admin-orders';
const DETAIL_KEY = 'admin-order-detail';

export function useOrders(filters?: OrderListFilters) {
  return useQuery({
    queryKey: [LIST_KEY, filters],
    queryFn: () => ordersApi.list(filters),
    // Frequent polling so the platform view stays close to live without WebSockets.
    refetchInterval: 30_000,
  });
}

export function useOrderDetail(orderId: string | null) {
  return useQuery({
    queryKey: [DETAIL_KEY, orderId],
    queryFn: () => ordersApi.detail(orderId!),
    enabled: !!orderId,
  });
}
