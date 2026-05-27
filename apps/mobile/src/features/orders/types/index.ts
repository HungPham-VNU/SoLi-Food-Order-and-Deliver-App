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
export type TriggeredByRole =
  | 'customer'
  | 'restaurant'
  | 'shipper'
  | 'admin'
  | 'system';

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

export interface OrderHistoryFilters {
  status?: OrderStatus;
  from?: string; // ISO8601
  to?: string; // ISO8601
  limit?: number;
  offset?: number;
}

export interface OrderModifierResponse {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  price: number;
}

export interface OrderItemResponse {
  orderItemId: string;
  menuItemId: string;
  itemName: string;
  unitPrice: number;
  modifiersPrice: number;
  quantity: number;
  subtotal: number;
  modifiers: OrderModifierResponse[];
}

export interface OrderStatusLogEntry {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  triggeredBy: string | null;
  triggeredByRole: TriggeredByRole;
  note: string | null;
  createdAt: string;
}

export interface DeliveryAddressResponse {
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
  subtotal?: number;
  deliveryAddress: DeliveryAddressResponse;
  shipperId: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItemResponse[];
  timeline: OrderStatusLogEntry[];
}

export interface ReorderModifier {
  groupId: string;
  optionId: string;
}

export interface ReorderItem {
  menuItemId: string;
  itemName: string;
  quantity: number;
  selectedModifiers: ReorderModifier[];
}
