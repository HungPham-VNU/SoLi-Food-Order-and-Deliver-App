import {
  Injectable,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import { orders } from '../order/order.schema';
import type { IOrderEligibilityPort } from '@/shared/ports/order-eligibility.port';
import type { UnitOfWorkContext } from '@/shared/ports/unit-of-work-context';

/**
 * OrderEligibilityAdapter
 *
 * Ordering BC's concrete implementation of IOrderEligibilityPort.
 *
 * Reads from the Ordering BC's own `orders` table (via the shared schema
 * barrel) and enforces ownership / status preconditions required by UC-22.
 *
 * Architecture (ADR-007 — Ports and Adapters):
 *   - This class lives inside the Ordering BC and is provided by
 *     OrderEligibilityModule using the ORDER_ELIGIBILITY_PORT DI token.
 *   - Consumers (e.g. Review BC) depend on the port interface only; they
 *     never import this class directly.
 *   - Pattern mirrors PaymentService → PAYMENT_INITIATION_PORT.
 *
 * Phase: RV-2 (architecture hardening)
 */
@Injectable()
export class OrderEligibilityAdapter implements IOrderEligibilityPort {
  constructor(@Inject(DB_CONNECTION) private readonly db: NodePgDatabase) {}

  async checkEligibility(
    orderId: string,
    customerId: string,
  ): Promise<{ restaurantId: string }> {
    const rows = await this.db
      .select({
        id: orders.id,
        customerId: orders.customerId,
        restaurantId: orders.restaurantId,
        status: orders.status,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (rows.length === 0) {
      // MSG-HIST-01 — order not found
      throw new NotFoundException('Order not found.');
    }

    const order = rows[0];

    // BR-22.4 / BR-22.5 — return 404 (not 403) so callers cannot infer
    // order existence from the response code (information-leak prevention).
    // Mirrors the pattern in OrderHistoryService.
    if (order.customerId !== customerId) {
      throw new NotFoundException('Order not found.');
    }

    // BR-22.6 / BR-22.7 — order must be completed (ready for pickup or delivered)
    // NOTE: shipper transitions (pickup, en-route, deliver) are not yet available,
    // so all post-confirmation statuses are considered reviewable for now.
    const REVIEWABLE_STATUSES = [
      'ready_for_pickup',
      'picked_up',
      'delivering',
      'delivered',
    ];
    if (!REVIEWABLE_STATUSES.includes(order.status)) {
      throw new UnprocessableEntityException({
        message: 'You can only review an order that has been completed.',
        code: 'MSG-RATE-02',
      });
    }

    return { restaurantId: order.restaurantId };
  }

  async markReviewed(
    orderId: string,
    context?: UnitOfWorkContext,
  ): Promise<void> {
    const database =
      (context?.transaction as NodePgDatabase | undefined) ?? this.db;
    await database
      .update(orders)
      .set({ reviewedAt: new Date(), updatedAt: new Date() })
      .where(eq(orders.id, orderId));
  }
}
