import {
  Injectable,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import * as schema from '@/drizzle/schema';
import type { IOrderEligibilityPort } from '@/shared/ports/order-eligibility.port';

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
  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async checkEligibility(
    orderId: string,
    customerId: string,
  ): Promise<{ restaurantId: string }> {
    const rows = await this.db
      .select({
        id: schema.orders.id,
        customerId: schema.orders.customerId,
        restaurantId: schema.orders.restaurantId,
        status: schema.orders.status,
      })
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
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

    // BR-22.6 / BR-22.7 — only delivered orders are reviewable
    if (order.status !== 'delivered') {
      throw new UnprocessableEntityException({
        message: 'You can only review an order that has been delivered.',
        code: 'MSG-RATE-02',
      });
    }

    return { restaurantId: order.restaurantId };
  }
}
