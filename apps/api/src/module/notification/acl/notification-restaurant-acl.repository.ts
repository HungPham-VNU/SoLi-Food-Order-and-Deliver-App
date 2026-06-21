import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import {
  notificationRestaurantSnapshots,
  type NewNotificationRestaurantSnapshot,
  type NotificationRestaurantSnapshot,
} from './notification-restaurant-snapshot.schema';

/**
 * NotificationRestaurantAclRepository
 *
 * Read/write access to `notification_restaurant_snapshots` — the Notification
 * BC's local projection of RestaurantUpdatedEvents (populated by
 * NotificationRestaurantSnapshotProjector, Phase N-1).
 *
 * Purpose: Resolves restaurantId → { ownerId, name } without querying
 * the RestaurantCatalog BC's tables (anti-corruption layer pattern).
 *
 * Phase: N-1 — Foundation
 */
@Injectable()
export class NotificationRestaurantAclRepository {
  constructor(@Inject(DB_CONNECTION) private readonly db: NodePgDatabase) {}

  /**
   * Find snapshot by restaurantId.
   * Returns null when the restaurant has never emitted a RestaurantUpdatedEvent
   * (e.g. very new restaurants or events not yet consumed).
   */
  async findByRestaurantId(
    restaurantId: string,
  ): Promise<NotificationRestaurantSnapshot | null> {
    const result = await this.db
      .select()
      .from(notificationRestaurantSnapshots)
      .where(eq(notificationRestaurantSnapshots.restaurantId, restaurantId))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Idempotent upsert.
   * ON CONFLICT (restaurant_id) DO UPDATE ensures convergence even under
   * duplicate RestaurantUpdatedEvents (at-least-once delivery guarantee).
   */
  async upsert(data: NewNotificationRestaurantSnapshot): Promise<void> {
    await this.db
      .insert(notificationRestaurantSnapshots)
      .values(data)
      .onConflictDoUpdate({
        target: notificationRestaurantSnapshots.restaurantId,
        set: {
          ownerId: data.ownerId,
          name: data.name,
          lastSyncedAt: data.lastSyncedAt ?? new Date(),
        },
      });
  }
}
