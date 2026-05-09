import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import * as schema from '@/drizzle/schema';
import { user } from '@/module/auth/auth.schema';

/**
 * UserEmailRepository
 *
 * Read-only lookup of a user's verified email from the Better Auth `user`
 * table. Used by NotificationService as a fallback when
 * `notification_preferences.email` is null (i.e. the user has never
 * explicitly set their notification email via the preferences API).
 *
 * Architecture note: querying the `user` table (owned by IAM / Better Auth)
 * from the Notification BC is acceptable in a modular monolith — they share
 * the same database and this is a read-only denormalisation fallback. If the
 * Notification BC were extracted as a microservice, this lookup would be
 * replaced with a UserProfileUpdatedEvent subscription.
 *
 * Phase: N-6 — Email Delivery Fix (recipient resolution fallback)
 */
@Injectable()
export class UserEmailRepository {
  private readonly logger = new Logger(UserEmailRepository.name);

  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Resolve the email address for a given user ID.
   * Returns null when the user does not exist (should not happen in normal
   * operation — IDs come from authenticated event payloads).
   */
  async findEmailByUserId(userId: string): Promise<string | null> {
    try {
      const result = await this.db
        .select({ email: user.email })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
      return result[0]?.email ?? null;
    } catch (err) {
      this.logger.warn(
        `[UserEmailRepo] Failed to look up email for userId=${userId}: ${(err as Error).message}`,
      );
      return null;
    }
  }
}
