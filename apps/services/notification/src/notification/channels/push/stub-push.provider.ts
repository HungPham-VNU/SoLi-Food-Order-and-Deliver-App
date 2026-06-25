import { Injectable, Logger } from '@nestjs/common';
import type {
  IPushProvider,
  PushSendOptions,
  PushSendResult,
} from './push-provider.interface';

/**
 * StubPushProvider
 *
 * No-op push provider used in development, test, and CI environments
 * where Firebase Admin SDK is not configured.
 *
 * Behaviour:
 *  - Logs each delivery attempt with the token count and notification details.
 *  - Returns a synthetic success result (all tokens "delivered").
 *  - Never performs any real HTTP call.
 *
 * This allows:
 *  1. End-to-end tests to verify the full push delivery pipeline
 *     (token lookup → fan-out → status update → delivery log) without
 *     a live FCM connection.
 *  2. Local development to see push delivery logs for debugging.
 *
 * Production migration:
 *  Replace this binding in NotificationModule with FirebasePushProvider
 *  (which wraps firebase-admin.messaging().sendEachForMulticast()) without
 *  any changes to PushChannelService.
 *
 * Phase: N-4 — Multi-Channel Delivery
 */
@Injectable()
export class StubPushProvider implements IPushProvider {
  private readonly logger = new Logger(StubPushProvider.name);

  send(options: PushSendOptions): Promise<PushSendResult> {
    this.logger.log(
      `[StubPush] Would send push to ${options.tokens.length} token(s): ` +
        `"${options.title}" — "${options.body}" ` +
        `data=${JSON.stringify(options.data ?? {})}`,
    );

    // Simulate immediate delivery success for all tokens
    return Promise.resolve({
      successCount: options.tokens.length,
      failureCount: 0,
      invalidTokens: [],
    });
  }
}
