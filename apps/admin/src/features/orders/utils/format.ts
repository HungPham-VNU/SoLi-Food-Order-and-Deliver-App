import type { OrderStatus } from '../api/orders.api';

export function formatVND(amount: number): string {
  return `₫${amount.toLocaleString('vi-VN')}`;
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function shortId(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

export interface StatusStyle {
  label: string;
  badge: string; // tailwind classes for badge bg/text
  dot: string;   // tailwind classes for the colored dot
}

export const STATUS_META: Record<OrderStatus, StatusStyle> = {
  pending: {
    label: 'Pending',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  paid: {
    label: 'Paid',
    badge: 'bg-sky-100 text-sky-700 border-sky-200',
    dot: 'bg-sky-500',
  },
  confirmed: {
    label: 'Confirmed',
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
  },
  preparing: {
    label: 'Preparing',
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
  },
  ready_for_pickup: {
    label: 'Ready',
    badge: 'bg-violet-100 text-violet-700 border-violet-200',
    dot: 'bg-violet-500',
  },
  picked_up: {
    label: 'Picked up',
    badge: 'bg-violet-100 text-violet-700 border-violet-200',
    dot: 'bg-violet-500',
  },
  delivering: {
    label: 'Delivering',
    badge: 'bg-violet-100 text-violet-700 border-violet-200',
    dot: 'bg-violet-500',
  },
  delivered: {
    label: 'Delivered',
    badge: 'bg-green-100 text-green-700 border-green-200',
    dot: 'bg-green-500',
  },
  cancelled: {
    label: 'Cancelled',
    badge: 'bg-red-100 text-red-700 border-red-200',
    dot: 'bg-red-500',
  },
  refunded: {
    label: 'Refunded',
    badge: 'bg-gray-100 text-gray-700 border-gray-200',
    dot: 'bg-gray-500',
  },
};
