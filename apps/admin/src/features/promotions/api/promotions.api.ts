import { apiClient } from '@/lib/api-client';

export type PromotionType =
  | 'percentage'
  | 'fixed_amount'
  | 'free_delivery'
  | 'reduced_delivery'
  | 'buy_x_get_y'
  | 'free_item';

export type PromotionScope = 'platform' | 'restaurant';
export type PromotionTrigger = 'auto_apply' | 'coupon_code';
export type StackingMode = 'non_stackable' | 'stackable' | 'exclusive';
export type PromotionStatus =
  | 'draft'
  | 'active'
  | 'paused'
  | 'cancelled'
  | 'expired';

export interface Promotion {
  id: string;
  name: string;
  description: string | null;
  type: PromotionType;
  scope: PromotionScope;
  status: PromotionStatus;
  trigger: PromotionTrigger;
  stackingMode: StackingMode;
  restaurantId: string | null;
  discountValue: number;
  minOrderAmount: number | null;
  maxDiscountAmount: number | null;
  maxTotalUses: number | null;
  currentTotalUses: number;
  maxUsesPerUser: number | null;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromotionListResponse {
  items: Promotion[];
  total: number;
  offset: number;
  limit: number;
}

export interface CreatePromotionDto {
  name: string;
  description?: string;
  type: PromotionType;
  scope: PromotionScope;
  trigger: PromotionTrigger;
  stackingMode?: StackingMode;
  restaurantId?: string;
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  maxTotalUses?: number;
  maxUsesPerUser?: number;
  startsAt: string;
  endsAt: string;
}

export interface UpdatePromotionDto extends Partial<Omit<CreatePromotionDto, 'type' | 'scope' | 'trigger'>> {}

export const promotionsApi = {
  list: (params?: {
    status?: PromotionStatus;
    restaurantId?: string;
    offset?: number;
    limit?: number;
  }) =>
    apiClient
      .get<PromotionListResponse>('/api/promotions/admin', { params })
      .then((r) => r.data),

  get: (id: string) =>
    apiClient
      .get<Promotion>(`/api/promotions/admin/${id}`)
      .then((r) => r.data),

  create: (dto: CreatePromotionDto) =>
    apiClient
      .post<Promotion>('/api/promotions/admin', dto)
      .then((r) => r.data),

  update: (id: string, dto: UpdatePromotionDto) =>
    apiClient
      .patch<Promotion>(`/api/promotions/admin/${id}`, dto)
      .then((r) => r.data),

  cancel: (id: string) =>
    apiClient.delete(`/api/promotions/admin/${id}`).then((r) => r.data),

  activate: (id: string) =>
    apiClient
      .patch<Promotion>(`/api/promotions/admin/${id}/activate`)
      .then((r) => r.data),

  pause: (id: string) =>
    apiClient
      .patch<Promotion>(`/api/promotions/admin/${id}/pause`)
      .then((r) => r.data),
};
