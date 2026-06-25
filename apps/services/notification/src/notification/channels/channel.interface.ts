import type { Notification } from '../domain/notification.schema';

// ---------------------------------------------------------------------------
// DeliveryResult
//
// Returned by every INotificationChannel.deliver() implementation.
// The ChannelDispatcherService uses this to:
//  1. Write a row to notification_delivery_logs.
//  2. Update the notification's status (sent | failed).
//  3. Emit structured log output for observability.
// ---------------------------------------------------------------------------

export interface DeliveryResult {
  /** true = the channel provider accepted the payload for delivery */
  success: boolean;

  /**
   * Short machine-readable error code.
   * Populated only when success = false.
   *
   * Canonical values:
   *   SMTP_NOT_CONFIGURED    — SMTP env vars not set in this environment
   *   SMTP_SEND_ERROR        — Nodemailer / SMTP server returned an error
   *   NO_RECIPIENT_EMAIL     — User has no email address in notification_preferences
   *   NO_ACTIVE_TOKENS       — User has no active push device tokens
   *   FCM_SEND_ERROR         — FCM provider returned an error
   *   ADAPTER_EXCEPTION      — Unexpected exception thrown by channel adapter
   *   WS_EMIT_ERROR          — WebSocket gateway threw during emit (in_app only)
   */
  errorCode?: string;

  /** Human-readable description of the error (for delivery log records). */
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// DeliveryContext
//
// Contextual data passed alongside the notification row when dispatching.
// Adapters use this for data that is NOT stored on the notification row
// (e.g. the recipient email address, which lives in notification_preferences).
// ---------------------------------------------------------------------------

export interface DeliveryContext {
  /** IAM userId of the notification recipient. */
  recipientId: string;

  /**
   * Recipient email address resolved from notification_preferences.email.
   * null when the user has no preference row or has not set an email address.
   * Used exclusively by EmailChannelService.
   */
  email: string | null;
}

// ---------------------------------------------------------------------------
// INotificationChannel
//
// Strategy interface implemented by every channel adapter:
//   InAppChannelService  — WebSocket real-time delivery + unread cache invalidation
//   EmailChannelService  — SMTP email via Nodemailer
//   PushChannelService   — Firebase Cloud Messaging (FCM) fan-out
//
// Contract:
//  - MUST NOT throw under any circumstances.
//  - MUST return a DeliveryResult describing the outcome.
//  - The channel adapter owns only the transport layer.
//    Delivery logging and status updates are the dispatcher's responsibility.
//
// Phase: N-4 — Multi-Channel Delivery
// ---------------------------------------------------------------------------

export interface INotificationChannel {
  deliver(
    notification: Notification,
    context: DeliveryContext,
  ): Promise<DeliveryResult>;
}
