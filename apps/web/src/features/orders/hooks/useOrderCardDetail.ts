import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '../api/orders.api';
import { orderKeys } from './useOrders';

/**
 * Kitchen card-optimized order detail fetch.
 *
 * Cache strategy:
 *  - 30s staleTime: matches list polling interval so detail stays fresh
 *  - Background refetch on window focus (kitchen displays are often left open)
 *  - No refetchInterval here (the list parent already polls and invalidates)
 */
export function useOrderCardDetail(orderId: string) {
  return useQuery({
    queryKey: orderKeys.detail(orderId),
    queryFn: () => ordersApi.getOrderDetail(orderId),
    enabled: !!orderId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
