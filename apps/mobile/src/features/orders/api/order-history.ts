import { apiFetch } from '@/src/lib/api-client';
import {
  OrderDetail,
  OrderHistoryFilters,
  OrderListResponse,
  OrderModifierResponse,
  OrderItemResponse,
  OrderStatus,
  OrderStatusLogEntry,
  PaymentMethod,
  ReorderItem,
  ReorderModifier,
  TriggeredByRole,
} from '../types';

const ORDER_STATUSES = [
  'pending',
  'paid',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'picked_up',
  'delivering',
  'delivered',
  'cancelled',
  'refunded',
] as const satisfies readonly OrderStatus[];

const PAYMENT_METHODS = ['cod', 'vnpay'] as const satisfies readonly PaymentMethod[];

const TRIGGERED_BY_ROLES = [
  'customer',
  'restaurant',
  'shipper',
  'admin',
  'system',
] as const satisfies readonly TriggeredByRole[];

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = asNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asOrderStatus(value: unknown): OrderStatus {
  return ORDER_STATUSES.includes(value as OrderStatus)
    ? (value as OrderStatus)
    : 'pending';
}

function asPaymentMethod(value: unknown): PaymentMethod {
  return PAYMENT_METHODS.includes(value as PaymentMethod)
    ? (value as PaymentMethod)
    : 'cod';
}

function asTriggeredByRole(value: unknown): TriggeredByRole {
  return TRIGGERED_BY_ROLES.includes(value as TriggeredByRole)
    ? (value as TriggeredByRole)
    : 'system';
}

function asDateString(value: unknown): string {
  if (typeof value === 'string' && value.length > 0) return value;
  return new Date(0).toISOString();
}

function normalizeModifier(value: unknown): OrderModifierResponse {
  const record = asRecord(value);

  return {
    groupId: asString(record.groupId),
    groupName: asString(record.groupName),
    optionId: asString(record.optionId),
    optionName: asString(record.optionName),
    price: asNumber(record.price),
  };
}

function normalizeOrderItem(value: unknown, index: number): OrderItemResponse {
  const record = asRecord(value);

  return {
    orderItemId: asString(record.orderItemId, `order-item-${index}`),
    menuItemId: asString(record.menuItemId),
    itemName: asString(record.itemName, 'Item'),
    imageUrl: asNullableString(record.imageUrl),
    unitPrice: asNumber(record.unitPrice),
    modifiersPrice: asNumber(record.modifiersPrice),
    quantity: asNumber(record.quantity, 1),
    subtotal: asNumber(record.subtotal),
    modifiers: asArray(record.modifiers).map(normalizeModifier),
  };
}

function normalizeTimelineEntry(value: unknown): OrderStatusLogEntry {
  const record = asRecord(value);

  return {
    fromStatus:
      record.fromStatus == null ? null : asOrderStatus(record.fromStatus),
    toStatus: asOrderStatus(record.toStatus),
    triggeredBy: asNullableString(record.triggeredBy),
    triggeredByRole: asTriggeredByRole(record.triggeredByRole),
    note: asNullableString(record.note),
    createdAt: asDateString(record.createdAt),
  };
}

function normalizeOrderListItem(value: unknown, index: number) {
  const record = asRecord(value);

  return {
    orderId: asString(record.orderId, `order-${index}`),
    status: asOrderStatus(record.status),
    restaurantId: asString(record.restaurantId),
    restaurantName: asString(record.restaurantName, 'Restaurant'),
    paymentMethod: asPaymentMethod(record.paymentMethod),
    totalAmount: asNumber(record.totalAmount),
    shippingFee: asNumber(record.shippingFee),
    itemCount: asNumber(record.itemCount),
    firstItemName: asString(record.firstItemName),
    createdAt: asDateString(record.createdAt),
    updatedAt: asDateString(record.updatedAt),
    estimatedDeliveryMinutes: asNullableNumber(record.estimatedDeliveryMinutes),
  };
}

function normalizeOrderListResponse(value: unknown): OrderListResponse {
  const record = asRecord(value);
  const data = asArray(record.data).map(normalizeOrderListItem);

  return {
    data,
    total: asNumber(record.total, data.length),
    limit: asNumber(record.limit, data.length || 20),
    offset: asNumber(record.offset),
  };
}

function normalizeOrderDetail(value: unknown): OrderDetail {
  const record = asRecord(value);
  const items = asArray(record.items).map(normalizeOrderItem);
  const fallbackSubtotal = items.reduce((sum, item) => sum + item.subtotal, 0);

  return {
    orderId: asString(record.orderId),
    status: asOrderStatus(record.status),
    restaurantId: asString(record.restaurantId),
    restaurantName: asString(record.restaurantName, 'Restaurant'),
    paymentMethod: asPaymentMethod(record.paymentMethod),
    totalAmount: asNumber(record.totalAmount),
    shippingFee: asNumber(record.shippingFee),
    estimatedDeliveryMinutes: asNullableNumber(record.estimatedDeliveryMinutes),
    note: asNullableString(record.note),
    paymentUrl: asNullableString(record.paymentUrl),
    subtotal: asNumber(record.subtotal, fallbackSubtotal),
    deliveryAddress: asRecord(record.deliveryAddress),
    shipperId: asNullableString(record.shipperId),
    createdAt: asDateString(record.createdAt),
    updatedAt: asDateString(record.updatedAt),
    items,
    timeline: asArray(record.timeline).map(normalizeTimelineEntry),
    hasReview: asBoolean(record.hasReview),
  };
}

function normalizeReorderModifier(value: unknown): ReorderModifier {
  const record = asRecord(value);

  return {
    groupId: asString(record.groupId),
    optionId: asString(record.optionId),
  };
}

function normalizeReorderItem(value: unknown): ReorderItem {
  const record = asRecord(value);

  return {
    menuItemId: asString(record.menuItemId),
    itemName: asString(record.itemName, 'Item'),
    quantity: asNumber(record.quantity, 1),
    selectedModifiers: asArray(record.selectedModifiers).map(
      normalizeReorderModifier,
    ),
  };
}

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

  const response = await apiFetch<unknown>(endpoint);
  return normalizeOrderListResponse(response);
};

export const getMyOrderDetail = async (
  orderId: string,
): Promise<OrderDetail> => {
  const response = await apiFetch<unknown>(`/api/orders/my/${orderId}`);
  return normalizeOrderDetail(response);
};

export const getReorderItems = async (
  orderId: string,
): Promise<ReorderItem[]> => {
  const response = await apiFetch<unknown>(`/api/orders/my/${orderId}/reorder`);
  return asArray(response).map(normalizeReorderItem);
};
