import { Injectable, Inject } from '@nestjs/common';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ORDERING_DATABASE } from '@/drizzle/database.constants';
import {
  USER_DIRECTORY_PORT,
  type IUserDirectoryPort,
} from '@/shared/ports/user-directory.port';
import {
  orders,
  orderItems,
  orderStatusLogs,
  type Order,
  type OrderItem,
  type OrderStatusLog,
} from '../../order/order.schema';

export type OrderCustomerContact = {
  customerId: string;
  name: string;
  phone: string | null;
};

/**
 * OrderRepository — Phase 5 read model for the order lifecycle.
 *
 * Responsibilities:
 *  - Load individual orders for transition validation.
 *  - Find expired pending/paid orders for the timeout cron.
 *  - Read order items and status log for the GET endpoints.
 *
 * Write path (status updates) lives entirely in TransitionOrderHandler
 * inside DB transactions — not here — to keep atomic guarantees explicit.
 */
@Injectable()
export class OrderRepository {
  constructor(
    @Inject(ORDERING_DATABASE) private readonly db: NodePgDatabase,
    @Inject(USER_DIRECTORY_PORT)
    private readonly userDirectory: IUserDirectoryPort,
  ) {}

  /**
   * Load a single order by primary key.
   * Returns null when the order does not exist.
   */
  async findById(orderId: string): Promise<Order | null> {
    const result = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Find all orders in `pending` or `paid` state whose `expires_at` has passed.
   * Used by OrderTimeoutTask every minute to auto-cancel stale orders.
   *
   * SQL: WHERE status IN ('pending', 'paid') AND expires_at < NOW()
   */
  async findExpiredPendingOrPaid(): Promise<Order[]> {
    return this.db
      .select()
      .from(orders)
      .where(
        and(
          inArray(orders.status, ['pending', 'paid']),
          lt(orders.expiresAt, sql`NOW()`),
        ),
      );
  }

  /**
   * Load an order with its line items.
   * Used by GET /orders/:id.
   */
  async findWithItems(
    orderId: string,
  ): Promise<{ order: Order; items: OrderItem[] } | null> {
    const order = await this.findById(orderId);
    if (!order) return null;

    const items = await this.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    return { order, items };
  }

  async findWithItemsAndCustomer(orderId: string): Promise<{
    order: Order;
    items: OrderItem[];
    customer: OrderCustomerContact | null;
  } | null> {
    const detail = await this.findWithItems(orderId);
    if (!detail) return null;

    const contact = await this.userDirectory.findContact(
      detail.order.customerId,
    );

    return {
      ...detail,
      customer: contact
        ? {
            customerId: contact.id,
            name: contact.name,
            phone: contact.phoneNumber,
          }
        : null,
    };
  }

  /**
   * Load the full audit trail for an order.
   * Used by GET /orders/:id/timeline.
   * Ordered oldest-first so callers see the progression in chronological order.
   */
  async findTimeline(orderId: string): Promise<OrderStatusLog[]> {
    return this.db
      .select()
      .from(orderStatusLogs)
      .where(eq(orderStatusLogs.orderId, orderId))
      .orderBy(orderStatusLogs.createdAt);
  }
}
