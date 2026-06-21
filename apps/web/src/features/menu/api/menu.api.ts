import { apiClient } from '@/lib/api-client';
import type {
  AnalyzeRecipeResponse,
  CalculateNutritionRequest,
  CalculateNutritionResponse,
  MenuCategory,
  MenuItem,
  MenuItemListResponse,
  MenuItemNutrition,
  MenuItemNutritionAnalysis,
  ModifierGroup,
  ModifierOption,
  SaveNutritionRequest,
} from '../types';

export interface CreateMenuItemDto {
  restaurantId: string;
  name: string;
  price: number;
  categoryId?: string;
  description?: string;
  sku?: string;
  imageUrl?: string;
  tags?: string[];
}

export interface UpdateMenuItemDto {
  name?: string;
  price?: number;
  categoryId?: string;
  description?: string;
  sku?: string;
  imageUrl?: string;
  tags?: string[];
  status?: 'available' | 'unavailable' | 'out_of_stock';
}

export interface DietaryTagOption {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: 'dietary' | 'lifestyle';
  isActive: boolean;
}

export interface CreateMenuCategoryDto {
  restaurantId: string;
  name: string;
  displayOrder?: number;
}

export interface CreateModifierGroupDto {
  name: string;
  minSelections?: number;
  maxSelections?: number;
  displayOrder?: number;
}

export interface UpdateModifierGroupDto {
  name?: string;
  minSelections?: number;
  maxSelections?: number;
  displayOrder?: number;
}

export interface CreateModifierOptionDto {
  name: string;
  price?: number;
  isDefault?: boolean;
  displayOrder?: number;
  isAvailable?: boolean;
}

export interface UpdateModifierOptionDto {
  name?: string;
  price?: number;
  isDefault?: boolean;
  displayOrder?: number;
  isAvailable?: boolean;
}

export const menuApi = {
  getDietaryTags: () =>
    apiClient
      .get<DietaryTagOption[]>('/api/dietary-tags')
      .then((response) => response.data),
  getItems: (restaurantId: string, params?: { categoryId?: string; status?: string; offset?: number; limit?: number }) =>
    apiClient.get<MenuItemListResponse>('/api/menu-items', {
      params: { restaurantId, status: 'all', ...params },
    }).then((r) => r.data),

  getItem: (id: string) =>
    apiClient.get<MenuItem>(`/api/menu-items/${id}`).then((r) => r.data),

  getCategories: (restaurantId: string) =>
    apiClient.get<MenuCategory[]>('/api/menu-items/categories', {
      params: { restaurantId },
    }).then((r) => r.data),

  createItem: (dto: CreateMenuItemDto) =>
    apiClient.post<MenuItem>('/api/menu-items', dto).then((r) => r.data),

  updateItem: (id: string, dto: UpdateMenuItemDto) =>
    apiClient.patch<MenuItem>(`/api/menu-items/${id}`, dto).then((r) => r.data),

  toggleSoldOut: (id: string) =>
    apiClient.patch<MenuItem>(`/api/menu-items/${id}/sold-out`).then((r) => r.data),

  deleteItem: (id: string) =>
    apiClient.delete(`/api/menu-items/${id}`),

  createCategory: (dto: CreateMenuCategoryDto) =>
    apiClient.post<MenuCategory>('/api/menu-items/categories', dto).then((r) => r.data),

  deleteCategory: (id: string) =>
    apiClient.delete(`/api/menu-items/categories/${id}`),

  // Modifier Groups
  getModifierGroups: (menuItemId: string) =>
    apiClient.get<ModifierGroup[]>(`/api/menu-items/${menuItemId}/modifier-groups`).then((r) => r.data),

  getModifierGroup: (menuItemId: string, groupId: string) =>
    apiClient.get<ModifierGroup>(`/api/menu-items/${menuItemId}/modifier-groups/${groupId}`).then((r) => r.data),

  createModifierGroup: (menuItemId: string, dto: CreateModifierGroupDto) =>
    apiClient.post<ModifierGroup>(`/api/menu-items/${menuItemId}/modifier-groups`, dto).then((r) => r.data),

  updateModifierGroup: (menuItemId: string, groupId: string, dto: UpdateModifierGroupDto) =>
    apiClient.patch<ModifierGroup>(`/api/menu-items/${menuItemId}/modifier-groups/${groupId}`, dto).then((r) => r.data),

  deleteModifierGroup: (menuItemId: string, groupId: string) =>
    apiClient.delete(`/api/menu-items/${menuItemId}/modifier-groups/${groupId}`),

  // Modifier Options
  createModifierOption: (menuItemId: string, groupId: string, dto: CreateModifierOptionDto) =>
    apiClient.post<ModifierOption>(`/api/menu-items/${menuItemId}/modifier-groups/${groupId}/options`, dto).then((r) => r.data),

  updateModifierOption: (menuItemId: string, groupId: string, optionId: string, dto: UpdateModifierOptionDto) =>
    apiClient.patch<ModifierOption>(`/api/menu-items/${menuItemId}/modifier-groups/${groupId}/options/${optionId}`, dto).then((r) => r.data),

  deleteModifierOption: (menuItemId: string, groupId: string, optionId: string) =>
    apiClient.delete(`/api/menu-items/${menuItemId}/modifier-groups/${groupId}/options/${optionId}`),

  analyzeNutrition: (menuItemId: string, recipeText: string) =>
    apiClient
      .post<AnalyzeRecipeResponse>(
        `/api/restaurant/menu-items/${menuItemId}/nutrition/analyze-recipe`,
        { recipeText },
      )
      .then((r) => r.data),

  getLatestNutritionAnalysis: (menuItemId: string) =>
    apiClient
      .get<MenuItemNutritionAnalysis | null>(
        `/api/restaurant/menu-items/${menuItemId}/nutrition/latest`,
      )
      .then((r) => r.data),

  calculateNutrition: (menuItemId: string, dto: CalculateNutritionRequest) =>
    apiClient
      .post<CalculateNutritionResponse>(
        `/api/restaurant/menu-items/${menuItemId}/nutrition/calculate`,
        dto,
      )
      .then((r) => r.data),

  saveNutrition: (menuItemId: string, dto: SaveNutritionRequest) =>
    apiClient
      .put<MenuItemNutrition>(
        `/api/restaurant/menu-items/${menuItemId}/nutrition`,
        dto,
      )
      .then((r) => r.data),
};
