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

export const TAG_LABELS: Record<ReviewTag, string> = {
  fast_delivery: 'Fast delivery',
  good_packaging: 'Good packaging',
  fresh_food: 'Fresh food',
  accurate_order: 'Accurate order',
  friendly_service: 'Friendly service',
  poor_packaging: 'Poor packaging',
  late_delivery: 'Late delivery',
  wrong_order: 'Wrong order',
  cold_food: 'Cold food',
  missing_items: 'Missing items',
};

/** Order statuses that allow a review — must stay in sync with backend REVIEWABLE_STATUSES. */
export const REVIEWABLE_ORDER_STATUSES = [
  'ready_for_pickup',
  'picked_up',
  'delivering',
  'delivered',
] as const;

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
  message?: string;
}

export interface PublicReviewItem {
  id: string;
  stars: number;
  comment?: string | null;
  tags?: string[] | null;
  createdAt: string;
}

export interface PublicReviewListResponse {
  data: PublicReviewItem[];
  total: number;
  page: number;
  limit: number;
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

export const getRestaurantReviews = async (
  restaurantId: string,
  page = 1,
  limit = 3,
): Promise<PublicReviewListResponse> => {
  return apiFetch<PublicReviewListResponse>(
    `/api/reviews/restaurant/${encodeURIComponent(
      restaurantId,
    )}?page=${page}&limit=${limit}`,
  );
};
