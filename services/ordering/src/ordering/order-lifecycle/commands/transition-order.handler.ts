import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
  Inject,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  createEnvelope,
  ORDER_STATUS_CHANGED_V1,
  ORDER_READY_FOR_PICKUP_V1,
  ORDER_CANCELLED_AFTER_PAYMENT_V1,
} from '@uitfood/contracts';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import { OutboxWriter } from '@/messaging/outbox/outbox.writer';
import { orders, orderStatusLogs, type Order } from '../../order/order.schema';
import { TransitionOrderCommand } from './transition-order.command';
import { OrderRepository } from '../repositories/order.repository';
import { OrderLifecycleService } from '../services/order-lifecycle.service';
import { RestaurantSnapshotRepository } from '../../acl/repositories/restaurant-snapshot.repository';
import { TRANSITIONS, type TransitionRule } from '../constants/transitions';
import { runObserved } from '@/observability/trace';

/**
 * TransitionOrderHandler
 *
 * Core of Phase 5: validates a requested state transition, enforces permissions
 * and ownership, persists the change atomically with an audit log entry, and
 * publishes domain events after the DB transaction commits.
 *
 * Architecture decisions:
 *  D1-C  Hybrid CQRS — single handler for all lifecycle transitions.
 *  D6-A  Hand-crafted TRANSITIONS map — no XState.
 *  Optimistic locking via `version` column guards concurrent race conditions
 *  (e.g., two shippers simultaneously claiming T-09).
 *  Events are published AFTER the DB commit so downstream consumers always
 *  see consistent data when they query the DB.
 *
 * Phase: 5
 */
