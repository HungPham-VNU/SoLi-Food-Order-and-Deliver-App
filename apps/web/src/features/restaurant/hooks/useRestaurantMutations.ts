import { useMutation, useQueryClient } from '@tanstack/react-query';
import { restaurantApi } from '../api/restaurant.api';
import { restaurantKeys } from './useRestaurants';
import type { RestaurantFormValues, UpdateRestaurantFormValues } from '../schemas/restaurant.schema';

export function useCreateRestaurant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RestaurantFormValues) =>
      restaurantApi.create(data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: restaurantKeys.all });
    },
  });
}

export function useUpdateRestaurant(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateRestaurantFormValues) =>
      restaurantApi.update(id, data).then((r) => r.data),
    onSuccess: (updated) => {
      queryClient.setQueryData(restaurantKeys.detail(id), updated);
      queryClient.invalidateQueries({ queryKey: restaurantKeys.mine() });
    },
  });
}
