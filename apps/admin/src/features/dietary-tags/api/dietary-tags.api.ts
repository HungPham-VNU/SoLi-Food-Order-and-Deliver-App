import { apiClient } from '@/lib/api-client';

export type DietaryTagCategory = 'dietary' | 'lifestyle';

export interface DietaryTag {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: DietaryTagCategory;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDietaryTagDto {
  name: string;
  slug: string;
  description?: string;
  category: DietaryTagCategory;
  isActive?: boolean;
}

export type UpdateDietaryTagDto = Partial<CreateDietaryTagDto>;

export const dietaryTagsApi = {
  list: () =>
    apiClient
      .get<DietaryTag[]>('/api/dietary-tags/admin')
      .then((response) => response.data),

  create: (dto: CreateDietaryTagDto) =>
    apiClient
      .post<DietaryTag>('/api/dietary-tags/admin', dto)
      .then((response) => response.data),

  update: ({ id, dto }: { id: string; dto: UpdateDietaryTagDto }) =>
    apiClient
      .patch<DietaryTag>(`/api/dietary-tags/admin/${id}`, dto)
      .then((response) => response.data),

  delete: (id: string) =>
    apiClient.delete(`/api/dietary-tags/admin/${id}`).then(() => undefined),
};
