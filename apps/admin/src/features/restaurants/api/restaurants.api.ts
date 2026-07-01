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

export type RestaurantAnalyticsRange = 'today' | 'yesterday' | '7d' | '30d';

export interface RestaurantAnalytics {
  range: RestaurantAnalyticsRange;
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  totalRevenue: number;
  orderCount: number;
  deliveredCount: number;
  cancelledCount: number;
  avgOrderValue: number;
  successRate: number | null;
  cancelRate: number;
  avgPrepMinutes: number | null;
  revenueByDay: { date: string; revenue: number }[];
  ordersByDay: { date: string; count: number }[];
  topItems: {
    menuItemId: string;
    name: string;
    quantity: number;
    revenue: number;
  }[];
}

export interface AdminReview {
  id: string;
  orderId: string;
  customerId: string;
  restaurantId: string;
  stars: number;
  comment: string | null;
  tags: string[] | null;
  moderationStatus: 'visible' | 'flagged' | 'hidden';
  moderationReason: string | null;
  createdAt: string;
}

export interface RestaurantReviewsResponse {
  data: AdminReview[];
  total: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
}

export const restaurantsApi = {
  list: (params?: { offset?: number; limit?: number }) =>
    apiClient
      .get<RestaurantListResponse>('/api/restaurants/admin/all', { params })
      .then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<Restaurant>(`/api/restaurants/${id}`).then((r) => r.data),

  getAnalytics: (id: string, range?: RestaurantAnalyticsRange) =>
    apiClient
      .get<RestaurantAnalytics>(`/api/admin/analytics/restaurant/${id}`, {
        params: { range },
      })
      .then((r) => r.data),

  getReviews: (id: string, params?: { page?: number; limit?: number }) =>
    apiClient
      .get<RestaurantReviewsResponse>(`/api/admin/restaurants/${id}/reviews`, {
        params,
      })
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
