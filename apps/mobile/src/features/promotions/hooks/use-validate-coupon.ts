import { useMutation } from '@tanstack/react-query';
import { validateCoupon } from '../api/promotion-api';
import type { ValidateCouponDto } from '../types';

export function useValidateCoupon() {
  return useMutation({
    mutationFn: (dto: ValidateCouponDto) => validateCoupon(dto),
  });
}
