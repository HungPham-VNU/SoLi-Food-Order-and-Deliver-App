import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { restaurantsApi } from '../api/restaurants.api';

const QUERY_KEY = 'admin-restaurants';

export function useRestaurants(params?: { offset?: number; limit?: number }) {
  return useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => restaurantsApi.list(params),
  });
}

export function useApproveRestaurant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: restaurantsApi.approve,
    onSuccess: (_restaurant, id) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
        qc.invalidateQueries({ queryKey: ['restaurant', id] }),
      ]),
  });
}

export function useUnapproveRestaurant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: restaurantsApi.unapprove,
    onSuccess: (_restaurant, id) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
        qc.invalidateQueries({ queryKey: ['restaurant', id] }),
      ]),
  });
}

export function useDeleteRestaurant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: restaurantsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}
