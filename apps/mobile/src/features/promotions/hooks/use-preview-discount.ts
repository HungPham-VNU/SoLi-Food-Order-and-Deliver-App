import { useQuery } from '@tanstack/react-query';
import { previewDiscount } from '../api/promotion-api';

export function usePreviewDiscount(
  restaurantId?: string | null,
  itemsSubtotal?: number,
  shippingFee?: number,
  couponCode?: string | null,
) {
  const enabled =
    !!restaurantId && itemsSubtotal !== undefined && shippingFee !== undefined;

  return useQuery({
    queryKey: [
      'promotions',
      'preview',
      restaurantId,
      itemsSubtotal,
      shippingFee,
      couponCode ?? null,
    ],
    queryFn: () =>
      previewDiscount({
        restaurantId: restaurantId!,
        itemsSubtotal: itemsSubtotal!,
        shippingFee: shippingFee!,
        couponCode: couponCode ?? undefined,
      }),
    enabled,
    staleTime: 30 * 1000, // 30 seconds
  });
}
