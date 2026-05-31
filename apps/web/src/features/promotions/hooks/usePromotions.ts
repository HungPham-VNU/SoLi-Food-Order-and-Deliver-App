import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  promotionsApi,
  type CreatePromotionDto,
  type UpdatePromotionDto,
} from '../api/promotions.api';
import { useMyRestaurant } from '@/features/restaurant/hooks/useRestaurants';

const LIST_KEY = 'restaurant-promotions';

export function usePromotions(params?: { offset?: number; limit?: number }) {
  const { data: restaurant } = useMyRestaurant();
  const restaurantId = restaurant?.id;

  return useQuery({
    queryKey: [LIST_KEY, restaurantId, params],
    queryFn: () => promotionsApi.list(restaurantId!, params),
    enabled: !!restaurantId,
  });
}

export function usePromotion(id: string | null) {
  const { data: restaurant } = useMyRestaurant();
  const restaurantId = restaurant?.id;

  return useQuery({
    queryKey: [LIST_KEY, 'detail', restaurantId, id],
    queryFn: () => promotionsApi.get(restaurantId!, id!),
    enabled: !!restaurantId && !!id,
  });
}

export function useCreatePromotion() {
  const qc = useQueryClient();
  const { data: restaurant } = useMyRestaurant();
  const restaurantId = restaurant?.id;

  return useMutation({
    mutationFn: (dto: CreatePromotionDto) =>
      promotionsApi.create(restaurantId!, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: [LIST_KEY] }),
  });
}

export function useUpdatePromotion() {
  const qc = useQueryClient();
  const { data: restaurant } = useMyRestaurant();
  const restaurantId = restaurant?.id;

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdatePromotionDto }) =>
      promotionsApi.update(restaurantId!, id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: [LIST_KEY] }),
  });
}

export function useActivatePromotion() {
  const qc = useQueryClient();
  const { data: restaurant } = useMyRestaurant();
  const restaurantId = restaurant?.id;

  return useMutation({
    mutationFn: (id: string) => promotionsApi.activate(restaurantId!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [LIST_KEY] }),
  });
}

export function usePausePromotion() {
  const qc = useQueryClient();
  const { data: restaurant } = useMyRestaurant();
  const restaurantId = restaurant?.id;

  return useMutation({
    mutationFn: (id: string) => promotionsApi.pause(restaurantId!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [LIST_KEY] }),
  });
}

export function useCancelPromotion() {
  const qc = useQueryClient();
  const { data: restaurant } = useMyRestaurant();
  const restaurantId = restaurant?.id;

  return useMutation({
    mutationFn: (id: string) => promotionsApi.cancel(restaurantId!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [LIST_KEY] }),
  });
}
