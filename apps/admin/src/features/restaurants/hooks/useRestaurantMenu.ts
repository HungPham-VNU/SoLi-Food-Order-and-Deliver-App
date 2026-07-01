import { useQuery } from '@tanstack/react-query';
import { menuApi, type MenuItemStatusFilter } from '../api/menu.api';

export function useRestaurantMenuCategories(restaurantId: string) {
  return useQuery({
    queryKey: ['restaurant-categories', restaurantId],
    queryFn: () => menuApi.getCategories(restaurantId),
    enabled: !!restaurantId,
  });
}

export function useRestaurantMenuItems(
  restaurantId: string,
  params?: {
    categoryId?: string;
    status?: MenuItemStatusFilter;
    offset?: number;
    limit?: number;
  },
) {
  return useQuery({
    queryKey: ['restaurant-items', restaurantId, params],
    queryFn: () => menuApi.getItems(restaurantId, params),
    enabled: !!restaurantId,
  });
}

export function useMenuItem(itemId: string | null) {
  return useQuery({
    queryKey: ['menu-item', itemId],
    queryFn: () => (itemId ? menuApi.getItem(itemId) : null),
    enabled: !!itemId,
  });
}

export function useMenuItemModifiers(menuItemId: string | null) {
  return useQuery({
    queryKey: ['menu-item-modifiers', menuItemId],
    queryFn: () => (menuItemId ? menuApi.getModifiers(menuItemId) : null),
    enabled: !!menuItemId,
  });
}
