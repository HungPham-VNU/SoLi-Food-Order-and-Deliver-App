import { apiClient } from '@/lib/api-client';
import type {
  DeliveryZone,
  CreateDeliveryZoneInput,
  UpdateDeliveryZoneInput,
  DeliveryEstimate,
  DeliveryEstimateQuery,
} from '../types';

const base = (restaurantId: string) =>
  `/api/restaurants/${restaurantId}/delivery-zones`;

export const deliveryZonesApi = {
  list: (restaurantId: string) =>
    apiClient.get<DeliveryZone[]>(base(restaurantId)).then((r) => r.data),

  getOne: (restaurantId: string, id: string) =>
    apiClient
      .get<DeliveryZone>(`${base(restaurantId)}/${id}`)
      .then((r) => r.data),

  create: (restaurantId: string, dto: CreateDeliveryZoneInput) =>
    apiClient
      .post<DeliveryZone>(base(restaurantId), dto)
      .then((r) => r.data),

  update: (restaurantId: string, id: string, dto: UpdateDeliveryZoneInput) =>
    apiClient
      .patch<DeliveryZone>(`${base(restaurantId)}/${id}`, dto)
      .then((r) => r.data),

  remove: (restaurantId: string, id: string) =>
    apiClient.delete(`${base(restaurantId)}/${id}`).then(() => undefined),

  estimate: (restaurantId: string, query: DeliveryEstimateQuery) =>
    apiClient
      .get<DeliveryEstimate>(`${base(restaurantId)}/delivery-estimate`, {
        params: { lat: query.lat, lon: query.lon },
      })
      .then((r) => r.data),
};
