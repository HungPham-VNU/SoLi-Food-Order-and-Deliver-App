import { apiClient } from '@/lib/api-client';

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'delivering'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type PaymentMethod = 'cod' | 'vnpay';

export interface OrderListItem {
  orderId: string;
  status: OrderStatus;
  restaurantId: string;
  restaurantName: string;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  shippingFee: number;
  itemCount: number;
  firstItemName: string;
  createdAt: string;
  updatedAt: string;
  estimatedDeliveryMinutes: number | null;
}

export interface OrderListResponse {
  data: OrderListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface OrderModifier {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  price: number;
}

export interface OrderItem {
  orderItemId: string;
  menuItemId: string;
  itemName: string;
  unitPrice: number;
  modifiersPrice: number;
  quantity: number;
  subtotal: number;
  modifiers: OrderModifier[];
}

export type TriggeredByRole =
  | 'customer'
  | 'restaurant'
  | 'shipper'
  | 'admin'
  | 'system';

export interface OrderTimelineEntry {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  triggeredBy: string | null;
  triggeredByRole: TriggeredByRole;
  note: string | null;
  createdAt: string;
}

export interface DeliveryAddress {
  street?: string;
  district?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

export interface OrderDetail {
  orderId: string;
  status: OrderStatus;
  restaurantId: string;
  restaurantName: string;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  shippingFee: number;
  estimatedDeliveryMinutes: number | null;
  note: string | null;
  paymentUrl: string | null;
  deliveryAddress: DeliveryAddress;
  shipperId: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  timeline: OrderTimelineEntry[];
}

export interface OrderListFilters {
  status?: OrderStatus;
  from?: string;
  to?: string;
  restaurantId?: string;
  customerId?: string;
  shipperId?: string;
  paymentMethod?: PaymentMethod;
  sortBy?: 'created_at' | 'updated_at' | 'total_amount';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export const ordersApi = {
  list: (filters?: OrderListFilters) =>
    apiClient
      .get<OrderListResponse>('/api/admin/orders', { params: filters })
      .then((r) => r.data),

  detail: (id: string) =>
    apiClient.get<OrderDetail>(`/api/admin/orders/${id}`).then((r) => r.data),
};
