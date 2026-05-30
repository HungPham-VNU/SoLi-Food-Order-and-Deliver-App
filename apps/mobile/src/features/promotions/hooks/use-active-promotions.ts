import { useQuery } from '@tanstack/react-query';
import { getActivePromotions } from '../api/promotion-api';

export function useActivePromotions(restaurantId?: string | null) {
  return useQuery({
    queryKey: ['promotions', 'active', restaurantId ?? null],
    queryFn: () => getActivePromotions(restaurantId ?? undefined),
    enabled: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
