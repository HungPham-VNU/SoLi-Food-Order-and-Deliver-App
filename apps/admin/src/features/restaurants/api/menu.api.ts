import { apiClient } from '@/lib/api-client';

export interface MenuCategory {
  id: string;
  restaurantId: string;
  name: string;
  displayOrder: number;
  createdAt: string;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  itemKind: 'food' | 'beverage' | 'mixed';
  status: 'available' | 'unavailable' | 'out_of_stock';
  tags: string[];
  nutrition?: {
    servings: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number | null;
    sugar: number | null;
    sodium: number | null;
    source: 'AI_ESTIMATED' | 'MANUALLY_ENTERED' | 'VERIFIED_BY_RESTAURANT';
    verifiedByRestaurant: boolean;
    disclaimer: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModifierOption {
  id: string;
  groupId: string;
  name: string;
  price: number;
  isDefault: boolean;
  displayOrder: number;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ModifierGroup {
  id: string;
  menuItemId: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  options: ModifierOption[];
}

export type MenuItemStatusFilter = MenuItem['status'] | 'all' | 'visible';

export const menuApi = {
  getCategories: (restaurantId: string) =>
    apiClient
      .get<
        MenuCategory[]
      >('/api/menu-items/categories', { params: { restaurantId } })
      .then((r) => r.data),

  getItems: (
    restaurantId: string,
    params?: {
      categoryId?: string;
      status?: MenuItemStatusFilter;
      offset?: number;
      limit?: number;
    },
  ) =>
    apiClient
      .get<{
        data: MenuItem[];
        total: number;
      }>('/api/menu-items', { params: { restaurantId, ...params } })
      .then((r) => r.data),

  getItem: (id: string) =>
    apiClient.get<MenuItem>(`/api/menu-items/${id}`).then((r) => r.data),

  getModifiers: (menuItemId: string) =>
    apiClient
      .get<ModifierGroup[]>(`/api/menu-items/${menuItemId}/modifier-groups`)
      .then((r) => r.data),
};
