import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import { type IUserDirectoryPort } from '@/shared/ports/user-directory.port';
import { user } from './auth.schema';

@Injectable()
export class UserDirectoryAdapter implements IUserDirectoryPort {
  private readonly logger = new Logger(UserDirectoryAdapter.name);

  constructor(@Inject(DB_CONNECTION) private readonly db: NodePgDatabase) {}

  async findEmail(userId: string): Promise<string | null> {
    try {
      const rows = await this.db
        .select({ email: user.email })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
      return rows[0]?.email ?? null;
    } catch (error) {
      this.logger.warn(
        `Failed to look up email for userId=${userId}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  async promoteToRestaurant(userId: string): Promise<void> {
    await this.db
      .update(user)
      .set({ role: 'restaurant' })
      .where(and(eq(user.id, userId), eq(user.role, 'user')));
  }
}
