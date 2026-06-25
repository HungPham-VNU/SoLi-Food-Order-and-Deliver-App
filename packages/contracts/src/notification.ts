import { z } from 'zod';

export const NOTIFICATION_RPC_PATTERNS = {
  getInbox: 'notification.inbox.get.v1',
  getUnreadCount: 'notification.inbox.unread-count.get.v1',
  markAllRead: 'notification.inbox.read-all.v1',
  markRead: 'notification.inbox.read.v1',
  getPreferences: 'notification.preferences.get.v1',
  updatePreferences: 'notification.preferences.update.v1',
  listPushTokens: 'notification.push-tokens.list.v1',
  registerPushToken: 'notification.push-tokens.register.v1',
  removePushToken: 'notification.push-tokens.remove.v1',
  testPush: 'notification.test.push.v1',
  testEmail: 'notification.test.email.v1',
} as const;

export const notificationTypeSchema = z.enum([
  'order_placed',
  'order_confirmed',
  'order_preparing',
  'order_ready_for_pickup',
  'order_picked_up',
  'order_delivering',
  'order_delivered',
  'order_cancelled',
  'order_refunded',
  'payment_confirmed',
  'payment_failed',
  'refund_initiated',
  'refund_completed',
  'new_order_received',
  'new_review',
  'pickup_request',
  'system_announcement',
]);

export const notificationChannelSchema = z.enum([
  'in_app',
  'push',
  'email',
  'sms',
]);

export const devicePlatformSchema = z.enum(['ios', 'android', 'web']);

const internalAuthSchema = z.object({
  internalAuth: z.string().min(1),
});

export const notificationInboxQuerySchema = z.object({
  unreadOnly: z.boolean().optional(),
  type: notificationTypeSchema.optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});

export const notificationItemSchema = z.object({
  id: z.string().uuid(),
  type: notificationTypeSchema,
  title: z.string(),
  body: z.string(),
  data: z.record(z.string(), z.string()).optional(),
  orderId: z.string().uuid().optional(),
  isRead: z.boolean(),
  readAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});

export const notificationInboxResponseSchema = z.object({
  items: z.array(notificationItemSchema),
  total: z.number().int().nonnegative(),
  unreadCount: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  hasMore: z.boolean(),
});

export const unreadCountResponseSchema = z.object({
  count: z.number().int().nonnegative(),
});

export const markReadResponseSchema = z.object({
  success: z.boolean(),
});

export const markAllReadResponseSchema = z.object({
  count: z.number().int().nonnegative(),
});

export const notificationPreferenceResponseSchema = z.object({
  pushEnabled: z.boolean(),
  inAppEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  smsEnabled: z.boolean(),
  quietHoursStart: z.number().int().min(0).max(23).nullable(),
  quietHoursEnd: z.number().int().min(0).max(23).nullable(),
  mutedTypes: z.array(notificationTypeSchema),
  email: z.string().email().nullable(),
  timezone: z.string().min(1),
});

export const updateNotificationPreferenceSchema = z.object({
  pushEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  quietHoursStart: z.number().int().min(0).max(23).nullable().optional(),
  quietHoursEnd: z.number().int().min(0).max(23).nullable().optional(),
  mutedTypes: z.array(notificationTypeSchema).optional(),
  email: z.string().email().nullable().optional(),
  timezone: z.string().min(1).optional(),
});

export const pushTokenRecordSchema = z.object({
  id: z.string().uuid(),
  tokenSuffix: z.string(),
  platform: devicePlatformSchema,
  isActive: z.boolean(),
  lastSeenAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export const pushTokenListResponseSchema = z.object({
  tokens: z.array(pushTokenRecordSchema),
});

export const registerPushTokenSchema = z.object({
  token: z.string().min(1),
  platform: devicePlatformSchema,
});

export const registerPushTokenResponseSchema = z.object({
  registered: z.boolean(),
});

export const removePushTokenSchema = z.object({
  token: z.string().min(1),
});

export const removePushTokenResponseSchema = z.object({
  removed: z.boolean(),
});

export const testPushSchema = z.object({
  token: z.string().min(1),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(1000),
});

export const testPushResponseSchema = z.object({
  successCount: z.number().int().nonnegative(),
  failureCount: z.number().int().nonnegative(),
  invalidTokens: z.array(z.string()),
});

export const testEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(2000).optional(),
});

