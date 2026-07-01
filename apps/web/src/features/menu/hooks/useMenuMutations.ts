import { useMutation, useQueryClient } from '@tanstack/react-query';
import { menuApi, type CreateMenuItemDto, type UpdateMenuItemDto, type CreateMenuCategoryDto, type UpdateMenuCategoryDto, type CreateModifierGroupDto, type UpdateModifierGroupDto, type CreateModifierOptionDto, type UpdateModifierOptionDto } from '../api/menu.api';
import type {
  CalculateNutritionRequest,
  MenuItem,
  SaveNutritionRequest,
} from '../types';
import { menuKeys } from './useMenu';

export function useCreateMenuItem(restaurantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateMenuItemDto) => menuApi.createItem(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: menuKeys.items(restaurantId) });
    },
  });
}

export function useUpdateMenuItem(restaurantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateMenuItemDto }) =>
      menuApi.updateItem(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: menuKeys.items(restaurantId) });
    },
  });
}

export function useToggleSoldOut(restaurantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => menuApi.toggleSoldOut(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: menuKeys.items(restaurantId) });
    },
  });
}

export function useDeleteMenuItem(restaurantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => menuApi.deleteItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: menuKeys.items(restaurantId) });
    },
  });
}

export function useCreateCategory(restaurantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateMenuCategoryDto) => menuApi.createCategory(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: menuKeys.categories(restaurantId) });
    },
  });
}

export function useDeleteCategory(restaurantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => menuApi.deleteCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: menuKeys.categories(restaurantId) });
      qc.invalidateQueries({ queryKey: menuKeys.items(restaurantId) });
    },
  });
}

export function useUpdateCategory(restaurantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateMenuCategoryDto }) =>
      menuApi.updateCategory(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: menuKeys.categories(restaurantId) });
    },
  });
}

export function useCreateModifierGroup(menuItemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateModifierGroupDto) => menuApi.createModifierGroup(menuItemId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: menuKeys.modifierGroups(menuItemId) });
    },
    onError: (error) => {
      console.error('Failed to create modifier group:', error);
    },
  });
}

export function useUpdateModifierGroup(menuItemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, dto }: { groupId: string; dto: UpdateModifierGroupDto }) =>
      menuApi.updateModifierGroup(menuItemId, groupId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: menuKeys.modifierGroups(menuItemId) });
    },
  });
}

export function useDeleteModifierGroup(menuItemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => menuApi.deleteModifierGroup(menuItemId, groupId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: menuKeys.modifierGroups(menuItemId) });
    },
  });
}

export function useCreateModifierOption(menuItemId: string, groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateModifierOptionDto & { groupId?: string }) =>
      menuApi.createModifierOption(menuItemId, dto.groupId || groupId, dto),
    onSuccess: (_, variables) => {
      const actualGroupId = variables.groupId || groupId;
      qc.invalidateQueries({ queryKey: menuKeys.modifierGroups(menuItemId) });
      qc.invalidateQueries({ queryKey: menuKeys.modifierGroup(menuItemId, actualGroupId) });
    },
    onError: (error) => {
      console.error('Failed to create modifier option:', error);
    },
  });
}

export function useUpdateModifierOption(menuItemId: string, groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ optionId, dto }: { optionId: string; dto: UpdateModifierOptionDto }) =>
      menuApi.updateModifierOption(menuItemId, groupId, optionId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: menuKeys.modifierGroups(menuItemId) });
      qc.invalidateQueries({ queryKey: menuKeys.modifierGroup(menuItemId, groupId) });
    },
  });
}

export function useDeleteModifierOption(menuItemId: string, groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (optionId: string) =>
      menuApi.deleteModifierOption(menuItemId, groupId, optionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: menuKeys.modifierGroups(menuItemId) });
      qc.invalidateQueries({ queryKey: menuKeys.modifierGroup(menuItemId, groupId) });
    },
  });
}

type AnalyzeNutritionVariables =
  | string
  | {
      menuItemId?: string;
      recipeText: string;
    };

export function useAnalyzeNutrition(defaultMenuItemId?: string) {
  return useMutation({
    mutationFn: (variables: AnalyzeNutritionVariables) => {
      const menuItemId =
        typeof variables === 'string'
          ? defaultMenuItemId
          : (variables.menuItemId ?? defaultMenuItemId);
      const recipeText =
        typeof variables === 'string' ? variables : variables.recipeText;

      if (!menuItemId) {
        throw new Error('Save this item before analyzing the recipe.');
      }

      return menuApi.analyzeNutrition(menuItemId, recipeText);
    },
  });
}

export function useStartManualNutritionSession(defaultMenuItemId?: string) {
  return useMutation({
    mutationFn: (menuItemId?: string) => {
      const targetMenuItemId = menuItemId ?? defaultMenuItemId;
      if (!targetMenuItemId) {
        throw new Error('Save this item before entering ingredients.');
      }
      return menuApi.startManualNutritionSession(targetMenuItemId);
    },
  });
}

export function useCalculateNutrition(menuItemId: string) {
  return useMutation({
    mutationFn: (dto: CalculateNutritionRequest) =>
      menuApi.calculateNutrition(menuItemId, dto),
  });
}

export function useSaveNutrition(menuItemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: SaveNutritionRequest) =>
      menuApi.saveNutrition(menuItemId, dto),
    onSuccess: (nutrition) => {
      qc.setQueryData<MenuItem>(menuKeys.item(menuItemId), (item) =>
        item ? { ...item, nutrition } : item,
      );
      qc.invalidateQueries({ queryKey: menuKeys.item(menuItemId) });
      qc.invalidateQueries({ queryKey: menuKeys.nutritionAnalysis(menuItemId) });
    },
  });
}
