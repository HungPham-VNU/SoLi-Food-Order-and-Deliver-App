import type { CommandBus, EventBus } from '@nestjs/cqrs';
import { PaymentConfirmedEvent } from '@/shared/events/payment-confirmed.event';
import { OrderPlacedEvent } from '@/shared/events/order-placed.event';
import type { Order, OrderItem } from '../../order/order.schema';
import type { TransitionOrderCommand } from '../commands/transition-order.command';
import type { OrderRepository } from '../repositories/order.repository';
import { PaymentConfirmedEventHandler } from './payment-confirmed.handler';

type CommandBusMock = {
  execute: jest.Mock<Promise<Order>, [TransitionOrderCommand]>;
};

type EventBusMock = {
  publish: jest.Mock<void, [OrderPlacedEvent]>;
};

type OrderRepoMock = {
  findById: jest.Mock<Promise<Order | null>, [string]>;
  findWithItems: jest.Mock<
    Promise<{ order: Order; items: OrderItem[] } | null>,
    [string]
  >;
};

describe('PaymentConfirmedEventHandler', () => {
  const commandBus: CommandBusMock = {
    execute: jest.fn<Promise<Order>, [TransitionOrderCommand]>(),
  };
  const eventBus: EventBusMock = {
    publish: jest.fn<void, [OrderPlacedEvent]>(),
  };
  const orderRepo: OrderRepoMock = {
    findById: jest.fn<Promise<Order | null>, [string]>(),
    findWithItems: jest.fn<
      Promise<{ order: Order; items: OrderItem[] } | null>,
      [string]
    >(),
  };

  let handler: PaymentConfirmedEventHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new PaymentConfirmedEventHandler(
      commandBus as unknown as CommandBus,
      eventBus as unknown as EventBus,
      orderRepo as unknown as OrderRepository,
    );
  });

  it('publishes a fulfillment-ready order event only after VNPay payment is confirmed', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const order: Order = {
      id: '11111111-1111-4111-8111-111111111111',
      customerId: '22222222-2222-4222-8222-222222222222',
      restaurantId: '33333333-3333-4333-8333-333333333333',
      restaurantName: 'Paid Restaurant',
      cartId: '55555555-5555-4555-8555-555555555555',
      status: 'pending',
      paymentMethod: 'vnpay',
      totalAmount: 15000,
      shippingFee: 0,
      discountAmount: 0,
      deliveryAddress: { street: '1 Test St' },
      estimatedDeliveryMinutes: 30,
      note: null,
      paymentUrl: null,
      expiresAt: null,
      version: 0,
      shipperId: null,
      createdAt: now,
      updatedAt: now,
    };
    const item: OrderItem = {
      id: '66666666-6666-4666-8666-666666666666',
      orderId: order.id,
      menuItemId: '44444444-4444-4444-8444-444444444444',
      itemName: 'Paid item',
      quantity: 1,
      unitPrice: 15000,
      modifiersPrice: 0,
      subtotal: 15000,
      modifiers: [],
    };
    orderRepo.findById.mockResolvedValue(order);
    orderRepo.findWithItems.mockResolvedValue({
      order: { ...order, status: 'paid' },
      items: [item],
    });
    commandBus.execute.mockResolvedValue({ ...order, status: 'paid' });

    await handler.handle(
      new PaymentConfirmedEvent(
        order.id,
        order.customerId,
        'vnpay',
        order.totalAmount,
        new Date(),
      ),
    );

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    const published = eventBus.publish.mock.calls[0][0];
    expect(published).toBeInstanceOf(OrderPlacedEvent);
    expect(published.paymentMethod).toBe('vnpay');
    expect(published.readyForFulfillment).toBe(true);
  });
});
