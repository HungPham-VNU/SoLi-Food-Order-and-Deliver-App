import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '../api/orders.api';
import { orderKeys } from './useOrders';
import { trackEvent } from '@/lib/analytics';

function useTransition() {
  const qc = useQueryClient();
  const invalidate = (id: string) => {
    qc.invalidateQueries({ queryKey: orderKeys.active() });
    qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
  };
  return invalidate;
}

/** T-01: pending/paid → confirmed */
export function useConfirmOrder() {
  const invalidate = useTransition();
  return useMutation({
    mutationFn: (id: string) => ordersApi.confirmOrder(id),
    onSuccess: (_, id) => {
      trackEvent('order_status_changed', {
        order_id: id,
        status: 'confirmed',
      });
      invalidate(id);
    },
  });
}

/** T-06: confirmed → preparing */
export function useStartPreparing() {
  const invalidate = useTransition();
  return useMutation({
    mutationFn: (id: string) => ordersApi.startPreparing(id),
    onSuccess: (_, id) => {
      trackEvent('order_status_changed', {
        order_id: id,
        status: 'preparing',
      });
      invalidate(id);
    },
  });
}

/** T-08: preparing → ready_for_pickup */
export function useMarkReady() {
  const invalidate = useTransition();
  return useMutation({
    mutationFn: (id: string) => ordersApi.markReady(id),
    onSuccess: (_, id) => {
      trackEvent('order_status_changed', {
        order_id: id,
        status: 'ready_for_pickup',
      });
      invalidate(id);
    },
  });
}

/** T-03/T-05/T-07: cancel from any cancellable state */
export function useCancelOrder() {
  const invalidate = useTransition();
  return useMutation({
    mutationFn: ({ id, reason, reasonCode }: { id: string; reason: string; reasonCode?: string }) =>
      ordersApi.cancelOrder(id, reason, reasonCode),
    onSuccess: (_, { id }) => {
      trackEvent('order_status_changed', {
        order_id: id,
        status: 'cancelled',
      });
      invalidate(id);
    },
  });
}
