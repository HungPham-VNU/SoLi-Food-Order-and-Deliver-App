import { useMemo } from 'react';
import { useActiveOrders } from '@/features/orders/hooks/useOrders';

const URGENT_THRESHOLD_MINUTES = 10;

interface OrderCounts {
  inProgress: number;
  readyForPickup: number;
  /** Ready orders older than URGENT_THRESHOLD_MINUTES — "out the door fast". */
  urgentReady: number;
  isLoading: boolean;
}

/**
 * Derived counts for the dashboard headline tiles.
 * Source: the existing kitchen `useActiveOrders` query (already polled every 30s).
 */
export function useOrderCounts(): OrderCounts {
  const { data: orders = [], isLoading, dataUpdatedAt } = useActiveOrders();

  return useMemo(() => {
    let inProgress = 0;
    let readyForPickup = 0;
    let urgentReady = 0;

    const urgentCutoff = dataUpdatedAt - URGENT_THRESHOLD_MINUTES * 60_000;

    for (const o of orders) {
      if (o.status === 'confirmed' || o.status === 'preparing') {
        inProgress++;
      } else if (o.status === 'ready_for_pickup') {
        readyForPickup++;
        if (new Date(o.createdAt).getTime() < urgentCutoff) {
          urgentReady++;
        }
      }
    }

    return { inProgress, readyForPickup, urgentReady, isLoading };
  }, [orders, isLoading, dataUpdatedAt]);
}
