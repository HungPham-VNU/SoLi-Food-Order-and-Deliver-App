import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMyReview,
  submitReview,
  SubmitReviewPayload,
} from '../api/review.api';
import { orderKeys } from '@/src/features/orders/hooks/use-order-history';

export const reviewKeys = {
  all: ['reviews'] as const,
  myByOrder: (orderId: string) =>
    [...reviewKeys.all, 'my', orderId] as const,
};

export const useMyReview = (orderId: string, enabled = true) => {
  return useQuery({
    queryKey: reviewKeys.myByOrder(orderId),
    queryFn: () => getMyReview(orderId),
    enabled: enabled && !!orderId,
    retry: false,
  });
};

export const useSubmitReview = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubmitReviewPayload) => submitReview(payload),
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: reviewKeys.myByOrder(variables.orderId) });
      qc.invalidateQueries({ queryKey: orderKeys.detail(variables.orderId) });
    },
  });
};
