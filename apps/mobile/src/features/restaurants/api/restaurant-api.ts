import { useQueries, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/src/lib/api-client';
import {
  Restaurant,
  MenuItem,
  RestaurantListResponse,
  MenuItemListResponse,
  ModifierGroup,
  UnifiedSearchResponse,
  DeliveryEstimateResponse,
} from '../types';

export const restaurantKeys = {
  all: ['restaurants'] as const,
  lists: () => [...restaurantKeys.all, 'list'] as const,
  list: (filters: string) => [...restaurantKeys.lists(), { filters }] as const,
  search: (filters: string) =>
    [...restaurantKeys.all, 'search', { filters }] as const,
  details: () => [...restaurantKeys.all, 'detail'] as const,
  detail: (id: string) => [...restaurantKeys.details(), id] as const,
  estimates: (id: string) => [...restaurantKeys.detail(id), 'estimates'] as const,
  estimate: (id: string, lat: number, lon: number) =>
    [...restaurantKeys.estimates(id), { lat, lon }] as const,
};

const buildSearchQuery = (
  params: Record<string, string | number | undefined>,
) =>
  Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join('&');

const buildDeliveryEstimateEndpoint = (
  restaurantId: string,
  lat: number,
  lon: number,
) => {
  const queryString = buildSearchQuery({ lat, lon });
  return `/api/restaurants/${restaurantId}/delivery-zones/delivery-estimate?${queryString}`;
};

export function fetchDeliveryEstimate(
  restaurantId: string,
  lat: number,
  lon: number,
) {
  return apiFetch<DeliveryEstimateResponse>(
    buildDeliveryEstimateEndpoint(restaurantId, lat, lon),
  );
}

export const menuKeys = {
  all: ['menu-items'] as const,
  lists: () => [...menuKeys.all, 'list'] as const,
  list: (restaurantId: string) =>
    [...menuKeys.lists(), { restaurantId }] as const,
  details: () => [...menuKeys.all, 'detail'] as const,
  detail: (id: string) => [...menuKeys.details(), id] as const,
};

export function useRestaurants(offset = 0, limit = 20) {
  return useQuery({
    queryKey: restaurantKeys.list(`offset=${offset}&limit=${limit}`),
    queryFn: () =>
      apiFetch<RestaurantListResponse>(
        `/api/restaurants?offset=${offset}&limit=${limit}`,
      ),
  });
}

interface NearbyRestaurantsParams {
  latitude?: number | null;
  longitude?: number | null;
  radiusKm?: number;
  offset?: number;
  limit?: number;
}

export function useNearbyRestaurants(params: NearbyRestaurantsParams = {}) {
  const { latitude, longitude, radiusKm = 5, offset = 0, limit = 20 } = params;
  const hasCoords = latitude != null && longitude != null;
  const queryString = buildSearchQuery({
    lat: hasCoords ? (latitude ?? undefined) : undefined,
    lon: hasCoords ? (longitude ?? undefined) : undefined,
    radiusKm: hasCoords ? radiusKm : undefined,
    offset,
    limit,
  });
  const endpoint = queryString ? `/api/search?${queryString}` : '/api/search';

  return useQuery({
    queryKey: restaurantKeys.search(queryString),
    queryFn: () => apiFetch<UnifiedSearchResponse>(endpoint),
    enabled: hasCoords,
  });
}

interface UnifiedSearchParams {
  q: string;
  latitude?: number | null;
  longitude?: number | null;
  radiusKm?: number;
  offset?: number;
  limit?: number;
}

export function useUnifiedSearch(params: UnifiedSearchParams) {
  const { q, latitude, longitude, radiusKm = 5, offset = 0, limit = 20 } = params;
  const trimmedQ = q.trim();
  const hasCoords = latitude != null && longitude != null;
  const queryString = buildSearchQuery({
    q: trimmedQ || undefined,
    lat: hasCoords ? (latitude ?? undefined) : undefined,
    lon: hasCoords ? (longitude ?? undefined) : undefined,
    radiusKm: hasCoords ? radiusKm : undefined,
    offset,
    limit,
  });
  const endpoint = `/api/search?${queryString}`;

  return useQuery({
    queryKey: restaurantKeys.search(queryString),
    queryFn: () => apiFetch<UnifiedSearchResponse>(endpoint),
    enabled: trimmedQ.length > 0,
  });
}

export function useRestaurant(id: string) {
  return useQuery({
    queryKey: restaurantKeys.detail(id),
    queryFn: () => apiFetch<Restaurant>(`/api/restaurants/${id}`),
    enabled: !!id,
  });
}

export function useRestaurantMenu(restaurantId: string) {
  return useQuery({
    queryKey: menuKeys.list(restaurantId),
    queryFn: () =>
      apiFetch<MenuItemListResponse>(
        `/api/menu-items?restaurantId=${restaurantId}`,
      ),
    enabled: !!restaurantId,
  });
}

export function useRestaurantCategories(restaurantId: string) {
  return useQuery({
    queryKey: [...restaurantKeys.detail(restaurantId), 'categories'] as const,
    queryFn: () =>
      apiFetch<{ id: string; name: string }[]>(
        `/api/menu-items/categories?restaurantId=${restaurantId}`,
      ),
    enabled: !!restaurantId,
  });
}

export function useMenuItem(id: string) {
  return useQuery({
    queryKey: menuKeys.detail(id),
    queryFn: () => apiFetch<MenuItem>(`/api/menu-items/${id}`),
    enabled: !!id,
  });
}

export function useMenuItemModifiers(menuItemId: string) {
  return useQuery({
    queryKey: [...menuKeys.detail(menuItemId), 'modifiers'] as const,
    queryFn: () =>
      apiFetch<ModifierGroup[]>(
        `/api/menu-items/${menuItemId}/modifier-groups`,
      ),
    enabled: !!menuItemId,
  });
}

export function useDeliveryEstimate(
  restaurantId: string | undefined,
  lat: number | null,
  lon: number | null,
) {
  const hasCoords = lat !== null && lon !== null;
  const queryKey =
    restaurantId && hasCoords
      ? restaurantKeys.estimate(restaurantId, lat, lon)
      : (['restaurants', 'estimate', 'unavailable'] as const);

  return useQuery({
    queryKey,
    queryFn: () => fetchDeliveryEstimate(restaurantId!, lat!, lon!),
    enabled: !!restaurantId && hasCoords,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useDeliveryEstimates(
  restaurantIds: readonly string[],
  lat: number | null,
  lon: number | null,
) {
  const hasCoords = lat !== null && lon !== null;
  const queries = hasCoords
    ? restaurantIds.map((restaurantId) => ({
        queryKey: restaurantKeys.estimate(restaurantId, lat, lon),
        queryFn: () => fetchDeliveryEstimate(restaurantId, lat, lon),
        enabled: !!restaurantId,
        retry: false,
        staleTime: 1000 * 60 * 5,
      }))
    : [];

  return useQueries({ queries });
}
