/**
 * transition-order.handler.spec.ts
 *
 * Unit tests for TransitionOrderHandler — the core of the order state machine.
 *
 * Covers (one assertion family per `it`):
 *  §1 Order not found → NotFoundException
 *  §2 Idempotent same-status → returns order, no DB writes
 *  §3 Invalid transition (no entry in TRANSITIONS) → UnprocessableEntityException
 *  §4 Role not in allowedRoles → ForbiddenException
 *  §5 T-01 restaurant + VNPay order → UnprocessableEntityException
 *  §6 requireNote = true and note absent → BadRequestException
 *  §7 Shipper attempts T-10 with mismatched shipperId → ForbiddenException
 *  §8 Optimistic-lock conflict (DB returns 0 rows) → ConflictException
 *  §9 Happy path → updates order, logs status, publishes OrderStatusChangedEvent
 *  §10 T-08 publishes OrderReadyForPickupEvent when snapshot present
 *  §11 T-08 skips ready event when snapshot missing (does not throw)
 *  §12 T-05 with VNPay order publishes OrderCancelledAfterPaymentEvent
 *  §13 T-09 self-assign writes shipperId in update
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { TransitionOrderHandler } from './transition-order.handler';
import { TransitionOrderCommand } from './transition-order.command';
import type { Order } from '../../order/order.schema';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@/drizzle/schema';
import type { OrderRepository } from '../repositories/order.repository';
import type { OrderLifecycleService } from '../services/order-lifecycle.service';
import type { RestaurantSnapshotRepository } from '../../acl/repositories/restaurant-snapshot.repository';
import type { OutboxWriter } from '@/messaging/outbox/outbox.writer';

type Mocked<T> = { [K in keyof T]: jest.Mock };

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord-1',
    customerId: 'cust-1',
    restaurantId: 'rest-1',
    restaurantName: 'X',
    cartId: 'cart-1',
    status: 'pending',
    totalAmount: 100_000,
    shippingFee: 0,
    discountAmount: 0,
    estimatedDeliveryMinutes: null,
    paymentMethod: 'cod',
    deliveryAddress: {},
    note: null,
    paymentUrl: null,
    expiresAt: null,
    version: 0,
    shipperId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as Order;
}

/**
 * Builds a mock Drizzle DB whose `transaction(cb)` invokes the callback with a
 * tx object exposing chainable `update().set().where().returning()` returning
 * `txResult` and an `insert().values()` no-op.
 */
function makeMockDb(opts: { txResult: Order[] }): {
  db: { transaction: jest.Mock };
  updateSet: jest.Mock;
  insertValues: jest.Mock;
} {
  const returning = jest.fn().mockResolvedValue(opts.txResult);
  const where = jest.fn().mockReturnValue({ returning });
  const updateSet = jest.fn().mockReturnValue({ where });
  const update = jest.fn().mockReturnValue({ set: updateSet });
  const insertValues = jest.fn().mockResolvedValue(undefined);
  const insert = jest.fn().mockReturnValue({ values: insertValues });
  const tx = { update, insert };
  const db = {
    transaction: jest.fn(async (cb: (t: typeof tx) => Promise<Order>) =>
      cb(tx),
    ),
  };
  return { db, updateSet, insertValues };
}

