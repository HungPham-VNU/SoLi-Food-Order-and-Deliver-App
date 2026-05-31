import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  promotionsApi,
  type CreatePromotionDto,
  type UpdatePromotionDto,
  type PromotionStatus,
  type CreateCouponCodesDto,
  type CouponStatus,
} from '../api/promotions.api';

const LIST_KEY = 'admin-promotions';

export function usePromotions(params?: {
  status?: PromotionStatus;
  offset?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: [LIST_KEY, params],
    queryFn: () => promotionsApi.list(params),
  });
}

export function usePromotion(id: string | null) {
  return useQuery({
    queryKey: [LIST_KEY, 'detail', id],
    queryFn: () => promotionsApi.get(id!),
    enabled: !!id,
  });
}

export function useCreatePromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreatePromotionDto) => promotionsApi.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: [LIST_KEY] }),
  });
}

export function useUpdatePromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdatePromotionDto }) =>
      promotionsApi.update(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: [LIST_KEY] }),
  });
}

export function useCancelPromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: promotionsApi.cancel,
    onSuccess: () => qc.invalidateQueries({ queryKey: [LIST_KEY] }),
  });
}

export function useActivatePromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: promotionsApi.activate,
    onSuccess: () => qc.invalidateQueries({ queryKey: [LIST_KEY] }),
  });
}

export function usePausePromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: promotionsApi.pause,
    onSuccess: () => qc.invalidateQueries({ queryKey: [LIST_KEY] }),
  });
}

// ---------------------------------------------------------------------------
// Coupon Hooks
// ---------------------------------------------------------------------------

export function usePromotionCoupons(
  promotionId: string,
  params?: { offset?: number; limit?: number; status?: CouponStatus },
) {
  return useQuery({
    queryKey: [LIST_KEY, 'coupons', promotionId, params],
    queryFn: () => promotionsApi.listCoupons(promotionId, params),
    enabled: !!promotionId,
  });
}

export function useGenerateCoupons() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ promotionId, dto }: { promotionId: string; dto: CreateCouponCodesDto }) =>
      promotionsApi.generateCoupons(promotionId, dto),
    onSuccess: (_, { promotionId }) => {
      qc.invalidateQueries({ queryKey: [LIST_KEY, 'coupons', promotionId] });
      qc.invalidateQueries({ queryKey: [LIST_KEY, 'detail', promotionId] });
    },
  });
}

export function useRevokeCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ promotionId, couponId }: { promotionId: string; couponId: string }) =>
      promotionsApi.revokeCoupon(promotionId, couponId),
    onSuccess: (_, { promotionId }) => {
      qc.invalidateQueries({ queryKey: [LIST_KEY, 'coupons', promotionId] });
    },
  });
}

