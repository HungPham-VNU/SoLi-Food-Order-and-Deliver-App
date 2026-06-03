/**
 * PlaceOrderHandler unit tests
 *
 * runObserved is mocked to execute the inner function directly so tests are
 * not coupled to OpenTelemetry internals.
 * recordOrderPlaced is a no-op metric call — mocked to avoid side-effects.
 */

jest.mock('@/observability/trace', () => ({
  runObserved: (_name: string, _attrs: unknown, fn: () => unknown) => fn(),
}));

jest.mock('@/observability/domain-metrics', () => ({
  recordOrderPlaced: jest.fn(),
}));

import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PlaceOrderHandler } from './place-order.handler';
import { PlaceOrderCommand } from './place-order.command';
import type { Order, DeliveryAddress } from '../order.schema';
import type { Cart, CartItem } from '../../cart/cart.types';
import type { OrderingMenuItemSnapshot } from '../../acl/schemas/menu-item-snapshot.schema';
import type { OrderingRestaurantSnapshot } from '../../acl/schemas/restaurant-snapshot.schema';
import type { OrderPlacedEvent } from '@/shared/events/order-placed.event';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CUSTOMER_ID = 'cust-uuid-1';
const RESTAURANT_ID = 'rest-uuid-1';

const deliveryAddress: DeliveryAddress = {
  street: '1 Nguyen Hue',
  district: 'D1',
  city: 'HCM',
};

function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    cartItemId: 'item-uuid-1',
    modifierFingerprint: '',
    menuItemId: 'menu-1',
    itemName: 'Pho Bo',
    unitPrice: 85000,
    quantity: 1,
    selectedModifiers: [],
    ...overrides,
  };
}

function makeCart(items: CartItem[] = [makeCartItem()]): Cart {
  return {
    cartId: 'cart-uuid-1',
    restaurantId: RESTAURANT_ID,
    customerId: CUSTOMER_ID,
    items,
  } as unknown as Cart;
}

function makeRestaurantSnapshot(
  overrides: Partial<OrderingRestaurantSnapshot> = {},
): OrderingRestaurantSnapshot {
  return {
    restaurantId: RESTAURANT_ID,
    name: 'Test Restaurant',
    isOpen: true,
    isApproved: true,
    latitude: 10.776,
    longitude: 106.701,
    address: '1 Le Loi, D1',
    cuisineType: 'vietnamese',
    ownerId: 'owner-1',
    lastSyncedAt: new Date(),
    ...overrides,
  };
}

function makeMenuItemSnapshot(
  overrides: Partial<OrderingMenuItemSnapshot> = {},
): OrderingMenuItemSnapshot {
  return {
    menuItemId: 'menu-1',
    restaurantId: RESTAURANT_ID,
    name: 'Pho Bo',
    price: 85000,
    status: 'available',
    modifiers: [],
    lastSyncedAt: new Date(),
    ...overrides,
  } as unknown as OrderingMenuItemSnapshot;
}

function makePersistedOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-uuid-1',
    customerId: CUSTOMER_ID,
    restaurantId: RESTAURANT_ID,
    restaurantName: 'Test Restaurant',
    cartId: 'cart-uuid-1',
    status: 'pending',
    paymentMethod: 'cod',
    totalAmount: 100000,
    shippingFee: 0,
    discountAmount: 0,
    estimatedDeliveryMinutes: null,
    deliveryAddress,
    note: null,
    paymentUrl: null,
    shipperId: null,
    expiresAt: new Date(),
    version: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as Order;
}

