jest.mock('../services/notification.service', () => ({
  NotificationService: class NotificationService {},
}));

jest.mock('../acl/notification-restaurant-acl.repository', () => ({
  NotificationRestaurantAclRepository: class NotificationRestaurantAclRepository {},
}));

import { OrderPlacedEvent } from '@/shared/events/order-placed.event';
import type { NotificationRestaurantSnapshot } from '../acl/notification-restaurant-snapshot.schema';
import type { NotificationRestaurantAclRepository } from '../acl/notification-restaurant-acl.repository';
import type {
  NotificationService,
  SendFromEventParams,
} from '../services/notification.service';
import { OrderPlacedNotificationHandler } from './order-placed.handler';

type NotificationServiceMock = {
  sendFromEvent: jest.Mock<Promise<number>, [SendFromEventParams]>;
};

type RestaurantAclRepoMock = {
  findByRestaurantId: jest.Mock<
    Promise<NotificationRestaurantSnapshot | null>,
    [string]
  >;
};

describe('OrderPlacedNotificationHandler', () => {
  const notificationService: NotificationServiceMock = {
    sendFromEvent: jest.fn<Promise<number>, [SendFromEventParams]>(),
  };
  const restaurantAclRepo: RestaurantAclRepoMock = {
    findByRestaurantId: jest.fn<
      Promise<NotificationRestaurantSnapshot | null>,
      [string]
    >(),
  };

  let handler: OrderPlacedNotificationHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    restaurantAclRepo.findByRestaurantId.mockResolvedValue({
      restaurantId: '33333333-3333-4333-8333-333333333333',
      ownerId: '22222222-2222-4222-8222-222222222222',
      name: 'Test Restaurant',
      lastSyncedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    handler = new OrderPlacedNotificationHandler(
      notificationService as unknown as NotificationService,
      restaurantAclRepo as unknown as NotificationRestaurantAclRepository,
    );
  });

  it('does not send order-success notifications for unpaid VNPay orders', async () => {
    await handler.handle(makeOrderPlacedEvent('vnpay', false));

    expect(notificationService.sendFromEvent).not.toHaveBeenCalled();
    expect(restaurantAclRepo.findByRestaurantId).not.toHaveBeenCalled();
  });

  it('sends order-success notifications when a VNPay order is payment-confirmed', async () => {
    await handler.handle(makeOrderPlacedEvent('vnpay', true));

    expect(notificationService.sendFromEvent).toHaveBeenCalledTimes(2);
    expect(notificationService.sendFromEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: 'order_placed',
        recipientRole: 'customer',
      }),
    );
    expect(notificationService.sendFromEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: 'new_order_received',
        recipientRole: 'restaurant',
      }),
    );
  });
});

function makeOrderPlacedEvent(
  paymentMethod: 'cod' | 'vnpay',
  readyForFulfillment?: boolean,
): OrderPlacedEvent {
  return new OrderPlacedEvent(
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',
    '44444444-4444-4444-8444-444444444444',
    'Test Restaurant',
    15000,
    0,
    paymentMethod,
    [
      {
        menuItemId: '55555555-5555-4555-8555-555555555555',
        name: 'Test item',
        quantity: 1,
        unitPrice: 15000,
      },
    ],
    { street: '1 Test St' },
    undefined,
    undefined,
    readyForFulfillment,
  );
}