export const testEmailResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const getNotificationInboxRequestSchema = internalAuthSchema.extend({
  query: notificationInboxQuerySchema,
});

export const notificationUserRequestSchema = internalAuthSchema;

export const markNotificationReadRequestSchema = internalAuthSchema.extend({
  notificationId: z.string().uuid(),
});

export const updateNotificationPreferencesRequestSchema =
  internalAuthSchema.extend({
    preferences: updateNotificationPreferenceSchema,
  });

export const registerPushTokenRequestSchema = internalAuthSchema.extend({
  token: registerPushTokenSchema,
});

export const removePushTokenRequestSchema = internalAuthSchema.extend({
  token: removePushTokenSchema,
});

export const testPushRequestSchema = z.object({
  push: testPushSchema,
});

export const testEmailRequestSchema = z.object({
  email: testEmailSchema,
});

export const notificationRpcErrorSchema = z.object({
  statusCode: z.number().int().min(400).max(599),
  code: z.string().min(1),
  message: z.string().min(1),
});

export type NotificationType = z.infer<typeof notificationTypeSchema>;
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;
export type DevicePlatform = z.infer<typeof devicePlatformSchema>;
export type NotificationInboxQuery = z.infer<
  typeof notificationInboxQuerySchema
>;
export type NotificationInboxResponse = z.infer<
  typeof notificationInboxResponseSchema
>;
export type UnreadCountResponse = z.infer<typeof unreadCountResponseSchema>;
export type MarkReadResponse = z.infer<typeof markReadResponseSchema>;
export type MarkAllReadResponse = z.infer<typeof markAllReadResponseSchema>;
export type NotificationPreferenceResponse = z.infer<
  typeof notificationPreferenceResponseSchema
>;
export type UpdateNotificationPreference = z.infer<
  typeof updateNotificationPreferenceSchema
>;
export type PushTokenListResponse = z.infer<
  typeof pushTokenListResponseSchema
>;
export type RegisterPushToken = z.infer<typeof registerPushTokenSchema>;
export type RegisterPushTokenResponse = z.infer<
  typeof registerPushTokenResponseSchema
>;
export type RemovePushToken = z.infer<typeof removePushTokenSchema>;
export type RemovePushTokenResponse = z.infer<
  typeof removePushTokenResponseSchema
>;
export type TestPush = z.infer<typeof testPushSchema>;
export type TestPushResponse = z.infer<typeof testPushResponseSchema>;
export type TestEmail = z.infer<typeof testEmailSchema>;
export type TestEmailResponse = z.infer<typeof testEmailResponseSchema>;
export type GetNotificationInboxRequest = z.infer<
  typeof getNotificationInboxRequestSchema
>;
export type NotificationUserRequest = z.infer<
  typeof notificationUserRequestSchema
>;
export type MarkNotificationReadRequest = z.infer<
  typeof markNotificationReadRequestSchema
>;
export type UpdateNotificationPreferencesRequest = z.infer<
  typeof updateNotificationPreferencesRequestSchema
>;
export type RegisterPushTokenRequest = z.infer<
  typeof registerPushTokenRequestSchema
>;
export type RemovePushTokenRequest = z.infer<
  typeof removePushTokenRequestSchema
>;
export type TestPushRequest = z.infer<typeof testPushRequestSchema>;
export type TestEmailRequest = z.infer<typeof testEmailRequestSchema>;
export type NotificationRpcError = z.infer<typeof notificationRpcErrorSchema>;
