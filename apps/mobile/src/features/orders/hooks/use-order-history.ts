import { useQuery } from '@tanstack/react-query';
import { getMyOrderDetail, getMyOrders, getReorderItems } from '../api/order-history';
import { OrderHistoryFilters } from '../types';

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

export const useMyOrderDetail = (orderId: string) => {
  return useQuery({
    queryKey: orderKeys.detail(orderId),
    queryFn: () => getMyOrderDetail(orderId),
    enabled: !!orderId,
  });
};

export const useReorderItems = (orderId: string) => {
  return useQuery({
    queryKey: orderKeys.reorder(orderId),
    queryFn: () => getReorderItems(orderId),
    enabled: !!orderId,
  });
};
