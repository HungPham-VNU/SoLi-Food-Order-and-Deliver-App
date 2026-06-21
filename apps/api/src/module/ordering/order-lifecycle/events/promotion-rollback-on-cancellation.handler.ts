import { Injectable, Inject, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { OrderStatusChangedEvent } from '@/shared/events/order-status-changed.event';
import {
  PROMOTION_APPLICATION_PORT,
  type IPromotionApplicationPort,
} from '@/shared/ports/promotion-application.port';

/**
 * PromotionRollbackOnCancellationHandler
 *
 * Consumed by: Ordering BC (OrderLifecycleModule)
 * Source:      TransitionOrderHandler publishes OrderStatusChangedEvent on
 *              every state transition.
 *
 * Rolls back reserved or confirmed promotion usages when an order
 * transitions to a terminal cancellation state.
 *
 * Design:
 *  - Uses PROMOTION_APPLICATION_PORT (DIP) — never imports PromotionService
 *    directly, preserving Bounded Context isolation.
 *  - OrderLifecycleModule imports PromotionModule explicitly for this port.
 *  - rollbackReservations() is idempotent: only rows with status IN
 *    ('reserved', 'confirmed') are updated. Already-rolled-back rows are
 *    skipped, making repeated calls safe (e.g. under event replay).
 *  - Errors are swallowed inside rollbackReservations() — promotion rollback
 *    failure must never block order cancellation processing.
 *
 * Targeted states:
 *  - 'cancelled' — customer cancel (T-03), restaurant cancel (T-05),
 *                  order confirmation timeout (T-07), payment failure (T-06).
 *  - 'refunded'  — delivered order refunded by admin (T-12).
 *
 * Phase: PR-3 — Ordering Integration (Checkout)
 */
@Injectable()
@EventsHandler(OrderStatusChangedEvent)
export class PromotionRollbackOnCancellationHandler implements IEventHandler<OrderStatusChangedEvent> {
  private readonly logger = new Logger(
    PromotionRollbackOnCancellationHandler.name,
  );

  constructor(
    @Inject(PROMOTION_APPLICATION_PORT)
    private readonly promotionPort: IPromotionApplicationPort,
  ) {}

  async handle(event: OrderStatusChangedEvent): Promise<void> {
    // Only roll back on terminal cancellation / refund transitions.
    if (event.toStatus !== 'cancelled' && event.toStatus !== 'refunded') {
      return;
    }

    this.logger.log(
      `Order ${event.orderId} → '${event.toStatus}': rolling back promotion reservations.`,
    );

    // Idempotent and error-swallowing internally — safe to call without try/catch.
    await this.promotionPort.rollbackReservations(event.orderId);
  }
}