@Injectable()
@CommandHandler(TransitionOrderCommand)
export class TransitionOrderHandler implements ICommandHandler<TransitionOrderCommand> {
  private readonly logger = new Logger(TransitionOrderHandler.name);

  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase,
    private readonly orderRepo: OrderRepository,
    private readonly lifecycleService: OrderLifecycleService,
    private readonly restaurantSnapshotRepo: RestaurantSnapshotRepository,
    private readonly outbox: OutboxWriter,
  ) {}

  async execute(cmd: TransitionOrderCommand): Promise<Order> {
    return runObserved(
      'order.status_update',
      {
        orderId: cmd.orderId,
        toStatus: cmd.toStatus,
        actorRole: cmd.actorRole,
      },
      () => this.executeTransition(cmd),
    );
  }

  private async executeTransition(cmd: TransitionOrderCommand): Promise<Order> {
    const { orderId, toStatus, actorId, actorRole, note, cancellationReason } =
      cmd;

    // -------------------------------------------------------------------------
    // 1. Load order
    // -------------------------------------------------------------------------
    const order = await this.orderRepo.findById(orderId);
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found.`);
    }

    // -------------------------------------------------------------------------
    // 2. Idempotency — already in target state (safe for system-triggered commands)
    // -------------------------------------------------------------------------
    if (order.status === toStatus) {
      return order;
    }

    // -------------------------------------------------------------------------
    // 3. Validate transition exists in the TRANSITIONS map
    // -------------------------------------------------------------------------
    const transitionKey = `${order.status}→${toStatus}`;
    const rule = TRANSITIONS[transitionKey] as TransitionRule | undefined;
    if (!rule) {
      throw new UnprocessableEntityException(
        `Cannot transition order from '${order.status}' to '${toStatus}'.`,
      );
    }

    // -------------------------------------------------------------------------
    // 4. Check actor role is permitted for this transition
    // -------------------------------------------------------------------------
    if (!rule.allowedRoles.includes(actorRole)) {
      throw new ForbiddenException(
        `Role '${actorRole}' cannot perform the '${order.status}→${toStatus}' transition.`,
      );
    }

    // -------------------------------------------------------------------------
    // 5. Ownership check (delegated to OrderLifecycleService)
    // -------------------------------------------------------------------------
    await this.lifecycleService.assertOwnership(order, actorId, actorRole);

    // -------------------------------------------------------------------------
    // 5b. Shipper T-10/T-11 ownership: assigned shipper must match
    //     (T-09 is self-assign, so no check needed there)
    // -------------------------------------------------------------------------
    if (
      actorRole === 'shipper' &&
      (order.status === 'picked_up' || order.status === 'delivering')
    ) {
      if (order.shipperId !== actorId) {
        throw new ForbiddenException(
          'Only the assigned shipper can advance this order.',
        );
      }
    }

    // -------------------------------------------------------------------------
    // 6. T-01 precondition: COD-only direct confirmation.
    //    VNPay orders must first be advanced to `paid` by PaymentConfirmedEvent,
    //    which is only published after VNPay IPN confirms successful payment.
    // -------------------------------------------------------------------------
    if (order.status === 'pending' && toStatus === 'confirmed') {
      if (order.paymentMethod !== 'cod') {
        throw new UnprocessableEntityException(
          'VNPay orders cannot be confirmed before payment is confirmed. ' +
            'Wait for PaymentConfirmedEvent to advance the order to `paid` first.',
        );
      }
    }

    // -------------------------------------------------------------------------
    // 7. Note requirement (cancel / refund transitions)
    // -------------------------------------------------------------------------
    if (rule.requireNote && !note?.trim()) {
      throw new BadRequestException(
        'A reason note is required for this transition.',
      );
    }

    // -------------------------------------------------------------------------
    // 8a. For T-08, load the restaurant snapshot BEFORE the transaction so the
    //     ready-for-pickup event payload can be built inside it.
    // -------------------------------------------------------------------------
    const readySnapshot = rule.triggersReadyForPickup
      ? await this.restaurantSnapshotRepo.findById(order.restaurantId)
      : null;
    if (rule.triggersReadyForPickup && !readySnapshot) {
      this.logger.warn(
        `OrderReadyForPickup outbox event skipped for order ${order.id}: ` +
          `restaurant snapshot ${order.restaurantId} not found.`,
      );
    }

    const refundSuppressedForShipper =
      rule.triggersRefundIfVnpay &&
      order.paymentMethod === 'vnpay' &&
      actorRole === 'shipper';
    if (refundSuppressedForShipper) {
      this.logger.error(
        `Unexpected actor role 'shipper' on refund-triggering transition ` +
          `${order.status}→${toStatus} for order ${orderId}. Refund event suppressed.`,
      );
    }

    // -------------------------------------------------------------------------
    // 8b. DB transaction — atomic status update + status log + outbox events.
    //     The status change and ALL its domain events commit together, so a
    //     crash can never leave a transition without its events (and vice versa).
    // -------------------------------------------------------------------------
    const now = new Date();
    const newVersion = order.version + 1;

    const updatedOrder = await this.db.transaction(async (tx) => {
      const setClause: Partial<Order> = {
        status: toStatus,
        version: newVersion,
        updatedAt: now,
      };

      // T-09: record the actor who picked up the order.
      if (order.status === 'ready_for_pickup' && toStatus === 'picked_up') {
        setClause.shipperId = actorId!;
      }

      // Optimistic locking: update only if version hasn't changed since we read
      const result = await tx
        .update(orders)
        .set(setClause)
        .where(and(eq(orders.id, orderId), eq(orders.version, order.version)))
        .returning();

      if (result.length === 0) {
        throw new ConflictException(
          'Order was modified concurrently. Please refresh and retry.',
        );
      }

      const resolvedReason =
        cancellationReason ??
        (toStatus === 'cancelled' || toStatus === 'refunded' ? 'other' : null);

      await tx.insert(orderStatusLogs).values({
        orderId,
        fromStatus: order.status,
        toStatus,
        triggeredBy: actorId ?? null,
        triggeredByRole: actorRole,
        note: note ?? null,
        cancellationReason: resolvedReason,
      });

      // --- Outbox events (atomic with the transition) ---
      await this.outbox.write(
        tx,
        createEnvelope({
          eventType: ORDER_STATUS_CHANGED_V1.eventType,
          eventVersion: ORDER_STATUS_CHANGED_V1.eventVersion,
          aggregateId: orderId,
          aggregateVersion: newVersion,
          producer: 'monolith',
          payload: {
            orderId,
            customerId: order.customerId,
            restaurantId: order.restaurantId,
            fromStatus: order.status,
            toStatus,
            actorRole,
            note: note ?? null,
            changedAt: now.toISOString(),
          },
        }),
      );

      if (rule.triggersReadyForPickup && readySnapshot) {
        await this.outbox.write(
          tx,
          createEnvelope({
            eventType: ORDER_READY_FOR_PICKUP_V1.eventType,
            eventVersion: ORDER_READY_FOR_PICKUP_V1.eventVersion,
            aggregateId: orderId,
            aggregateVersion: newVersion,
            producer: 'monolith',
            payload: {
              orderId,
              restaurantId: order.restaurantId,
              restaurantName: readySnapshot.name,
              restaurantAddress: readySnapshot.address,
              customerId: order.customerId,
              deliveryAddress: order.deliveryAddress,
              readyAt: now.toISOString(),
            },
          }),
        );
      }

      if (
        rule.triggersRefundIfVnpay &&
        order.paymentMethod === 'vnpay' &&
        !refundSuppressedForShipper
      ) {
        await this.outbox.write(
          tx,
          createEnvelope({
            eventType: ORDER_CANCELLED_AFTER_PAYMENT_V1.eventType,
            eventVersion: ORDER_CANCELLED_AFTER_PAYMENT_V1.eventVersion,
            aggregateId: orderId,
            aggregateVersion: newVersion,
            producer: 'monolith',
            payload: {
              orderId,
              customerId: order.customerId,
              paymentMethod: 'vnpay',
              paidAmount: order.totalAmount,
              cancelledByRole: actorRole,
              cancelledAt: now.toISOString(),
            },
          }),
        );
      }

      return result[0];
    });

    return updatedOrder;
  }
}
