// ---------------------------------------------------------------------------
// Enums — mirror the backend pg enums exactly
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Kanban grouping — restaurant dashboard view only
// ---------------------------------------------------------------------------

export type KanbanGroup = 'incoming' | 'preparing' | 'ready' | 'done';

export const KANBAN_GROUP: Record<OrderStatus, KanbanGroup> = {
  pending:          'incoming',
  paid:             'incoming',
  confirmed:        'preparing',
  preparing:        'preparing',
  ready_for_pickup: 'ready',
  picked_up:        'done',
  delivering:       'done',
  delivered:        'done',
  cancelled:        'done',
  refunded:         'done',
};

export const KANBAN_COLUMNS: { id: KanbanGroup; label: string; icon: string }[] = [
  { id: 'incoming',  label: 'Incoming',  icon: 'inbox'            },
  { id: 'preparing', label: 'Preparing', icon: 'skillet'          },
  { id: 'ready',     label: 'Ready',     icon: 'check_circle'     },
  { id: 'done',      label: 'Done',      icon: 'done_all'         },
];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending:          'Awaiting confirmation',
  paid:             'Paid — awaiting confirmation',
  confirmed:        'Confirmed',
  preparing:        'Preparing',
  ready_for_pickup: 'Ready for pickup',
  picked_up:        'Picked up',
  delivering:       'Out for delivery',
  delivered:        'Delivered',
  cancelled:        'Cancelled',
  refunded:         'Refunded',
};

// ---------------------------------------------------------------------------
// Nested types
// ---------------------------------------------------------------------------

export interface DeliveryAddress {
  street: string;
  district: string;
  city: string;
  latitude?: number;
  longitude?: number;
}

export interface OrderModifier {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  price: number;
}

export interface OrderCustomer {
  customerId: string;
  name: string;
  phone: string | null;
}

// Mirrors OrderItemResponseDto
export interface OrderItem {
  orderItemId: string;
  menuItemId: string;
  itemName: string;
  imageUrl?: string | null;
  unitPrice: number;
  modifiersPrice: number;
  quantity: number;
  subtotal: number;
  modifiers: OrderModifier[];
}

// Mirrors OrderStatusLogEntryDto
export interface OrderStatusLogEntry {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  triggeredBy: string | null;
  triggeredByRole: TriggeredByRole;
  note: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// List item — mirrors OrderListItemDto
// Returned by GET /restaurant/orders and GET /restaurant/orders/active
// ---------------------------------------------------------------------------

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
  estimatedDeliveryMinutes: number | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Paginated list response — mirrors OrderListResponseDto
// Returned by GET /restaurant/orders (paginated)
// ---------------------------------------------------------------------------

export interface OrderListResponse {
  data: OrderListItem[];
  total: number;
  limit: number;
  offset: number;
}

// ---------------------------------------------------------------------------
// Full detail — mirrors OrderDetailDto
// Returned by GET /orders/:id (lifecycle) and GET /orders/my/:id (customer)
// ---------------------------------------------------------------------------

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
  customer: OrderCustomer | null;
  shipperId: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  timeline: OrderStatusLogEntry[];
}

// ---------------------------------------------------------------------------
// Query params — mirrors OrderHistoryFiltersDto
// ---------------------------------------------------------------------------

export interface OrderHistoryFilters {
  status?: OrderStatus;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}
