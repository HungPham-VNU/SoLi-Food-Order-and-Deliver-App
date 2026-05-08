import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import * as schema from '@/drizzle/schema';
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
  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

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
        and(
          eq(deviceTokens.userId, userId),
          eq(deviceTokens.isActive, true),
        ),
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
        and(
          eq(deviceTokens.userId, userId),
          eq(deviceTokens.token, token),
        ),
      );
  }
}
