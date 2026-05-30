import { apiFetch } from '@/src/lib/api-client';

export const ALLOWED_REVIEW_TAGS = [
  'fast_delivery',
  'good_packaging',
  'fresh_food',
  'accurate_order',
  'friendly_service',
  'poor_packaging',
  'late_delivery',
  'wrong_order',
  'cold_food',
  'missing_items',
] as const;

export type ReviewTag = (typeof ALLOWED_REVIEW_TAGS)[number];

export interface SubmitReviewPayload {
  orderId: string;
  stars: number;
  comment?: string;
  tags?: ReviewTag[];
}

export interface ReviewResponse {
  id: string;
  orderId: string;
  customerId: string;
  restaurantId: string;
  stars: number;
  comment: string | null;
  tags: string[];
  moderationStatus: 'visible' | 'flagged' | 'hidden';
  createdAt: string;
  updatedAt: string;
  message?: string;
}

export const submitReview = async (
  payload: SubmitReviewPayload,
): Promise<ReviewResponse> => {
  return apiFetch<ReviewResponse>('/api/reviews', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const getMyReview = async (
  orderId: string,
): Promise<ReviewResponse> => {
  return apiFetch<ReviewResponse>(`/api/reviews/my/${orderId}`);
};
