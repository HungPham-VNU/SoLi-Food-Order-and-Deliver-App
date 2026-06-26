import { CommandBus } from '@nestjs/cqrs';
import { OrderTimeoutTask } from './order-timeout.task';
import { OrderRepository } from '../repositories/order.repository';
import { TransitionOrderCommand } from '../commands/transition-order.command';
import type { Order } from '../../order/order.schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOrder(id: string, status: 'pending' | 'paid'): Order {
  return {
    id,
    customerId: 'cust-1',
    restaurantId: 'rest-1',
    restaurantName: 'Test Restaurant',
    cartId: `cart-${id}`,
    status,
    totalAmount: 100000,
    shippingFee: 0,
    discountAmount: 0,
    paymentMethod: 'cod',
    deliveryAddress: { street: '1 Main St', district: 'D1', city: 'HCM' },
    note: null,
    expiresAt: new Date('2020-01-01'),
    estimatedDeliveryMinutes: null,
    paymentUrl: null,
    shipperId: null,
    version: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Order;
}

function buildTask() {
  const orderRepo = {
    findExpiredPendingOrPaid: jest.fn(),
  } as unknown as OrderRepository;

  const commandBus = {
    execute: jest.fn().mockResolvedValue(undefined),
  } as unknown as CommandBus;

  const task = new OrderTimeoutTask(orderRepo, commandBus);

  return { task, orderRepo, commandBus };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OrderTimeoutTask', () => {
  describe('handleExpiredOrders', () => {
    it('returns immediately when no expired orders exist', async () => {
      const { task, orderRepo, commandBus } = buildTask();
      (orderRepo.findExpiredPendingOrPaid as jest.Mock).mockResolvedValue([]);

      await task.handleExpiredOrders();

      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('dispatches TransitionOrderCommand to cancelled for each expired order', async () => {
      const { task, orderRepo, commandBus } = buildTask();
      const orders = [
        makeOrder('order-1', 'pending'),
        makeOrder('order-2', 'paid'),
      ];
      (orderRepo.findExpiredPendingOrPaid as jest.Mock).mockResolvedValue(
        orders,
      );

      await task.handleExpiredOrders();

      expect(commandBus.execute).toHaveBeenCalledTimes(2);
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order-1',
          toStatus: 'cancelled',
          actorId: null,
          actorRole: 'system',
        }),
      );
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order-2',
          toStatus: 'cancelled',
          actorRole: 'system',
        }),
      );
    });

    it('passes a non-empty note in TransitionOrderCommand', async () => {
      const { task, orderRepo, commandBus } = buildTask();
      (orderRepo.findExpiredPendingOrPaid as jest.Mock).mockResolvedValue([
        makeOrder('o1', 'pending'),
      ]);

      await task.handleExpiredOrders();

      const [cmd] = (commandBus.execute as jest.Mock).mock.calls[0] as [
        TransitionOrderCommand,
      ];
      expect(typeof cmd.note).toBe('string');
      expect(cmd.note.length).toBeGreaterThan(0);
    });

    it('constructs a TransitionOrderCommand instance', async () => {
      const { task, orderRepo, commandBus } = buildTask();
      (orderRepo.findExpiredPendingOrPaid as jest.Mock).mockResolvedValue([
        makeOrder('o1', 'pending'),
      ]);

      await task.handleExpiredOrders();

      const [cmd] = (commandBus.execute as jest.Mock).mock.calls[0] as [
        TransitionOrderCommand,
      ];
      expect(cmd).toBeInstanceOf(TransitionOrderCommand);
    });

    it('continues processing remaining orders when one fails', async () => {
      const { task, orderRepo, commandBus } = buildTask();
      const orders = [
        makeOrder('o1', 'pending'),
        makeOrder('o2', 'pending'),
        makeOrder('o3', 'pending'),
      ];
      (orderRepo.findExpiredPendingOrPaid as jest.Mock).mockResolvedValue(
        orders,
      );
      (commandBus.execute as jest.Mock)
        .mockRejectedValueOnce(new Error('Transition failed'))
        .mockResolvedValue(undefined);

      await task.handleExpiredOrders();

      // Despite o1 failing, o2 and o3 should also be attempted
      expect(commandBus.execute).toHaveBeenCalledTimes(3);
    });

    it('does not throw when findExpiredPendingOrPaid throws', async () => {
      const { task, orderRepo, commandBus } = buildTask();
      (orderRepo.findExpiredPendingOrPaid as jest.Mock).mockRejectedValue(
        new Error('DB error'),
      );

      await expect(task.handleExpiredOrders()).resolves.toBeUndefined();
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('handles a mix of pending and paid expired orders', async () => {
      const { task, orderRepo, commandBus } = buildTask();
      const orders = [
        makeOrder('pending-1', 'pending'),
        makeOrder('paid-1', 'paid'),
      ];
      (orderRepo.findExpiredPendingOrPaid as jest.Mock).mockResolvedValue(
        orders,
      );

      await task.handleExpiredOrders();

      expect(commandBus.execute).toHaveBeenCalledTimes(2);
      const ids = (commandBus.execute as jest.Mock).mock.calls.map(
        ([cmd]: [TransitionOrderCommand]) => cmd.orderId,
      );
      expect(ids).toContain('pending-1');
      expect(ids).toContain('paid-1');
    });
  });
});
