import { apiClient } from '@/lib/api-client';

export interface Restaurant {
  id: string;
  ownerId: string;
  name: string;
  description?: string | null;
  address: string;
  phone: string;
  isOpen: boolean;
  isApproved: boolean;
  cuisineType?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantListResponse {
  data: Restaurant[];
  total: number;
}

export const restaurantsApi = {
  list: (params?: { offset?: number; limit?: number }) =>
    apiClient
      .get<RestaurantListResponse>('/api/restaurants/admin/all', { params })
      .then((r) => r.data),

  approve: (id: string) =>
    apiClient
      .patch<Restaurant>(`/api/restaurants/${id}/approve`)
      .then((r) => r.data),

  unapprove: (id: string) =>
    apiClient
      .patch<Restaurant>(`/api/restaurants/${id}/unapprove`)
      .then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/api/restaurants/${id}`).then((r) => r.data),
};