describe('TransitionOrderHandler', () => {
  let orderRepo: Mocked<{ findById: jest.Mock }>;
  let lifecycle: Mocked<{ assertOwnership: jest.Mock }>;
  let snapshotRepo: Mocked<{ findById: jest.Mock }>;
  let outbox: { write: jest.Mock };

  beforeEach(() => {
    orderRepo = { findById: jest.fn() };
    lifecycle = { assertOwnership: jest.fn().mockResolvedValue(undefined) };
    snapshotRepo = { findById: jest.fn() };
    outbox = { write: jest.fn().mockResolvedValue(undefined) };
  });

  function buildHandler(db: unknown): TransitionOrderHandler {
    return new TransitionOrderHandler(
      db as NodePgDatabase<typeof schema>,
      orderRepo as unknown as OrderRepository,
      lifecycle as unknown as OrderLifecycleService,
      snapshotRepo as unknown as RestaurantSnapshotRepository,
      outbox as unknown as OutboxWriter,
    );
  }

  it('§1 throws NotFoundException when order is missing', async () => {
    orderRepo.findById.mockResolvedValue(null);
    const handler = buildHandler({});
    await expect(
      handler.execute(
        new TransitionOrderCommand('ord-1', 'confirmed', 'usr', 'restaurant'),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('§2 returns same order on idempotent same-status transition', async () => {
    const order = makeOrder({ status: 'confirmed' });
    orderRepo.findById.mockResolvedValue(order);
    const { db, updateSet } = makeMockDb({ txResult: [] });
    const handler = buildHandler(db);
    const result = await handler.execute(
      new TransitionOrderCommand('ord-1', 'confirmed', 'usr', 'restaurant'),
    );
    expect(result).toBe(order);
    expect(updateSet).not.toHaveBeenCalled();
    expect(outbox.write).not.toHaveBeenCalled();
  });

  it('§3 throws UnprocessableEntity when transition not in TRANSITIONS', async () => {
    orderRepo.findById.mockResolvedValue(makeOrder({ status: 'cancelled' }));
    const handler = buildHandler({});
    await expect(
      handler.execute(
        new TransitionOrderCommand('ord-1', 'delivered', 'usr', 'admin'),
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('§4 throws Forbidden when actor role not in allowedRoles', async () => {
    orderRepo.findById.mockResolvedValue(makeOrder({ status: 'pending' }));
    const handler = buildHandler({});
    // 'pending→paid' allows only 'system'; restaurant must be rejected
    await expect(
      handler.execute(
        new TransitionOrderCommand('ord-1', 'paid', 'usr', 'restaurant'),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('§5 restaurant + VNPay T-01 → UnprocessableEntity', async () => {
    orderRepo.findById.mockResolvedValue(
      makeOrder({ status: 'pending', paymentMethod: 'vnpay' }),
    );
    const handler = buildHandler({});
    await expect(
      handler.execute(
        new TransitionOrderCommand('ord-1', 'confirmed', 'usr', 'restaurant'),
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('§6 requireNote transition without note → BadRequest', async () => {
    orderRepo.findById.mockResolvedValue(makeOrder({ status: 'pending' }));
    const handler = buildHandler({});
    await expect(
      handler.execute(
        new TransitionOrderCommand('ord-1', 'cancelled', 'usr', 'admin'),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('§7 shipper T-10 with mismatched shipperId → Forbidden', async () => {
    orderRepo.findById.mockResolvedValue(
      makeOrder({ status: 'picked_up', shipperId: 'shp-A' }),
    );
    const handler = buildHandler({});
    await expect(
      handler.execute(
        new TransitionOrderCommand('ord-1', 'delivering', 'shp-B', 'shipper'),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('§8 optimistic-lock conflict → ConflictException', async () => {
    orderRepo.findById.mockResolvedValue(makeOrder({ status: 'pending' }));
    const { db } = makeMockDb({ txResult: [] }); // empty = version mismatch
    const handler = buildHandler(db);
    await expect(
      handler.execute(
        new TransitionOrderCommand('ord-1', 'confirmed', 'usr', 'restaurant'),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('§9 happy path: updates DB, logs status, publishes OrderStatusChangedEvent', async () => {
    const order = makeOrder({ status: 'pending', version: 3 });
    const updated = { ...order, status: 'confirmed', version: 4 };
    orderRepo.findById.mockResolvedValue(order);
    const { db, updateSet, insertValues } = makeMockDb({
      txResult: [updated],
    });
    const handler = buildHandler(db);

    const result = await handler.execute(
      new TransitionOrderCommand('ord-1', 'confirmed', 'usr', 'restaurant'),
    );

    expect(result).toEqual(updated);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'confirmed', version: 4 }),
    );
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'ord-1',
        fromStatus: 'pending',
        toStatus: 'confirmed',
        triggeredBy: 'usr',
        triggeredByRole: 'restaurant',
      }),
    );
    expect(outbox.write).toHaveBeenCalledTimes(1);
    const [, envelope] = outbox.write.mock.calls[0] as [
      unknown,
      { eventType: string; payload: Record<string, unknown> },
    ];
    expect(envelope.payload).toEqual(
      expect.objectContaining({
        orderId: 'ord-1',
        fromStatus: 'pending',
        toStatus: 'confirmed',
        actorRole: 'restaurant',
      }),
    );
  });

  it('§10 T-08 publishes OrderReadyForPickupEvent when snapshot present', async () => {
    const order = makeOrder({ status: 'preparing' });
    const updated = { ...order, status: 'ready_for_pickup' };
    orderRepo.findById.mockResolvedValue(order);
    snapshotRepo.findById.mockResolvedValue({
      name: 'Sunset Bistro',
      address: '123 Main',
    });
    const { db } = makeMockDb({ txResult: [updated] });
    const handler = buildHandler(db);

    await handler.execute(
      new TransitionOrderCommand(
        'ord-1',
        'ready_for_pickup',
        'usr',
        'restaurant',
      ),
    );

    // 2 outbox events: order-status-changed + order-ready-for-pickup
    expect(outbox.write).toHaveBeenCalledTimes(2);
  });

  it('§11 T-08 with missing snapshot skips ready event (does not throw)', async () => {
    const order = makeOrder({ status: 'preparing' });
    orderRepo.findById.mockResolvedValue(order);
    snapshotRepo.findById.mockResolvedValue(null);
    const { db } = makeMockDb({
      txResult: [{ ...order, status: 'ready_for_pickup' }],
    });
    const handler = buildHandler(db);

    await expect(
      handler.execute(
        new TransitionOrderCommand(
          'ord-1',
          'ready_for_pickup',
          'usr',
          'restaurant',
        ),
      ),
    ).resolves.toBeDefined();
    // only order-status-changed — ready event skipped
    expect(outbox.write).toHaveBeenCalledTimes(1);
  });

  it('§12 T-05 VNPay cancel publishes OrderCancelledAfterPaymentEvent', async () => {
    const order = makeOrder({ status: 'paid', paymentMethod: 'vnpay' });
    orderRepo.findById.mockResolvedValue(order);
    const { db } = makeMockDb({
      txResult: [{ ...order, status: 'cancelled' }],
    });
    const handler = buildHandler(db);

    await handler.execute(
      new TransitionOrderCommand(
        'ord-1',
        'cancelled',
        'usr',
        'admin',
        'sold out',
      ),
    );

    // 2 outbox events: order-status-changed + order-cancelled-after-payment
    expect(outbox.write).toHaveBeenCalledTimes(2);
  });

  it('§13 T-09 self-assign writes shipperId in update', async () => {
    const order = makeOrder({ status: 'ready_for_pickup' });
    orderRepo.findById.mockResolvedValue(order);
    const { db, updateSet } = makeMockDb({
      txResult: [{ ...order, status: 'picked_up', shipperId: 'shp-1' }],
    });
    const handler = buildHandler(db);

    await handler.execute(
      new TransitionOrderCommand('ord-1', 'picked_up', 'shp-1', 'shipper'),
    );

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ shipperId: 'shp-1' }),
    );
  });
});
