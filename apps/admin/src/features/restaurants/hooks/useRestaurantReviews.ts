import { useQuery } from '@tanstack/react-query';
import { restaurantsApi } from '../api/restaurants.api';

export function useRestaurantReviews(id: string, params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['restaurant-reviews', id, params],
    queryFn: () => restaurantsApi.getReviews(id, params),
    enabled: !!id,
  });
}
