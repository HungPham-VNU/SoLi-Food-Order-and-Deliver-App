/**
 * order-lifecycle.service.spec.ts
 *
 * Unit tests for OrderLifecycleService.assertOwnership.
 * Covers admin/system bypass, customer ownership match/mismatch,
 * restaurant ownership via snapshot, and shipper no-op.
 */
import { ForbiddenException } from '@nestjs/common';
import { OrderLifecycleService } from './order-lifecycle.service';
import type { Order } from '../../order/order.schema';
import type { RestaurantSnapshotRepository } from '../../acl/repositories/restaurant-snapshot.repository';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
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

describe('OrderLifecycleService.assertOwnership', () => {
  const snapshotRepo = {
    findByRestaurantIdAndOwnerId: jest.fn(),
  };
  const service = new OrderLifecycleService(
    snapshotRepo as unknown as RestaurantSnapshotRepository,
  );

  beforeEach(() => {
    snapshotRepo.findByRestaurantIdAndOwnerId.mockReset();
  });

  it('admin bypasses ownership entirely', async () => {
    await expect(
      service.assertOwnership(makeOrder(), null, 'admin'),
    ).resolves.toBeUndefined();
    expect(snapshotRepo.findByRestaurantIdAndOwnerId).not.toHaveBeenCalled();
  });

  it('system bypasses ownership entirely', async () => {
    await expect(
      service.assertOwnership(makeOrder(), null, 'system'),
    ).resolves.toBeUndefined();
  });

  describe('customer', () => {
    it('passes when actorId matches order.customerId', async () => {
      await expect(
        service.assertOwnership(
          makeOrder({ customerId: 'cust-1' }),
          'cust-1',
          'customer',
        ),
      ).resolves.toBeUndefined();
    });

    it('throws when actorId is null', async () => {
      await expect(
        service.assertOwnership(makeOrder(), null, 'customer'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws when actorId mismatches', async () => {
      await expect(
        service.assertOwnership(
          makeOrder({ customerId: 'cust-1' }),
          'cust-2',
          'customer',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('restaurant', () => {
    it('throws when actorId is null', async () => {
      await expect(
        service.assertOwnership(makeOrder(), null, 'restaurant'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('passes when snapshot found for (restaurantId, ownerId)', async () => {
      snapshotRepo.findByRestaurantIdAndOwnerId.mockResolvedValue({
        restaurantId: 'rest-1',
        ownerId: 'owner-1',
      });
      await expect(
        service.assertOwnership(makeOrder(), 'owner-1', 'restaurant'),
      ).resolves.toBeUndefined();
      expect(snapshotRepo.findByRestaurantIdAndOwnerId).toHaveBeenCalledWith(
        'rest-1',
        'owner-1',
      );
    });

    it('throws Forbidden when snapshot missing', async () => {
      snapshotRepo.findByRestaurantIdAndOwnerId.mockResolvedValue(null);
      await expect(
        service.assertOwnership(makeOrder(), 'owner-2', 'restaurant'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  it('shipper role is a no-op at this layer (handler enforces shipperId match)', async () => {
    await expect(
      service.assertOwnership(makeOrder(), 'shp-1', 'shipper'),
    ).resolves.toBeUndefined();
    expect(snapshotRepo.findByRestaurantIdAndOwnerId).not.toHaveBeenCalled();
  });
});
