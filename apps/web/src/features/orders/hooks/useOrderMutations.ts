import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '../api/orders.api';
import { orderKeys } from './useOrders';

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
    onSuccess:  (_, id) => invalidate(id),
  });
}

/** T-06: confirmed → preparing */
export function useStartPreparing() {
  const invalidate = useTransition();
  return useMutation({
    mutationFn: (id: string) => ordersApi.startPreparing(id),
    onSuccess:  (_, id) => invalidate(id),
  });
}

/** T-08: preparing → ready_for_pickup */
export function useMarkReady() {
  const invalidate = useTransition();
  return useMutation({
    mutationFn: (id: string) => ordersApi.markReady(id),
    onSuccess:  (_, id) => invalidate(id),
  });
}

/** T-03/T-05/T-07: cancel from any cancellable state */
export function useCancelOrder() {
  const invalidate = useTransition();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      ordersApi.cancelOrder(id, reason),
    onSuccess: (_, { id }) => invalidate(id),
  });
}
