import { useMutation, useQueryClient } from '@tanstack/react-query';
import { menuApi, type CreateMenuItemDto, type UpdateMenuItemDto, type CreateMenuCategoryDto, type CreateModifierGroupDto, type UpdateModifierGroupDto, type CreateModifierOptionDto, type UpdateModifierOptionDto } from '../api/menu.api';
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
