import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { getMyOrderDetail, getMyOrders, getReorderItems } from '../api/order-history';
import { OrderDetail, OrderHistoryFilters } from '../types';

export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (filters: OrderHistoryFilters) => [...orderKeys.lists(), filters] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
  reorder: (id: string) => [...orderKeys.all, 'reorder', id] as const,
};

export const useMyOrders = (filters: OrderHistoryFilters = {}) => {
  return useQuery({
    queryKey: orderKeys.list(filters),
    queryFn: () => getMyOrders(filters),
  });
};

type OrderDetailQueryKey = ReturnType<typeof orderKeys.detail>;
type OrderDetailQueryOptions = Pick<
  UseQueryOptions<OrderDetail, Error, OrderDetail, OrderDetailQueryKey>,
  'enabled' | 'refetchInterval' | 'refetchIntervalInBackground'
>;

export const useMyOrderDetail = (
  orderId: string,
  options: OrderDetailQueryOptions = {},
) => {
  return useQuery({
    queryKey: orderKeys.detail(orderId),
    queryFn: () => getMyOrderDetail(orderId),
    enabled: !!orderId && (options.enabled ?? true),
    refetchInterval: options.refetchInterval,
    refetchIntervalInBackground: options.refetchIntervalInBackground,
  });
};

export const useReorderItems = (orderId: string) => {
  return useQuery({
    queryKey: orderKeys.reorder(orderId),
    queryFn: () => getReorderItems(orderId),
    enabled: !!orderId,
  });
};
