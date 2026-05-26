import type { OrderStatus } from '@/features/orders/types';
import type { OrderStatus as FrontendOrderStatus } from '@/features/orders/types/order.types';
import type { KitchenColumn } from './statusMapping';

type AnyColumn = KitchenColumn | FrontendOrderStatus;
type TransitionKey = `${AnyColumn}->${AnyColumn}`;
type AnyOrderStatus = OrderStatus | FrontendOrderStatus;

export interface Transition {
  statuses: AnyOrderStatus[];
  apiCall: 'confirmOrder' | 'startPreparing' | 'markReady';
}

// Transitions mapped by source column → destination column
// Supports both new kitchen column names (incoming, preparing, ready, done)
// and old frontend status names (requesting, todo, in_progress, done) used in current UI
export const DRAG_TRANSITIONS: Partial<Record<TransitionKey, Transition>> = {
  // New kitchen column names
  'incoming->preparing': {
    statuses: ['pending', 'paid', 'requesting'],
    apiCall: 'confirmOrder',
  },
  'preparing->ready': {
    statuses: ['preparing', 'in_progress'],
    apiCall: 'markReady',
  },

  // Old frontend column names (currently used in OrdersPage)
  // requesting → todo: pending/paid → confirmed (T-01)
  'requesting->todo': {
    statuses: ['pending', 'paid', 'requesting'],
    apiCall: 'confirmOrder',
  },
  // todo → in_progress: confirmed → preparing (T-06)
  'todo->in_progress': {
    statuses: ['confirmed', 'todo'],
    apiCall: 'startPreparing',
  },
  // in_progress → done: preparing → ready_for_pickup (T-08)
  'in_progress->done': {
    statuses: ['preparing', 'in_progress'],
    apiCall: 'markReady',
  },
} as const;

// Columns from which orders cannot be dragged
export const DISABLED_COLUMNS: Record<string, boolean> = {
  // New kitchen column names
  incoming: false,
  preparing: false,
  ready: true,
  done: true,
  // Old frontend column names
  requesting: false,
  todo: false,
  in_progress: false,
} as const;

export function canDragFromColumn(column: AnyColumn): boolean {
  return !DISABLED_COLUMNS[column];
}

export function getTransitionKey(
  fromColumn: AnyColumn,
  toColumn: AnyColumn
): TransitionKey | null {
  const key = `${fromColumn}->${toColumn}` as TransitionKey;
  if (key in DRAG_TRANSITIONS) {
    return key;
  }
  return null;
}

export function getTransition(
  fromColumn: AnyColumn,
  toColumn: AnyColumn,
  orderStatus: AnyOrderStatus
): Transition | null {
  const key = getTransitionKey(fromColumn, toColumn);
  if (!key) return null;

  const transition = DRAG_TRANSITIONS[key];
  if (!transition || !transition.statuses.includes(orderStatus)) {
    return null;
  }

  return transition;
}
