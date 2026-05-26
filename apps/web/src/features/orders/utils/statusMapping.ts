import type { OrderStatus } from '@/features/orders/types';
import type { OrderStatus as FrontendOrderStatus } from '@/features/orders/types/order.types';

export type KitchenColumn = 'incoming' | 'preparing' | 'ready' | 'done';

export const KITCHEN_COLUMNS: KitchenColumn[] = [
  'incoming',
  'preparing',
  'ready',
  'done',
];

export const STATUS_TO_COLUMN: Record<OrderStatus, KitchenColumn> = {
  // Incoming column: orders waiting to be confirmed
  pending: 'incoming',
  paid: 'incoming',

  // Preparing column: orders confirmed and being prepared
  confirmed: 'preparing',
  preparing: 'preparing',

  // Ready column: food ready for pickup
  ready_for_pickup: 'ready',

  // Done column: terminal states
  picked_up: 'done',
  delivering: 'done',
  delivered: 'done',
  cancelled: 'done',
  refunded: 'done',
} as const;

// Frontend status → kitchen column mapping
export const FRONTEND_STATUS_TO_COLUMN: Record<FrontendOrderStatus, KitchenColumn> = {
  'requesting': 'incoming',
  'todo': 'preparing',
  'in_progress': 'preparing',
  'done': 'done',
} as const;

export function getColumnForStatus(status: OrderStatus | FrontendOrderStatus): KitchenColumn {
  if (status in STATUS_TO_COLUMN) {
    return STATUS_TO_COLUMN[status as OrderStatus];
  }
  return FRONTEND_STATUS_TO_COLUMN[status as FrontendOrderStatus];
}
