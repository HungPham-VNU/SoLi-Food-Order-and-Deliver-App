jest.mock('@thallesp/nestjs-better-auth', () => ({
  Session: () => () => undefined,
}));

import type { CommandBus } from '@nestjs/cqrs';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { TransitionOrderCommand } from '../commands/transition-order.command';
import { PaymentCancellationController } from './payment-cancellation.controller';

describe('PaymentCancellationController', () => {
  it('orchestrates Payment through its port and Ordering through its command', async () => {
    const transaction = {
      id: 'payment-1',
      orderId: 'order-1',
      status: 'failed',
      updatedAt: new Date('2026-06-21T00:00:00Z'),
    };
    const commandBus = { execute: jest.fn().mockResolvedValue(undefined) };
    const payments = {
      initiateVNPayPayment: jest.fn(),
      markPaymentAttemptFailed: jest.fn(),
      cancelPendingPaymentForOrder: jest.fn().mockResolvedValue(transaction),
    };
    const controller = new PaymentCancellationController(
      commandBus as unknown as CommandBus,
      payments,
    );
    const session = {
      user: { id: 'customer-1' },
    } as UserSession;

    await expect(
      controller.cancelPendingPayment('order-1', session),
    ).resolves.toBe(transaction);

    expect(payments.cancelPendingPaymentForOrder).toHaveBeenCalledWith(
      'order-1',
      'customer-1',
      'Customer cancelled VNPay payment from mobile checkout',
    );
    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.any(TransitionOrderCommand),
    );
  });
});
