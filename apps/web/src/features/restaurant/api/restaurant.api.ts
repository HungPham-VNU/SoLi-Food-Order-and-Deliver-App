import { apiClient } from '@/lib/api-client';
import type { Restaurant, RestaurantListResponse } from './restaurant.types';
import type { CloudinaryImageMetadata } from '@/features/image/api/cloudinary-upload';
import type {
  RestaurantFormValues,
  UpdateRestaurantFormValues,
} from '../schemas/restaurant.schema';

export const restaurantApi = {
  getAll: () => apiClient.get<RestaurantListResponse>('/api/restaurants'),
  getOne: (id: string) => apiClient.get<Restaurant>(`/api/restaurants/${id}`),
  create: (data: RestaurantFormValues) =>
    apiClient.post<Restaurant>('/api/restaurants', data),
  update: (id: string, data: UpdateRestaurantFormValues) =>
    apiClient.patch<Restaurant>(`/api/restaurants/${id}`, data),
  attachLogoImage: (id: string, image: CloudinaryImageMetadata) =>
    apiClient.post<Restaurant>(`/api/restaurants/${id}/logo-image`, image),
  attachCoverImage: (id: string, image: CloudinaryImageMetadata) =>
    apiClient.post<Restaurant>(`/api/restaurants/${id}/cover-image`, image),
  remove: (id: string) => apiClient.delete(`/api/restaurants/${id}`),
};
