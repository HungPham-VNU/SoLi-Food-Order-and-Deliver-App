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
  /** Always 'restaurant' in the restaurant portal — the backend rejects anything else. */
  scope: PromotionScope;
  trigger: PromotionTrigger;
  stackingMode?: StackingMode;
  /** Required by the backend when scope is 'restaurant'; must match the query param. */
  restaurantId?: string;
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  maxTotalUses?: number;
  maxUsesPerUser?: number;
  startsAt: string;
  endsAt: string;
}

export type UpdatePromotionDto = Partial<
  Omit<CreatePromotionDto, 'type' | 'scope' | 'trigger' | 'restaurantId'>
>;

export const promotionsApi = {
  list: (restaurantId: string, params?: { offset?: number; limit?: number }) =>
    apiClient
      .get<PromotionListResponse>('/api/promotions/restaurant/my', {
        params: { restaurantId, ...params },
      })
      .then((r) => r.data),

  get: (restaurantId: string, id: string) =>
    apiClient
      .get<Promotion>(`/api/promotions/restaurant/${id}`, {
        params: { restaurantId },
      })
      .then((r) => r.data),

  create: (restaurantId: string, dto: CreatePromotionDto) =>
    apiClient
      .post<Promotion>('/api/promotions/restaurant', dto, {
        params: { restaurantId },
      })
      .then((r) => r.data),

  update: (restaurantId: string, id: string, dto: UpdatePromotionDto) =>
    apiClient
      .patch<Promotion>(`/api/promotions/restaurant/${id}`, dto, {
        params: { restaurantId },
      })
      .then((r) => r.data),

  // NB: pass `undefined` (not `null`) as the body. With the client's default
  // `Content-Type: application/json`, axios serializes a `null` argument into
  // the literal body `null`, which Express's strict JSON body-parser rejects
  // ("Unexpected token 'n', \"null\" is not valid JSON"). `undefined` sends no body.
  activate: (restaurantId: string, id: string) =>
    apiClient
      .patch<Promotion>(`/api/promotions/restaurant/${id}/activate`, undefined, {
        params: { restaurantId },
      })
      .then((r) => r.data),

  pause: (restaurantId: string, id: string) =>
    apiClient
      .patch<Promotion>(`/api/promotions/restaurant/${id}/pause`, undefined, {
        params: { restaurantId },
      })
      .then((r) => r.data),

  // Soft-delete (status → cancelled); the backend retains the row.
  cancel: (restaurantId: string, id: string) =>
    apiClient
      .delete(`/api/promotions/restaurant/${id}`, {
        params: { restaurantId },
      })
      .then((r) => r.data),
};
