import { apiFetch } from '@/src/lib/api-client';
import {
  OrderDetail,
  OrderHistoryFilters,
  OrderListResponse,
  ReorderItem,
} from '../types';

export const getMyOrders = async (
  filters: OrderHistoryFilters = {},
): Promise<OrderListResponse> => {
  const queryParams = new URLSearchParams();
  if (filters.status) queryParams.append('status', filters.status);
  if (filters.from) queryParams.append('from', filters.from);
  if (filters.to) queryParams.append('to', filters.to);
  if (filters.limit) queryParams.append('limit', filters.limit.toString());
  if (filters.offset) queryParams.append('offset', filters.offset.toString());

  const queryString = queryParams.toString();
  const endpoint = `/api/orders/my${queryString ? `?${queryString}` : ''}`;

  return apiFetch<OrderListResponse>(endpoint);
};

export const getMyOrderDetail = async (orderId: string): Promise<OrderDetail> => {
  return apiFetch<OrderDetail>(`/api/orders/my/${orderId}`);
};

export const getReorderItems = async (orderId: string): Promise<ReorderItem[]> => {
  return apiFetch<ReorderItem[]>(`/api/orders/my/${orderId}/reorder`);
};