/** Build the DB mock that supports transaction, update, select */
function makeDb(persistedOrder: Order = makePersistedOrder()) {
  // Insert chain used inside persistOrderAtomically
  const returningInsert = jest.fn().mockResolvedValue([persistedOrder]);
  const valuesInsert = jest
    .fn()
    .mockReturnValue({ returning: returningInsert });
  const insertFn = jest.fn().mockReturnValue({ values: valuesInsert });

  // Update chain used for paymentUrl patch
  const whereUpdate = jest.fn().mockResolvedValue([]);
  const setFn = jest.fn().mockReturnValue({ where: whereUpdate });
  const updateFn = jest.fn().mockReturnValue({ set: setFn });

  // Select chain for idempotency key lookup (fetchOrderById)
  const limitSelect = jest.fn().mockResolvedValue([persistedOrder]);
  const whereSelect = jest.fn().mockReturnValue({ limit: limitSelect });
  const fromSelect = jest.fn().mockReturnValue({ where: whereSelect });
  const selectFn = jest.fn().mockReturnValue({ from: fromSelect });

  // Transaction executes the callback immediately, passing the same mock as tx
  const db: Record<string, jest.Mock> = {
    insert: insertFn,
    update: updateFn,
    select: selectFn,
    transaction: jest
      .fn()
      .mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        return cb({
          insert: insertFn,
          update: updateFn,
          select: selectFn,
        });
      }),
  };

  return {
    db,
    insertFn,
    updateFn,
    selectFn,
    returningInsert,
    setFn,
    whereUpdate,
  };
}

