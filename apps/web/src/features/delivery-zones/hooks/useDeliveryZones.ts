import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deliveryZonesApi } from '../api/delivery-zones.api';
import type {
  CreateDeliveryZoneInput,
  DeliveryEstimateQuery,
  UpdateDeliveryZoneInput,
} from '../types';

export const zoneKeys = {
  all: (restaurantId: string) =>
    ['delivery-zones', restaurantId] as const,
  list: (restaurantId: string) =>
    [...zoneKeys.all(restaurantId), 'list'] as const,
  detail: (restaurantId: string, id: string) =>
    [...zoneKeys.all(restaurantId), 'detail', id] as const,
  estimate: (restaurantId: string, lat: number, lon: number) =>
    [...zoneKeys.all(restaurantId), 'estimate', lat, lon] as const,
};

export function useDeliveryZones(restaurantId: string | undefined) {
  return useQuery({
    queryKey: zoneKeys.list(restaurantId ?? ''),
    queryFn: () => deliveryZonesApi.list(restaurantId!),
    enabled: !!restaurantId,
  });
}

export function useCreateDeliveryZone(restaurantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateDeliveryZoneInput) =>
      deliveryZonesApi.create(restaurantId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: zoneKeys.list(restaurantId) });
    },
  });
}

export function useUpdateDeliveryZone(restaurantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDeliveryZoneInput }) =>
      deliveryZonesApi.update(restaurantId, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: zoneKeys.list(restaurantId) });
    },
  });
}

export function useDeleteDeliveryZone(restaurantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deliveryZonesApi.remove(restaurantId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: zoneKeys.list(restaurantId) });
    },
  });
}

export function useDeliveryEstimate(
  restaurantId: string | undefined,
  query: DeliveryEstimateQuery | null,
) {
  return useQuery({
    queryKey: zoneKeys.estimate(restaurantId ?? '', query?.lat ?? 0, query?.lon ?? 0),
    queryFn: () => deliveryZonesApi.estimate(restaurantId!, query!),
    enabled: !!restaurantId && !!query,
    retry: false,
  });
}
