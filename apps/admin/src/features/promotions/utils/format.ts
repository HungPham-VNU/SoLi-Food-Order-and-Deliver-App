import type { Promotion, PromotionStatus, PromotionType } from '../api/promotions.api';

export function formatVND(amount: number): string {
  return `₫${amount.toLocaleString('vi-VN')}`;
}

export function formatDateRange(startsAt: string, endsAt: string): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  return `${fmt(new Date(startsAt))} → ${fmt(new Date(endsAt))}`;
}

export function formatDiscount(p: Promotion): string {
  switch (p.type) {
    case 'percentage':
      return `${p.discountValue}% off`;
    case 'fixed_amount':
      return `${formatVND(p.discountValue)} off`;
    case 'free_delivery':
      return 'Free delivery';
    case 'reduced_delivery':
      return `${formatVND(p.discountValue)} off delivery`;
    case 'buy_x_get_y':
      return 'Buy X get Y';
    case 'free_item':
      return 'Free item';
  }
}

export const PROMOTION_TYPE_LABELS: Record<PromotionType, string> = {
  percentage: 'Percentage discount',
  fixed_amount: 'Fixed amount off',
  free_delivery: 'Free delivery',
  reduced_delivery: 'Reduced delivery',
  buy_x_get_y: 'Buy X get Y',
  free_item: 'Free item',
};

export interface StatusStyle {
  label: string;
  badge: string;
  dot: string;
}

export const STATUS_META: Record<PromotionStatus, StatusStyle> = {
  draft: {
    label: 'Draft',
    badge: 'bg-gray-100 text-gray-700 border-gray-200',
    dot: 'bg-gray-400',
  },
  active: {
    label: 'Active',
    badge: 'bg-green-100 text-green-700 border-green-200',
    dot: 'bg-green-500',
  },
  paused: {
    label: 'Paused',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  cancelled: {
    label: 'Cancelled',
    badge: 'bg-red-100 text-red-700 border-red-200',
    dot: 'bg-red-500',
  },
  expired: {
    label: 'Expired',
    badge: 'bg-gray-100 text-gray-600 border-gray-200',
    dot: 'bg-gray-300',
  },
};

/**
 * Determines whether a promotion is "scheduled" — active in the system but
 * its start date is still in the future. Useful for the Scheduled filter pill.
 */
export function isScheduled(p: Promotion): boolean {
  return p.status === 'active' && new Date(p.startsAt) > new Date();
}
