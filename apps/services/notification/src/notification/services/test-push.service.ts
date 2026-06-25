import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  PUSH_PROVIDER,
  type IPushProvider,
  type PushSendResult,
} from '../channels/push/push-provider.interface';

/**
 * TestPushService
 *
 * Thin service used exclusively by the development test push endpoint.
 * Delegates directly to the PUSH_PROVIDER token so the test endpoint
 * exercises the real FirebasePushProvider (or StubPushProvider in CI).
 *
 * This keeps the test endpoint's dependencies cleanly separated from
 * NotificationService, which owns business-logic push delivery.
 *
 * TODO: Remove this service (and TestPushDto + the controller endpoint)
 *       before going to production.
 *
 * Phase: N-5 — Firebase Cloud Messaging (Dev Testing)
 */
@Injectable()
export class TestPushService {
  private readonly logger = new Logger(TestPushService.name);

  constructor(
    @Inject(PUSH_PROVIDER) private readonly pushProvider: IPushProvider,
  ) {}

  /**
   * Send a test push notification to a single token.
   *
   * @param token   FCM registration token to target
   * @param title   Notification title
   * @param body    Notification body text
   */
  async send(
    token: string,
    title: string,
    body: string,
  ): Promise<PushSendResult> {
    this.logger.log(
      `[TestPush] Sending test push to token: ${token.substring(0, 20)}...`,
    );
    const result = await this.pushProvider.send({
      tokens: [token],
      title,
      body,
    });
    this.logger.log(
      `[TestPush] Result: success=${result.successCount} failure=${result.failureCount} invalid=${result.invalidTokens.length}`,
    );
    return result;
  }
}
