import { Injectable, Inject } from '@nestjs/common';
import { eq, and, lt, desc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import {
  deviceTokens,
  type NewDeviceToken,
  type DeviceToken,
} from '../domain/device-token.schema';

/**
 * DeviceTokenRepository
 *
 * Read/write access to `device_tokens`.
 * One user may have multiple rows (phone + tablet + web browser).
 *
 * Phase: N-1 — Foundation
 * Used actively: Phase N-4 (PushService)
 */
@Injectable()
export class DeviceTokenRepository {
  constructor(@Inject(DB_CONNECTION) private readonly db: NodePgDatabase) {}

  /**
   * Find ALL device tokens for a user (active + inactive).
   * Used by `GET /notifications/my/push-tokens` so users can inspect their
   * registered devices and debug missing-token issues.
   * Results are sorted newest-first by createdAt.
   */
  async findByUserId(userId: string): Promise<DeviceToken[]> {
    return this.db
      .select()
      .from(deviceTokens)
      .where(eq(deviceTokens.userId, userId))
      .orderBy(desc(deviceTokens.createdAt));
  }

  /**
   * Find all active device tokens for a user.
   * Used by PushService (Phase N-4) to fan-out a push to all user devices.
   */
  async findActiveByUserId(userId: string): Promise<DeviceToken[]> {
    return this.db
      .select()
      .from(deviceTokens)
      .where(
        and(eq(deviceTokens.userId, userId), eq(deviceTokens.isActive, true)),
      );
  }

  /**
   * Register or refresh a device token.
   * ON CONFLICT (user_id, token) DO UPDATE: touches lastSeenAt to prevent
   * premature cleanup by the stale-token cron (Phase N-5).
   */
  async registerOrRefresh(data: NewDeviceToken): Promise<void> {
    await this.db
      .insert(deviceTokens)
      .values(data)
      .onConflictDoUpdate({
        target: [deviceTokens.userId, deviceTokens.token],
        set: {
          platform: data.platform,
          isActive: true,
          lastSeenAt: new Date(),
        },
      });
  }

  /**
   * Deactivate a token after Firebase returns INVALID_REGISTRATION or
   * NOT_REGISTERED. The token will be excluded from future deliveries and
   * deleted by the cleanup cron after 30 days.
   */
  async deactivate(userId: string, token: string): Promise<void> {
    await this.db
      .update(deviceTokens)
      .set({ isActive: false })
      .where(
        and(eq(deviceTokens.userId, userId), eq(deviceTokens.token, token)),
      );
  }

  // ---------------------------------------------------------------------------
  // Phase N-5 — Device Token Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Permanently delete tokens that are inactive AND have not been seen since
   * `cutoffDate`.  These are tokens that Firebase already rejected and that
   * the user has not re-registered (e.g. they switched phones).
   *
   * Threshold recommendation: 30 days — long enough for users to come back
   * from a vacation without losing their push registration.
   *
   * @returns Number of rows deleted.
   */
  async deleteStaleInactive(cutoffDate: Date): Promise<number> {
    const result = await this.db
      .delete(deviceTokens)
      .where(
        and(
          eq(deviceTokens.isActive, false),
          lt(deviceTokens.lastSeenAt, cutoffDate),
        ),
      )
      .returning({ id: deviceTokens.id });

    return result.length;
  }

  /**
   * Permanently delete tokens that are technically active but have not been
   * seen for a very long time — indicating the user uninstalled the app
   * without explicitly deregistering the token.
   *
   * Threshold recommendation: 90 days — seasonal users (e.g. tourists) may
   * go months between visits, so a generous window avoids false positives.
   *
   * @returns Number of rows deleted.
   */
  async deleteStaleActive(cutoffDate: Date): Promise<number> {
    const result = await this.db
      .delete(deviceTokens)
      .where(
        and(
          eq(deviceTokens.isActive, true),
          lt(deviceTokens.lastSeenAt, cutoffDate),
        ),
      )
      .returning({ id: deviceTokens.id });

    return result.length;
  }
}
