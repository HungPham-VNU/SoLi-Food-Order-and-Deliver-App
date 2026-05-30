export interface NotificationPreference {
  pushEnabled: boolean;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  mutedTypes: string[];
  email: string | null;
  timezone: string;
}

export interface UpdateNotificationPreferenceInput {
  pushEnabled?: boolean;
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  quietHoursStart?: number | null;
  quietHoursEnd?: number | null;
  mutedTypes?: string[];
  email?: string | null;
  timezone?: string;
}

// Common muted categories shown in the Notifications tab.
export const MUTED_CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'order_status', label: 'Order Status' },
  { value: 'promotion', label: 'Promotions' },
  { value: 'daily_summary', label: 'Daily Summary' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'system', label: 'System Updates' },
];

export type SettingsTab =
  | 'profile'
  | 'store'
  | 'security'
  | 'notifications'
  | 'devices'
  | 'danger';
