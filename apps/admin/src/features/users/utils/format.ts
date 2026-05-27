import type { AdminUser, AppRole } from '../api/users.api';

export const ROLES: AppRole[] = ['admin', 'restaurant', 'shipper', 'user'];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Admin',
  restaurant: 'Restaurant',
  shipper: 'Shipper',
  user: 'Customer',
};

export const ROLE_BADGE: Record<AppRole, string> = {
  admin: 'bg-purple-100 text-purple-700 border-purple-200',
  restaurant: 'bg-green-100 text-green-700 border-green-200',
  shipper: 'bg-blue-100 text-blue-700 border-blue-200',
  user: 'bg-gray-100 text-gray-700 border-gray-200',
};

export function effectiveRole(user: AdminUser): AppRole {
  return (user.role ?? 'user') as AppRole;
}

export type UserStatus = 'active' | 'unverified' | 'banned';

export function userStatus(user: AdminUser): UserStatus {
  if (user.banned) return 'banned';
  if (!user.emailVerified) return 'unverified';
  return 'active';
}

export const STATUS_META: Record<UserStatus, { label: string; badge: string; dot: string }> = {
  active: {
    label: 'Active',
    badge: 'bg-green-100 text-green-700 border-green-200',
    dot: 'bg-green-500',
  },
  unverified: {
    label: 'Unverified',
    badge: 'bg-gray-100 text-gray-600 border-gray-200',
    dot: 'bg-gray-400',
  },
  banned: {
    label: 'Banned',
    badge: 'bg-red-100 text-red-700 border-red-200',
    dot: 'bg-red-500',
  },
};

export function formatJoinDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
