import { apiFetch } from '@/src/lib/api-client';
import type {
  PromotionResponseDto,
  ValidateCouponDto,
  PreviewDiscountDto,
  PreviewDiscountResponseDto,
} from '../types';

export const getActivePromotions = (restaurantId?: string) => {
  const params = restaurantId ? `?restaurantId=${restaurantId}` : '';
  return apiFetch<PromotionResponseDto[]>(`/api/promotions/active${params}`);
};

export const validateCoupon = (dto: ValidateCouponDto) =>
  apiFetch<PreviewDiscountResponseDto>('/api/promotions/coupons/validate', {
    method: 'POST',
    body: JSON.stringify(dto),
  });

export const previewDiscount = (dto: PreviewDiscountDto) =>
  apiFetch<PreviewDiscountResponseDto>('/api/promotions/preview', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
