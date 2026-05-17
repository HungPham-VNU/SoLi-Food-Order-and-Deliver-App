export type NotificationType =
  // Customer — Order lifecycle
  | 'order_placed'
  | 'order_confirmed'
  | 'order_preparing'
  | 'order_ready_for_pickup'
  | 'order_picked_up'
  | 'order_delivering'
  | 'order_delivered'
  | 'order_cancelled'
  | 'order_refunded'
  // Customer — Payment
  | 'payment_confirmed'
  | 'payment_failed'
  // Customer — Refund
  | 'refund_initiated'
  | 'refund_completed'
  // Restaurant
  | 'new_order_received'
  // System
  | 'system_announcement';

export interface NotificationPayload {
  id: string;                          // UUID
  type: NotificationType;              // Determines routing, icon, colour
  title: string;                       // Short display title (Vietnamese)
  body: string;                        // Full notification body (Vietnamese)
  data?: Record<string, string>;       // Template variables for deep-linking
  orderId?: string;                    // Present for order/payment events
  createdAt: string;                   // ISO 8601
  isRead: boolean;
  readAt?: string;                     // ISO 8601 or undefined
}

export interface NotificationInboxResponse {
  items: NotificationPayload[];
  total: number;
  unreadCount: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface UnreadCountResponse {
  count: number;
}
