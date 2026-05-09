// ---------------------------------------------------------------------------
// IPushProvider
//
// Strategy interface for push notification transport providers.
// Implementing this interface allows future migration from the stub
// (development) to Firebase Cloud Messaging (FCM) or APNs without touching
// PushChannelService or any business logic.
//
// Phase: N-4 — Multi-Channel Delivery
// ---------------------------------------------------------------------------

export interface PushSendOptions {
  /** FCM registration tokens to deliver to (fan-out — one call per token set) */
  tokens: string[];
  /** Short push notification title */
  title: string;
  /** Push notification body text */
  body: string;
  /** Structured key-value data for deep-link routing on the client */
  data?: Record<string, string>;
}

export interface PushSendResult {
  /** Number of tokens that received the message successfully */
  successCount: number;
  /** Number of tokens that failed delivery */
  failureCount: number;
  /**
   * Tokens that should be immediately deactivated.
   * FCM returns these when a token is stale, invalid, or unregistered.
   * PushChannelService deactivates them in DeviceTokenRepository.
   */
  invalidTokens: string[];
}

export interface IPushProvider {
  /**
   * Fan-out a push notification to one or more device tokens.
   *
   * MUST NOT throw. Returns a PushSendResult describing per-token outcomes.
   * Providers should map provider-specific errors to the invalidTokens list
   * where appropriate.
   */
  send(options: PushSendOptions): Promise<PushSendResult>;
}

/**
 * NestJS injection token for IPushProvider.
 * The module provides StubPushProvider (dev/test) or FirebasePushProvider (prod).
 */
export const PUSH_PROVIDER = 'PUSH_PROVIDER';
