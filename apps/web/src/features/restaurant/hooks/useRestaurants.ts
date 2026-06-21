import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { restaurantApi } from '../api/restaurant.api';
import { useSession } from '@/lib/auth-client';
import type { UpdateRestaurantFormValues } from '../schemas/restaurant.schema';

export const restaurantKeys = {
  all: ['restaurants'] as const,
  mine: () => [...restaurantKeys.all, 'mine'] as const,
  mineForUser: (userId: string) =>
    [...restaurantKeys.mine(), userId] as const,
  detail: (id: string) => [...restaurantKeys.all, id] as const,
};

export function useMyRestaurant() {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: restaurantKeys.mineForUser(userId ?? ''),
    queryFn: async () => {
      // Uses GET /restaurants/my which returns the caller's restaurant of
      // ANY approval status — important so pending submissions surface here
      // (the public /restaurants endpoint filters by approvedOnly).
      const response = await restaurantApi.getMine();
      return response.data ?? null;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useRestaurant(id: string) {
  return useQuery({
    queryKey: restaurantKeys.detail(id),
    queryFn: () => restaurantApi.getOne(id).then((r) => r.data),
    enabled: !!id,
  });
}

export function useUpdateRestaurant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRestaurantFormValues }) =>
      restaurantApi.update(id, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: restaurantKeys.all });
    },
  });
}
