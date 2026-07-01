import { useQuery } from '@tanstack/react-query';
import {
  restaurantsApi,
  type RestaurantAnalyticsRange,
} from '../api/restaurants.api';

export function useRestaurantAnalytics(
  id: string,
  range: RestaurantAnalyticsRange = 'today',
) {
  return useQuery({
    queryKey: ['restaurant-analytics', id, range],
    queryFn: () => restaurantsApi.getAnalytics(id, range),
    enabled: !!id,
  });
}
