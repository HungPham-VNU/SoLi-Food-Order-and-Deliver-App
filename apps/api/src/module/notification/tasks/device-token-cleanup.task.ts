import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DeviceTokenRepository } from '../repositories/device-token.repository';
import { runObserved } from '@/observability/trace';

/**
 * DeviceTokenCleanupTask
 *
 * Scheduled daily cron that removes stale device tokens from the database
 * to keep the `device_tokens` table lean and prevent wasted FCM deliveries.
 *
 * Two cleanup passes are executed in sequence:
 *
 *  1. Stale-inactive pass — tokens that were already marked `is_active = false`
 *     (because Firebase returned INVALID_REGISTRATION or NOT_REGISTERED) and
 *     have not been refreshed for more than INACTIVE_TTL_DAYS days.
 *     Threshold: 30 days — gives seasonal users time to come back and
 *     re-register without losing their token prematurely.
 *
 *  2. Stale-active pass — tokens that are still `is_active = true` but whose
 *     `last_seen_at` is older than ACTIVE_TTL_DAYS days.  These are almost
 *     certainly from users who uninstalled the app without explicitly calling
 *     DELETE /notifications/my/push-tokens.  Leaving them causes silent push
 *     failures (Firebase delivers to a dead endpoint) that inflate error logs
 *     and use up our FCM quota.
 *     Threshold: 90 days — generous enough for users who travel or use the
 *     app infrequently to retain their registration.
 *
 * Cron schedule: 3 AM Asia/Ho_Chi_Minh (20:00 UTC) — low user traffic.
 *
 * Error handling: all errors are caught and logged with logger.error().
 * The task NEVER throws because uncaught scheduler errors can crash the
 * NestJS application.  An alerting system should watch for ERROR log entries
 * from this class in production.
 *
 * Phase: N-5
 */
@Injectable()
export class DeviceTokenCleanupTask {
  private readonly logger = new Logger(DeviceTokenCleanupTask.name);

  /** Tokens inactive for more than 30 days are permanently deleted. */
  static readonly INACTIVE_TTL_DAYS = 30;

  /** Active-but-unseen tokens older than 90 days are permanently deleted. */
  static readonly ACTIVE_TTL_DAYS = 90;

  constructor(private readonly deviceTokenRepo: DeviceTokenRepository) {}

  /**
   * Daily cleanup — runs at 03:00 Asia/Ho_Chi_Minh.
   *
   * @returns Summary object (mainly useful in unit tests to assert counts).
   */
  @Cron('0 3 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async cleanupStaleTokens(): Promise<{
    deletedInactive: number;
    deletedStaleActive: number;
  }> {
    return runObserved(
      'cron.device_token_cleanup',
      { 'job.name': 'DeviceTokenCleanupTask.cleanupStaleTokens' },
      async () => {
        this.logger.log('[DeviceTokenCleanup] Starting scheduled cleanup run…');

        const now = new Date();

        const inactiveCutoff = new Date(
          now.getTime() -
            DeviceTokenCleanupTask.INACTIVE_TTL_DAYS * 24 * 60 * 60 * 1000,
        );

        const activeCutoff = new Date(
          now.getTime() -
            DeviceTokenCleanupTask.ACTIVE_TTL_DAYS * 24 * 60 * 60 * 1000,
        );

        let deletedInactive = 0;
        let deletedStaleActive = 0;

        // Pass 1 — stale inactive tokens
        try {
          deletedInactive =
            await this.deviceTokenRepo.deleteStaleInactive(inactiveCutoff);

          this.logger.log(
            `[DeviceTokenCleanup] Pass 1 (inactive >${DeviceTokenCleanupTask.INACTIVE_TTL_DAYS}d): deleted ${deletedInactive} token(s)`,
          );
        } catch (err) {
          this.logger.error(
            `[DeviceTokenCleanup] Pass 1 failed: ${(err as Error).message}`,
            (err as Error).stack,
          );
        }

        // Pass 2 — stale active tokens (possible uninstalls)
        try {
          deletedStaleActive =
            await this.deviceTokenRepo.deleteStaleActive(activeCutoff);

          this.logger.log(
            `[DeviceTokenCleanup] Pass 2 (active >${DeviceTokenCleanupTask.ACTIVE_TTL_DAYS}d): deleted ${deletedStaleActive} token(s)`,
          );
        } catch (err) {
          this.logger.error(
            `[DeviceTokenCleanup] Pass 2 failed: ${(err as Error).message}`,
            (err as Error).stack,
          );
        }

        const totalDeleted = deletedInactive + deletedStaleActive;
        this.logger.log(
          `[DeviceTokenCleanup] Run complete. Total deleted: ${totalDeleted} token(s).`,
        );

        return { deletedInactive, deletedStaleActive };
      },
    );
  }
}
