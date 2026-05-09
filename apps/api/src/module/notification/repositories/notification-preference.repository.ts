import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import * as schema from '@/drizzle/schema';
import {
  notificationPreferences,
  type NewNotificationPreference,
  type NotificationPreference,
} from '../domain/notification-preference.schema';

/**
 * NotificationPreferenceRepository
 *
 * Read/write access to `notification_preferences`.
 * One row per user. Rows are created lazily on first preference update.
 *
 * Phase: N-1 — Foundation
 */
@Injectable()
export class NotificationPreferenceRepository {
  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Find preference row for a user.
   * Returns null when no explicit preferences exist — callers should fall back
   * to DEFAULT_PREFERENCES (from notification-preference.schema.ts).
   */
  async findByUserId(userId: string): Promise<NotificationPreference | null> {
    const result = await this.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Upsert user preferences.
   * ON CONFLICT (user_id) DO UPDATE: safe to call repeatedly (idempotent).
   */
  async upsert(data: NewNotificationPreference): Promise<NotificationPreference> {
    const result = await this.db
      .insert(notificationPreferences)
      .values(data)
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: {
          pushEnabled: data.pushEnabled,
          inAppEnabled: data.inAppEnabled,
          emailEnabled: data.emailEnabled,
          smsEnabled: data.smsEnabled,
          quietHoursStart: data.quietHoursStart,
          quietHoursEnd: data.quietHoursEnd,
          mutedTypes: data.mutedTypes,
          email: data.email,
          timezone: data.timezone,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  }
}
