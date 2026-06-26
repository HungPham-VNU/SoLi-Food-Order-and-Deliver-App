import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrderHistoryService } from './order-history.service';
import { OrderHistoryRepository } from '../repositories/order-history.repository';
import { RestaurantSnapshotRepository } from '../../acl/repositories/restaurant-snapshot.repository';
import type {
  Order,
  OrderItem,
  OrderStatusLog,
} from '../../order/order.schema';
import type {
  OrderListRow,
  OrderDetailBundle,
} from '../repositories/order-history.repository';
import type {
  OrderHistoryFiltersDto,
  AdminOrderFiltersDto,
} from '../dto/order-history.dto';
import type { OrderingRestaurantSnapshot } from '../../acl/schemas/restaurant-snapshot.schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    customerId: 'cust-1',
    restaurantId: 'rest-1',
    restaurantName: 'Test Restaurant',
    cartId: 'cart-1',
    status: 'delivered',
    paymentMethod: 'cod',
    totalAmount: 100000,
    shippingFee: 15000,
    discountAmount: 0,
    estimatedDeliveryMinutes: 30,
    deliveryAddress: { street: '1 Main St', district: 'D1', city: 'HCM' },
    note: null,
    paymentUrl: null,
    shipperId: null,
    expiresAt: new Date(),
    reviewedAt: null,
    version: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  } as unknown as Order;
}

function makeListRow(overrides: Partial<Order> = {}): OrderListRow {
  return {
    ...makeOrder(overrides),
    itemCount: 2,
    firstItemName: 'Pho Bo',
  };
}

function makeItem(): OrderItem {
  return {
    id: 'item-1',
    orderId: 'order-1',
    menuItemId: 'menu-1',
    itemName: 'Pho Bo',
    unitPrice: 85000,
    modifiersPrice: 0,
    quantity: 1,
    subtotal: 85000,
    modifiers: [],
  };
}

function makeStatusLog(): OrderStatusLog {
  return {
    id: 'log-1',
    orderId: 'order-1',
    fromStatus: null,
    toStatus: 'pending',
    triggeredBy: 'cust-1',
    triggeredByRole: 'customer',
    note: 'Order placed by customer',
    createdAt: new Date('2024-01-01'),
  } as unknown as OrderStatusLog;
}

function makeBundle(overrides: Partial<Order> = {}): OrderDetailBundle {
  return {
    order: makeOrder(overrides),
    items: [makeItem()],
    timeline: [makeStatusLog()],
  };
}

function makeSnapshot(
  overrides: Partial<OrderingRestaurantSnapshot> = {},
): OrderingRestaurantSnapshot {
  return {
    restaurantId: 'rest-1',
    name: 'Test Restaurant',
    isOpen: true,
    isApproved: true,
    address: '1 Nguyen Hue, D1, HCM',
    cuisineType: 'vietnamese',
    latitude: 10.776,
    longitude: 106.701,
    ownerId: 'owner-1',
    lastSyncedAt: new Date(),
    ...overrides,
  };
}

