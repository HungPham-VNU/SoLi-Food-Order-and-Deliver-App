import { Injectable, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { RestaurantUpdatedEvent } from '@/shared/events/restaurant-updated.event';
import { NotificationRestaurantAclRepository } from './notification-restaurant-acl.repository';

/**
 * NotificationRestaurantSnapshotProjector
 *
 * Listens for RestaurantUpdatedEvent from the RestaurantCatalog BC and upserts
 * the local ACL read-model in `notification_restaurant_snapshots`.
 *
 * The Notification BC only needs { restaurantId, ownerId, name } — just enough
 * to resolve the restaurant owner for routing and for template data.
 *
 * Design:
 *  - Idempotent: ON CONFLICT (restaurant_id) DO UPDATE — safe to replay events.
 *  - No re-throw: this is a downstream observer; failures must NOT cascade to
 *    upstream (unlike the Ordering BC projector which re-throws for visibility).
 *    Instead, errors are logged at ERROR level — an alert can be wired on these.
 *  - Multiple `@EventsHandler` registrations for the same event class are valid
 *    NestJS CQRS behaviour (fan-out). Both this class and
 *    RestaurantSnapshotProjector (Ordering BC) handle RestaurantUpdatedEvent.
 *
 * Phase: N-1 — Foundation / ACL Layer
 */
@Injectable()
@EventsHandler(RestaurantUpdatedEvent)
export class NotificationRestaurantSnapshotProjector
  implements IEventHandler<RestaurantUpdatedEvent>
{
  private readonly logger = new Logger(
    NotificationRestaurantSnapshotProjector.name,
  );

  constructor(
    private readonly restaurantAclRepo: NotificationRestaurantAclRepository,
  ) {}

  async handle(event: RestaurantUpdatedEvent): Promise<void> {
    const { restaurantId, name, ownerId } = event;

    this.logger.debug(
      `[ACL] Received RestaurantUpdatedEvent for restaurant ${restaurantId}`,
    );

    try {
      await this.restaurantAclRepo.upsert({
        restaurantId,
        ownerId,
        name,
        lastSyncedAt: new Date(),
      });
      this.logger.debug(
        `[ACL] Restaurant snapshot upserted: ${restaurantId} → owner=${ownerId}`,
      );
    } catch (err) {
      // Do NOT re-throw: this is a downstream projection, not a business-critical
      // synchronous operation. A failure here does not affect order creation.
      this.logger.error(
        `[ACL] Failed to upsert restaurant snapshot ${restaurantId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }
}
