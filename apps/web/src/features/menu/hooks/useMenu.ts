import { useQuery } from '@tanstack/react-query';
import { menuApi } from '../api/menu.api';

export const menuKeys = {
  all: ['menu'] as const,
  items: (restaurantId: string) => ['menu', 'items', restaurantId] as const,
  item: (id: string) => ['menu', 'item', id] as const,
  categories: (restaurantId: string) => ['menu', 'categories', restaurantId] as const,
};

export function useMenuItems(restaurantId: string | undefined) {
  return useQuery({
    queryKey: menuKeys.items(restaurantId ?? ''),
    queryFn: () => menuApi.getItems(restaurantId!),
    enabled: !!restaurantId,
  });
}

export function useMenuCategories(restaurantId: string | undefined) {
  return useQuery({
    queryKey: menuKeys.categories(restaurantId ?? ''),
    queryFn: () => menuApi.getCategories(restaurantId!),
    enabled: !!restaurantId,
  });
}

export function useMenuItem(id: string | undefined) {
  return useQuery({
    queryKey: menuKeys.item(id ?? ''),
    queryFn: () => menuApi.getItem(id!),
    enabled: !!id,
  });
}
