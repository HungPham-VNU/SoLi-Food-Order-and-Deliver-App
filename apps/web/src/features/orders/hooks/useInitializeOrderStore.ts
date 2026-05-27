import { useEffect } from 'react';
import { useOrderStore } from '@/features/orders/stores/orderStore';
import { useActiveOrders } from './useOrders';

export function useInitializeOrderStore() {
  const setOrders = useOrderStore((s) => s.setOrders);
  const { data: activeOrders, isLoading } = useActiveOrders();

  useEffect(() => {
    if (activeOrders && activeOrders.length > 0) {
      setOrders(activeOrders);
    }
  }, [activeOrders, setOrders]);

  return { isLoading };
}
