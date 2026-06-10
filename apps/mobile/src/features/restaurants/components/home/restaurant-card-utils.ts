import { formatCurrency } from '@/src/lib/format-utils';
import type {
  DeliveryEstimateResponse,
  RestaurantSearchResult,
} from '../../types';

type RestaurantRatingSource = {
  averageRating?: number | null;
  rating?: number | null;
};

type RestaurantImageSource = Pick<
  RestaurantSearchResult,
  'coverImageUrl' | 'logoUrl'
>;

export type DeliveryEstimateQueryState = {
  data?: DeliveryEstimateResponse;
  isLoading: boolean;
  isFetching: boolean;
};

export function getRestaurantRating(restaurant: RestaurantRatingSource) {
  if (
    typeof restaurant.averageRating === 'number' &&
    restaurant.averageRating > 0
  ) {
    return restaurant.averageRating;
  }

  if (typeof restaurant.rating === 'number' && restaurant.rating > 0) {
    return restaurant.rating;
  }

  return null;
}

export function getRestaurantImageUrl(restaurant: RestaurantImageSource) {
  return restaurant.coverImageUrl ?? restaurant.logoUrl ?? undefined;
}

export function getDeliveryEstimateLabels(
  deliveryEstimateQuery?: DeliveryEstimateQueryState,
) {
  const deliveryEstimate = deliveryEstimateQuery?.data;
  const isDeliveryEstimateLoading =
    deliveryEstimateQuery?.isLoading || deliveryEstimateQuery?.isFetching;
  const deliveryFee = deliveryEstimate?.deliveryFee;
  const isFreeDelivery = deliveryFee === 0;
  const deliveryTimeLabel =
    deliveryEstimate?.estimatedMinutes != null
      ? `${deliveryEstimate.estimatedMinutes} min`
      : isDeliveryEstimateLoading
        ? '...'
        : 'N/A';
  const deliveryFeeLabel =
    deliveryFee != null
      ? isFreeDelivery
        ? 'Free'
        : formatCurrency(deliveryFee)
      : isDeliveryEstimateLoading
        ? '...'
        : 'Unavailable';

  return {
    deliveryFeeLabel,
    deliveryTimeLabel,
    isFreeDelivery,
  };
}
