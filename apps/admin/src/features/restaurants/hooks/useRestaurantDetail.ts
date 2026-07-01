import { useQuery } from '@tanstack/react-query';
import { restaurantsApi } from '../api/restaurants.api';

export function useRestaurantDetail(id: string) {
  return useQuery({
    queryKey: ['restaurant', id],
    queryFn: () => restaurantsApi.getById(id),
    enabled: !!id,
  });
}
