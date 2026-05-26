import { apiClient } from '@/lib/api-client';
import type { CloudinaryImageMetadata } from '@/lib/cloudinary-upload';
import type { Restaurant, RestaurantListResponse } from './restaurant.types';
import type {
  RestaurantFormValues,
  UpdateRestaurantFormValues,
} from '../schemas/restaurant.schema';

export const restaurantApi = {
  getAll: (params?: { page?: number; limit?: number }) =>
    apiClient.get<RestaurantListResponse>('/api/restaurants', { params }),

  getOne: (id: string) =>
    apiClient.get<Restaurant>(`/api/restaurants/${id}`),

  // Returns the caller's restaurant regardless of approval status, or null
  // when they haven't submitted one yet.
  getMine: () =>
    apiClient.get<Restaurant | null>('/api/restaurants/my'),

  create: (data: RestaurantFormValues) =>
    apiClient.post<Restaurant>('/api/restaurants', data),

  update: (id: string, data: UpdateRestaurantFormValues) =>
    apiClient.patch<Restaurant>(`/api/restaurants/${id}`, data),

  attachLogoImage: (id: string, image: CloudinaryImageMetadata) =>
    apiClient.post<Restaurant>(`/api/restaurants/${id}/logo-image`, image),

  attachCoverImage: (id: string, image: CloudinaryImageMetadata) =>
    apiClient.post<Restaurant>(`/api/restaurants/${id}/cover-image`, image),

  remove: (id: string) =>
    apiClient.delete(`/api/restaurants/${id}`),
};
