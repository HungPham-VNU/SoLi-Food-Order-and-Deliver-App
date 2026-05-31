import { Injectable, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { ReviewSubmittedEvent } from '@/shared/events/review-submitted.event';
import { NotificationRestaurantAclRepository } from '../acl/notification-restaurant-acl.repository';
import { NotificationService } from '../services/notification.service';

/**
 * ReviewSubmittedNotificationHandler
 *
 * Listens for ReviewSubmittedEvent and dispatches a `new_review` notification
 * to the restaurant owner (in_app + push channels).
 *
 * Follows the exact pattern of OrderPlacedNotificationHandler:
 *  - Resolves the restaurant owner's userId via the local ACL snapshot.
 *  - Skips with a warning when the snapshot is missing.
 *  - Never rethrows from handle() — CQRS EventBus constraint.
 *
 * Phase: RV-3
 */
@Injectable()
@EventsHandler(ReviewSubmittedEvent)
export class ReviewSubmittedNotificationHandler implements IEventHandler<ReviewSubmittedEvent> {
  private readonly logger = new Logger(ReviewSubmittedNotificationHandler.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly restaurantAclRepo: NotificationRestaurantAclRepository,
  ) {}

  async handle(event: ReviewSubmittedEvent): Promise<void> {
    this.logger.log(
      `ReviewSubmittedEvent received: reviewId=${event.reviewId} restaurantId=${event.restaurantId} stars=${event.stars}`,
    );
    try {
      await this.processNotifications(event);
    } catch (err) {
      this.logger.error(
        `ReviewSubmittedNotificationHandler failed for reviewId=${event.reviewId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  private async processNotifications(
    event: ReviewSubmittedEvent,
  ): Promise<void> {
    const snapshot = await this.restaurantAclRepo.findByRestaurantId(
      event.restaurantId,
    );

    if (!snapshot) {
      this.logger.warn(
        `[ReviewSubmittedNotificationHandler] No ACL snapshot for restaurantId=${event.restaurantId} — owner notification skipped. ` +
          `Snapshot will be available after the next RestaurantUpdatedEvent.`,
      );
      return;
    }

    await this.notificationService.sendFromEvent({
      type: 'new_review',
      recipientId: snapshot.ownerId,
      recipientRole: 'restaurant',
      // Idempotency key source: notif:new_review:{reviewId}:{ownerId}:{channel}
      sourceId: event.reviewId,
      templateData: {
        orderId: event.orderId,
        restaurantName: snapshot.name,
        stars: String(event.stars),
      },
      channels: ['in_app', 'push'],
      orderId: event.orderId,
    });
  }
}
