import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  getRestaurantReviews,
  getMyReview,
  submitReview,
  SubmitReviewPayload,
  ReviewResponse,
} from '../api/review.api';
import { orderKeys } from '@/src/features/orders/hooks/use-order-history';
import { restaurantKeys } from '@/src/features/restaurants/api/restaurant-api';

export const reviewKeys = {
  all: ['reviews'] as const,
  myByOrder: (orderId: string) =>
    [...reviewKeys.all, 'my', orderId] as const,
  restaurant: (restaurantId: string) =>
    [...reviewKeys.all, 'restaurant', restaurantId] as const,
  restaurantList: (restaurantId: string, limit: number) =>
    [...reviewKeys.restaurant(restaurantId), { limit }] as const,
};

// Returns null when the user has not yet reviewed the order (404),
// undefined while loading, ReviewResponse when a review exists, and
// enters error state for any non-404 failure.
export const useMyReview = (orderId: string, enabled = true) => {
  return useQuery<ReviewResponse | null>({
    queryKey: reviewKeys.myByOrder(orderId),
    queryFn: async () => {
      try {
        return await getMyReview(orderId);
      } catch (err) {
        if (err instanceof Error && err.message.includes('\nStatus: 404')) {
          return null;
        }
        throw err;
      }
    },
    enabled: enabled && !!orderId,
    retry: false,
  });
};

export const useRestaurantReviews = (restaurantId: string, limit = 3) => {
  return useInfiniteQuery({
    queryKey: reviewKeys.restaurantList(restaurantId, limit),
    queryFn: ({ pageParam }) =>
      getRestaurantReviews(restaurantId, Number(pageParam), limit),
    enabled: !!restaurantId,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const loadedCount = lastPage.page * lastPage.limit;
      return loadedCount < lastPage.total ? lastPage.page + 1 : undefined;
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
};

export const useSubmitReview = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubmitReviewPayload) => submitReview(payload),
    onSuccess: (data, variables) => {
      // Seed review cache immediately so the UI flips to read-only mode
      // without a follow-up request.
      qc.setQueryData(reviewKeys.myByOrder(variables.orderId), data);
      // Refresh order detail (hasReview flag) and all order list queries.
      qc.invalidateQueries({ queryKey: orderKeys.detail(variables.orderId) });
      qc.invalidateQueries({ queryKey: orderKeys.lists() });
      // Refresh restaurant rating/reviewCount projection displayed across the app.
      qc.invalidateQueries({ queryKey: restaurantKeys.detail(data.restaurantId) });
      qc.invalidateQueries({ queryKey: restaurantKeys.lists() });
      qc.invalidateQueries({ queryKey: reviewKeys.restaurant(data.restaurantId) });
    },
  });
};
