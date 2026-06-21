import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  dietaryTagsApi,
  type CreateDietaryTagDto,
  type UpdateDietaryTagDto,
} from '../api/dietary-tags.api';

export const dietaryTagKeys = {
  all: ['admin-dietary-tags'] as const,
};

export function useDietaryTags() {
  return useQuery({
    queryKey: dietaryTagKeys.all,
    queryFn: dietaryTagsApi.list,
  });
}

export function useCreateDietaryTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateDietaryTagDto) => dietaryTagsApi.create(dto),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: dietaryTagKeys.all }),
  });
}

export function useUpdateDietaryTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; dto: UpdateDietaryTagDto }) =>
      dietaryTagsApi.update(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: dietaryTagKeys.all }),
  });
}

export function useDeleteDietaryTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: dietaryTagsApi.delete,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: dietaryTagKeys.all }),
  });
}