function buildService(dbHasReview = false) {
  const filters: OrderHistoryFiltersDto = { limit: 20, offset: 0 };

  const orderHistoryRepo = {
    findByCustomer: jest
      .fn()
      .mockResolvedValue({ data: [makeListRow()], total: 1 }),
    findDetailById: jest
      .fn()
      .mockResolvedValue(
        makeBundle({ reviewedAt: dbHasReview ? new Date() : null }),
      ),
    findByRestaurantId: jest
      .fn()
      .mockResolvedValue({ data: [makeListRow()], total: 1 }),
    findActiveByRestaurantId: jest.fn().mockResolvedValue([makeListRow()]),
    findAvailableForPickup: jest.fn().mockResolvedValue([makeListRow()]),
    findActiveForShipper: jest.fn().mockResolvedValue([makeListRow()]),
    findDeliveredByShipper: jest
      .fn()
      .mockResolvedValue({ data: [makeListRow()], total: 1 }),
    findAll: jest.fn().mockResolvedValue({ data: [makeListRow()], total: 1 }),
  } as unknown as OrderHistoryRepository;

  const restaurantSnapshotRepo = {
    findByOwnerId: jest.fn().mockResolvedValue(makeSnapshot()),
  } as unknown as RestaurantSnapshotRepository;

  const service = new OrderHistoryService(
    orderHistoryRepo,
    restaurantSnapshotRepo,
  );

  return { service, orderHistoryRepo, restaurantSnapshotRepo, filters };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OrderHistoryService', () => {
  // -------------------------------------------------------------------------
  // Customer
  // -------------------------------------------------------------------------
  describe('getCustomerOrders', () => {
    it('returns paginated list of orders for the customer', async () => {
      const { service, orderHistoryRepo, filters } = buildService();

      const result = await service.getCustomerOrders('cust-1', filters);

      expect(orderHistoryRepo.findByCustomer).toHaveBeenCalledWith(
        'cust-1',
        filters,
      );
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('maps OrderListRow to OrderListItemDto correctly', async () => {
      const { service, filters } = buildService();

      const result = await service.getCustomerOrders('cust-1', filters);

      const item = result.data[0];
      expect(item.orderId).toBe('order-1');
      expect(item.restaurantId).toBe('rest-1');
      expect(typeof item.totalAmount).toBe('number');
    });

    it('returns default limit=20 and offset=0 in response', async () => {
      const { service } = buildService();

      const result = await service.getCustomerOrders('cust-1', {
        limit: 20,
        offset: 0,
      });

      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });
  });

  describe('getCustomerOrderDetail', () => {
    it('returns order detail for matching customer', async () => {
      const { service } = buildService();

      const result = await service.getCustomerOrderDetail('cust-1', 'order-1');

      expect(result.orderId).toBe('order-1');
    });

    it('throws NotFoundException when order is not found', async () => {
      const { service, orderHistoryRepo } = buildService();
      (orderHistoryRepo.findDetailById as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getCustomerOrderDetail('cust-1', 'order-missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException (disguised) when customerId does not match (ownership check)', async () => {
      const { service } = buildService();

      // order belongs to cust-1, but cust-2 is requesting
      await expect(
        service.getCustomerOrderDetail('cust-2', 'order-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('includes hasReview=false when no review exists', async () => {
      const { service } = buildService(false);

      const result = await service.getCustomerOrderDetail('cust-1', 'order-1');

      expect(result.hasReview).toBe(false);
    });

    it('includes hasReview=true when a visible review exists', async () => {
      const { service } = buildService(true);

      const result = await service.getCustomerOrderDetail('cust-1', 'order-1');

      expect(result.hasReview).toBe(true);
    });

    it('includes timeline in the detail response', async () => {
      const { service } = buildService();

      const result = await service.getCustomerOrderDetail('cust-1', 'order-1');

      expect(result.timeline).toHaveLength(1);
    });
  });

  describe('getCustomerReorderItems', () => {
    it('returns reorder items for matching customer', async () => {
      const { service } = buildService();

      const result = await service.getCustomerReorderItems('cust-1', 'order-1');

      expect(result).toHaveLength(1);
      expect(result[0].menuItemId).toBe('menu-1');
    });

    it('throws NotFoundException when order is not found', async () => {
      const { service, orderHistoryRepo } = buildService();
      (orderHistoryRepo.findDetailById as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getCustomerReorderItems('cust-1', 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when customer does not own the order', async () => {
      const { service } = buildService();

      await expect(
        service.getCustomerReorderItems('cust-other', 'order-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // Restaurant
  // -------------------------------------------------------------------------
  describe('getRestaurantOrders', () => {
    it('returns orders for the owner`s restaurant', async () => {
      const { service, filters } = buildService();

      const result = await service.getRestaurantOrders('owner-1', filters);

      expect(result.total).toBe(1);
    });

    it('throws ForbiddenException when owner has no restaurant snapshot', async () => {
      const { service, restaurantSnapshotRepo, filters } = buildService();
      (restaurantSnapshotRepo.findByOwnerId as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        service.getRestaurantOrders('unknown-owner', filters),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('uses the snapshot restaurantId to query orders', async () => {
      const { service, orderHistoryRepo, filters } = buildService();

      await service.getRestaurantOrders('owner-1', filters);

      expect(orderHistoryRepo.findByRestaurantId).toHaveBeenCalledWith(
        'rest-1',
        filters,
      );
    });
  });

  describe('getRestaurantActiveOrders', () => {
    it('returns active orders for the owner`s restaurant', async () => {
      const { service } = buildService();

      const result = await service.getRestaurantActiveOrders('owner-1');

      expect(result).toHaveLength(1);
    });

    it('throws ForbiddenException when no restaurant found for owner', async () => {
      const { service, restaurantSnapshotRepo } = buildService();
      (restaurantSnapshotRepo.findByOwnerId as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        service.getRestaurantActiveOrders('unknown-owner'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // -------------------------------------------------------------------------
  // Shipper
  // -------------------------------------------------------------------------
  describe('getAvailableOrders', () => {
    it('returns list of ready_for_pickup orders', async () => {
      const { service } = buildService();

      const result = await service.getAvailableOrders();

      expect(result).toHaveLength(1);
    });
  });

  describe('getShipperActiveOrder', () => {
    it('returns shipper`s active delivery', async () => {
      const { service } = buildService();

      const result = await service.getShipperActiveOrder('shipper-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('getShipperHistory', () => {
    it('returns paginated delivered orders for shipper', async () => {
      const { service, orderHistoryRepo, filters } = buildService();

      const result = await service.getShipperHistory('shipper-1', filters);

      expect(result.total).toBe(1);
      expect(orderHistoryRepo.findDeliveredByShipper).toHaveBeenCalledWith(
        'shipper-1',
        filters,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Admin
  // -------------------------------------------------------------------------
  describe('getAllOrders', () => {
    it('returns paginated orders without ownership restriction', async () => {
      const { service } = buildService();
      const adminFilters: AdminOrderFiltersDto = { limit: 20, offset: 0 };

      const result = await service.getAllOrders(adminFilters);

      expect(result.total).toBe(1);
    });
  });

  describe('getAnyOrderDetail', () => {
    it('returns order detail without ownership check', async () => {
      const { service } = buildService();

      const result = await service.getAnyOrderDetail('order-1');

      expect(result.orderId).toBe('order-1');
    });

    it('throws NotFoundException when order does not exist', async () => {
      const { service, orderHistoryRepo } = buildService();
      (orderHistoryRepo.findDetailById as jest.Mock).mockResolvedValue(null);

      await expect(service.getAnyOrderDetail('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