function buildHandler({
  cart = makeCart(),
  restaurantSnapshot = makeRestaurantSnapshot(),
  menuItemSnapshots = [makeMenuItemSnapshot()],
  persistedOrder = makePersistedOrder(),
  redisGetResult = null as string | null,
  redisSetNxResult = true,
}: {
  cart?: Cart | null;
  restaurantSnapshot?: OrderingRestaurantSnapshot | null;
  menuItemSnapshots?: OrderingMenuItemSnapshot[];
  persistedOrder?: Order;
  redisGetResult?: string | null;
  redisSetNxResult?: boolean;
} = {}) {
  const { db } = makeDb(persistedOrder);

  const cartRepo = {
    findByCustomerId: jest.fn().mockResolvedValue(cart),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  const menuItemSnapshotRepo = {
    findManyByIds: jest.fn().mockResolvedValue(menuItemSnapshots),
  };

  const restaurantSnapshotRepo = {
    findById: jest.fn().mockResolvedValue(restaurantSnapshot),
  };

  const deliveryZoneSnapshotRepo = {
    findActiveByRestaurantId: jest.fn().mockResolvedValue([]),
  };

  const appSettingsService = {
    getNumber: jest.fn().mockResolvedValue(600),
  };

  const redis = {
    setNx: jest.fn().mockResolvedValue(redisSetNxResult),
    del: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(redisGetResult),
    setWithExpiry: jest.fn().mockResolvedValue(undefined),
  };

  const eventBus = {
    publish: jest.fn(),
  };

  const geo = {
    calculateDistanceKm: jest.fn().mockReturnValue(1.5),
  };

  const paymentPort = {
    initiateVNPayPayment: jest.fn().mockResolvedValue({
      txnId: 'txn-1',
      paymentUrl: 'https://vnpay.vn/pay?token=abc',
    }),
    markPaymentAttemptFailed: jest.fn().mockResolvedValue(undefined),
  };

  const promotionPort = {
    computeAndReserveDiscount: jest.fn().mockResolvedValue({
      reserved: false,
      discountAmount: 0,
    }),
    confirmReservations: jest.fn().mockResolvedValue(undefined),
    rollbackReservations: jest.fn().mockResolvedValue(undefined),
  };

  const handler = new PlaceOrderHandler(
    db as never,
    cartRepo as never,
    menuItemSnapshotRepo as never,
    restaurantSnapshotRepo as never,
    deliveryZoneSnapshotRepo as never,
    appSettingsService as never,
    redis as never,
    eventBus as never,
    geo as never,
    paymentPort,
    promotionPort as never,
  );

  return {
    handler,
    db,
    cartRepo,
    menuItemSnapshotRepo,
    restaurantSnapshotRepo,
    deliveryZoneSnapshotRepo,
    appSettingsService,
    redis,
    eventBus,
    geo,
    paymentPort,
    promotionPort,
  };
}

function makeCommand(
  overrides: {
    customerId?: string;
    address?: DeliveryAddress;
    paymentMethod?: 'cod' | 'vnpay';
    note?: string;
    idempotencyKey?: string;
    ipAddr?: string;
    couponCode?: string;
  } = {},
): PlaceOrderCommand {
  return new PlaceOrderCommand(
    overrides.customerId ?? CUSTOMER_ID,
    overrides.address ?? deliveryAddress,
    overrides.paymentMethod ?? 'cod',
    overrides.note,
    overrides.idempotencyKey,
    overrides.ipAddr,
    overrides.couponCode,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PlaceOrderHandler', () => {
  // -------------------------------------------------------------------------
  // Idempotency (D5-A)
  // -------------------------------------------------------------------------
  describe('idempotency check', () => {
    it('returns cached order when idempotency key has already been processed', async () => {
      const cachedOrder = makePersistedOrder({ id: 'order-cached-1' });
      const { handler, redis } = buildHandler({
        redisGetResult: 'order-cached-1',
        persistedOrder: cachedOrder,
      });

      const command = new PlaceOrderCommand(
        CUSTOMER_ID,
        deliveryAddress,
        'cod',
        undefined,
        'my-idem-key',
      );

      const result = await handler.execute(command);

      expect(redis.get).toHaveBeenCalledWith(
        expect.stringContaining('my-idem-key'),
      );
      expect(result.id).toBe('order-cached-1');
      // Cart should NOT be mutated on cache hit
      expect(redis.setNx).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Cart lock (Step 2)
  // -------------------------------------------------------------------------
  describe('cart checkout lock', () => {
    it('throws ConflictException when cart lock cannot be acquired', async () => {
      const { handler } = buildHandler({ redisSetNxResult: false });

      await expect(handler.execute(makeCommand())).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('releases the lock in the finally block even when an inner step fails', async () => {
      const { handler, redis } = buildHandler({ cart: null });

      await expect(handler.execute(makeCommand())).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(redis.del).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Cart validation (Step 3)
  // -------------------------------------------------------------------------
  describe('cart validation', () => {
    it('throws BadRequestException when cart is null', async () => {
      const { handler } = buildHandler({ cart: null });

      await expect(handler.execute(makeCommand())).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws BadRequestException when cart has no items', async () => {
      const { handler } = buildHandler({ cart: makeCart([]) });

      await expect(handler.execute(makeCommand())).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Restaurant snapshot validation (Step 5)
  // -------------------------------------------------------------------------
  describe('restaurant snapshot validation', () => {
    it('throws UnprocessableEntityException when restaurant snapshot is missing', async () => {
      const { handler } = buildHandler({ restaurantSnapshot: null });

      await expect(handler.execute(makeCommand())).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });

    it('throws UnprocessableEntityException when restaurant is not approved', async () => {
      const { handler } = buildHandler({
        restaurantSnapshot: makeRestaurantSnapshot({ isApproved: false }),
      });

      await expect(handler.execute(makeCommand())).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });

    it('throws UnprocessableEntityException when restaurant is closed', async () => {
      const { handler } = buildHandler({
        restaurantSnapshot: makeRestaurantSnapshot({ isOpen: false }),
      });

      await expect(handler.execute(makeCommand())).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Menu item snapshot validation (Step 5)
  // -------------------------------------------------------------------------
  describe('menu item snapshot validation', () => {
    it('throws UnprocessableEntityException when menu item snapshot is missing', async () => {
      const { handler } = buildHandler({ menuItemSnapshots: [] });

      await expect(handler.execute(makeCommand())).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });

    it('throws UnprocessableEntityException (C-2) when item belongs to different restaurant', async () => {
      const { handler } = buildHandler({
        menuItemSnapshots: [
          makeMenuItemSnapshot({ restaurantId: 'different-restaurant' }),
        ],
      });

      await expect(handler.execute(makeCommand())).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });

    it('throws UnprocessableEntityException when item is out_of_stock', async () => {
      const { handler } = buildHandler({
        menuItemSnapshots: [makeMenuItemSnapshot({ status: 'out_of_stock' })],
      });

      await expect(handler.execute(makeCommand())).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });

    it('throws UnprocessableEntityException when item is unavailable', async () => {
      const { handler } = buildHandler({
        menuItemSnapshots: [makeMenuItemSnapshot({ status: 'unavailable' })],
      });

      await expect(handler.execute(makeCommand())).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Items total guard
  // -------------------------------------------------------------------------
  describe('items total guard', () => {
    it('throws UnprocessableEntityException when all items have zero price', async () => {
      const zeroCart = makeCart([makeCartItem({ unitPrice: 0 })]);
      const zeroSnapshot = makeMenuItemSnapshot({ price: 0 });
      const { handler } = buildHandler({
        cart: zeroCart,
        menuItemSnapshots: [zeroSnapshot],
      });

      await expect(handler.execute(makeCommand())).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Delivery zone validation (Step 6)
  // -------------------------------------------------------------------------
  describe('delivery zone validation', () => {
    it('throws UnprocessableEntityException when address is outside all delivery zones', async () => {
      const restaurantSnapshot = makeRestaurantSnapshot({
        latitude: 10.776,
        longitude: 106.701,
      });
      const { handler, deliveryZoneSnapshotRepo, geo } = buildHandler({
        restaurantSnapshot,
      });

      // Provide one zone with 1 km radius but geo returns 5 km distance
      deliveryZoneSnapshotRepo.findActiveByRestaurantId.mockResolvedValue([
        {
          zoneId: 'zone-1',
          radiusKm: 1,
          baseFee: 15000,
          perKmRate: 5000,
          avgSpeedKmh: 30,
          prepTimeMinutes: 10,
          bufferMinutes: 5,
        },
      ]);
      geo.calculateDistanceKm.mockReturnValue(5);

      const commandWithCoords = new PlaceOrderCommand(
        CUSTOMER_ID,
        { ...deliveryAddress, latitude: 10.9, longitude: 106.9 },
        'cod',
      );

      await expect(handler.execute(commandWithCoords)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Happy path — COD
  // -------------------------------------------------------------------------
  describe('happy path COD', () => {
    it('returns persisted order for a valid COD checkout', async () => {
      const order = makePersistedOrder({ paymentMethod: 'cod' });
      const { handler } = buildHandler({ persistedOrder: order });

      const result = await handler.execute(makeCommand());

      expect(result.id).toBe(order.id);
      expect(result.paymentMethod).toBe('cod');
    });

    it('publishes OrderPlacedEvent after successful order creation', async () => {
      const { handler, eventBus } = buildHandler();

      await handler.execute(makeCommand());

      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      const [event] = eventBus.publish.mock.calls[0] as [OrderPlacedEvent];
      expect(event.orderId).toBe('order-uuid-1');
    });

    it('clears the Redis cart after placing the order', async () => {
      const { handler, cartRepo } = buildHandler();

      await handler.execute(makeCommand());

      expect(cartRepo.delete).toHaveBeenCalledWith(CUSTOMER_ID);
    });

    it('releases the cart lock after placing the order', async () => {
      const { handler, redis } = buildHandler();

      await handler.execute(makeCommand());

      expect(redis.del).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Happy path — VNPay
  // -------------------------------------------------------------------------
  describe('happy path VNPay', () => {
    it('returns order with paymentUrl attached', async () => {
      const order = makePersistedOrder({
        paymentMethod: 'vnpay',
        paymentUrl: 'https://vnpay.vn/pay?token=xyz',
      });
      const { handler, paymentPort } = buildHandler({ persistedOrder: order });
      paymentPort.initiateVNPayPayment.mockResolvedValue({
        txnId: 'txn-xyz',
        paymentUrl: 'https://vnpay.vn/pay?token=xyz',
      });

      const command = new PlaceOrderCommand(
        CUSTOMER_ID,
        deliveryAddress,
        'vnpay',
      );
      const result = await handler.execute(command);

      expect(result.paymentUrl).toBe('https://vnpay.vn/pay?token=xyz');
    });

    it('rejects checkout when VNPay URL generation fails before order persistence', async () => {
      const order = makePersistedOrder({ paymentMethod: 'vnpay' });
      const { handler, paymentPort, db, cartRepo } = buildHandler({
        persistedOrder: order,
      });
      paymentPort.initiateVNPayPayment.mockRejectedValue(
        new Error('VNPay gateway timeout'),
      );

      const command = new PlaceOrderCommand(
        CUSTOMER_ID,
        deliveryAddress,
        'vnpay',
      );

      await expect(handler.execute(command)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(db.transaction).not.toHaveBeenCalled();
      expect(cartRepo.delete).not.toHaveBeenCalled();
    });

    it('rejects zero-payable VNPay orders and rolls back a reserved promotion', async () => {
      const { handler, paymentPort, promotionPort, db } = buildHandler();
      promotionPort.computeAndReserveDiscount.mockResolvedValue({
        reserved: true,
        discountAmount: 85000,
        usageId: 'usage-1',
      });

      const command = new PlaceOrderCommand(
        CUSTOMER_ID,
        deliveryAddress,
        'vnpay',
      );

      await expect(handler.execute(command)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(paymentPort.initiateVNPayPayment).not.toHaveBeenCalled();
      expect(db.transaction).not.toHaveBeenCalled();
      expect(promotionPort.rollbackReservations).toHaveBeenCalled();
    });

    it('marks the VNPay payment attempt failed when order persistence fails after session creation', async () => {
      const { handler, paymentPort, db } = buildHandler();
      paymentPort.initiateVNPayPayment.mockResolvedValue({
        txnId: 'txn-created',
        paymentUrl: 'https://vnpay.vn/pay?token=created',
      });
      db.transaction.mockRejectedValue(new Error('DB failure'));

      const command = new PlaceOrderCommand(
        CUSTOMER_ID,
        deliveryAddress,
        'vnpay',
      );

      await expect(handler.execute(command)).rejects.toThrow();
      expect(paymentPort.markPaymentAttemptFailed).toHaveBeenCalledWith(
        'txn-created',
        'Order persistence failed after VNPay payment session was created',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Promotion reservation
  // -------------------------------------------------------------------------
  describe('promotion reservation', () => {
    it('confirms reservation after order is persisted', async () => {
      const { handler, promotionPort } = buildHandler();
      promotionPort.computeAndReserveDiscount.mockResolvedValue({
        reserved: true,
        discountAmount: 10000,
        usageId: 'usage-1',
      });

      await handler.execute(makeCommand());

      expect(promotionPort.confirmReservations).toHaveBeenCalledWith(
        'order-uuid-1',
      );
    });

    it('rolls back promotion reservation when DB transaction fails', async () => {
      const { handler, promotionPort, db } = buildHandler();
      promotionPort.computeAndReserveDiscount.mockResolvedValue({
        reserved: true,
        discountAmount: 10000,
        usageId: 'usage-1',
      });
      // Make the DB transaction throw
      db.transaction.mockRejectedValue(new Error('DB failure'));

      await expect(handler.execute(makeCommand())).rejects.toThrow();

      expect(promotionPort.rollbackReservations).toHaveBeenCalled();
    });

    it('does not call rollbackReservations when no promotion was reserved', async () => {
      const { handler, promotionPort, db } = buildHandler();
      promotionPort.computeAndReserveDiscount.mockResolvedValue({
        reserved: false,
        discountAmount: 0,
      });
      db.transaction.mockRejectedValue(new Error('DB failure'));

      await expect(handler.execute(makeCommand())).rejects.toThrow();

      expect(promotionPort.rollbackReservations).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // D5-B: UNIQUE(cartId) duplicate guard
  // -------------------------------------------------------------------------
  describe('D5-B UNIQUE constraint guard', () => {
    it('re-throws as ConflictException when DB throws a unique constraint violation', async () => {
      const { handler, db } = buildHandler();
      const uniqueError = new Error(
        'duplicate key value violates unique constraint "orders_cart_id_unique"',
      );
      (uniqueError as Error & { code?: string }).code = '23505';
      db.transaction.mockRejectedValue(uniqueError);

      await expect(handler.execute(makeCommand())).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Idempotency key persistence (Step 11 — C-1 fix)
  // -------------------------------------------------------------------------
  describe('idempotency key persistence', () => {
    it('saves idempotency key to Redis before clearing the cart', async () => {
      const { handler, redis, cartRepo } = buildHandler();
      const callOrder: string[] = [];
      redis.setWithExpiry.mockImplementation(() => {
        callOrder.push('setWithExpiry');
      });
      cartRepo.delete.mockImplementation(() => {
        callOrder.push('cartDelete');
        return Promise.resolve();
      });

      const command = new PlaceOrderCommand(
        CUSTOMER_ID,
        deliveryAddress,
        'cod',
        undefined,
        'idem-key-1',
      );
      await handler.execute(command);

      const setWithExpiry = callOrder.indexOf('setWithExpiry');
      const cartDelete = callOrder.indexOf('cartDelete');
      expect(setWithExpiry).toBeGreaterThanOrEqual(0);
      expect(cartDelete).toBeGreaterThanOrEqual(0);
      expect(setWithExpiry).toBeLessThan(cartDelete);
    });
  });
});
