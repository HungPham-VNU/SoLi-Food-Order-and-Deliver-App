export const ORDER_STATUSES = [
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
] as const;

export const ORDER_TRIGGER_ROLES = [
  'customer',
  'restaurant',
  'shipper',
  'admin',
  'system',
] as const;

export const ORDER_CANCELLATION_REASONS = [
  'kitchen_cancel',
  'driver_no_show',
  'out_of_stock',
  'customer_request',
  'payment_failed',
  'timeout',
  'other',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type TriggeredByRole = (typeof ORDER_TRIGGER_ROLES)[number];
export type CancellationReason = (typeof ORDER_CANCELLATION_REASONS)[number];
