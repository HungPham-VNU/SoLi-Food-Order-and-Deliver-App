import { useMutation, useQueryClient } from '@tanstack/react-query';
import { menuApi, type CreateMenuItemDto, type UpdateMenuItemDto, type CreateMenuCategoryDto } from '../api/menu.api';
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
