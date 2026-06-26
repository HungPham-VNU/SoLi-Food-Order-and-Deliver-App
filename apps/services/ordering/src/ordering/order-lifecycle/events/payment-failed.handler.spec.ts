import { CommandBus } from '@nestjs/cqrs';
import { PaymentFailedEventHandler } from './payment-failed.handler';
import { PaymentFailedEvent } from '@/shared/events/payment-failed.event';
import { TransitionOrderCommand } from '../commands/transition-order.command';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildHandler() {
  const commandBus = {
    execute: jest.fn().mockResolvedValue(undefined),
  } as unknown as CommandBus;

  const handler = new PaymentFailedEventHandler(commandBus);

  return { handler, commandBus };
}

function makeEvent(
  overrides: Partial<Pick<PaymentFailedEvent, 'orderId' | 'reason'>> = {},
): PaymentFailedEvent {
  return new PaymentFailedEvent(
    overrides.orderId ?? 'order-1',
    'cust-1',
    'vnpay',
    overrides.reason ?? 'VNPay declined payment — responseCode=09',
    new Date(),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PaymentFailedEventHandler', () => {
  describe('handle', () => {
    it('dispatches TransitionOrderCommand to cancelled (T-03)', async () => {
      const { handler, commandBus } = buildHandler();

      await handler.handle(makeEvent());

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      const [cmd] = (commandBus.execute as jest.Mock).mock.calls[0] as [
        TransitionOrderCommand,
      ];
      expect(cmd).toBeInstanceOf(TransitionOrderCommand);
      expect(cmd.toStatus).toBe('cancelled');
      expect(cmd.actorRole).toBe('system');
    });

    it('forwards the reason as the command note', async () => {
      const { handler, commandBus } = buildHandler();
      const reason = 'VNPay declined payment — responseCode=24';

      await handler.handle(makeEvent({ reason }));

      const [cmd] = (commandBus.execute as jest.Mock).mock.calls[0] as [
        TransitionOrderCommand,
      ];
      expect(cmd.note).toBe(reason);
    });

    it('forwards the orderId correctly', async () => {
      const { handler, commandBus } = buildHandler();

      await handler.handle(makeEvent({ orderId: 'order-abc' }));

      const [cmd] = (commandBus.execute as jest.Mock).mock.calls[0] as [
        TransitionOrderCommand,
      ];
      expect(cmd.orderId).toBe('order-abc');
    });

    it('uses actorId=null (system actor) for T-03 transition', async () => {
      const { handler, commandBus } = buildHandler();

      await handler.handle(makeEvent());

      const [cmd] = (commandBus.execute as jest.Mock).mock.calls[0] as [
        TransitionOrderCommand,
      ];
      expect(cmd.actorId).toBeNull();
    });

    it('does not rethrow when commandBus.execute throws (already cancelled race)', async () => {
      const { handler, commandBus } = buildHandler();
      (commandBus.execute as jest.Mock).mockRejectedValue(
        new Error('Invalid transition: cancelled → cancelled'),
      );

      await expect(handler.handle(makeEvent())).resolves.toBeUndefined();
    });

    it('does not rethrow when commandBus.execute throws with order-not-found error', async () => {
      const { handler, commandBus } = buildHandler();
      (commandBus.execute as jest.Mock).mockRejectedValue(
        new Error('Order not found'),
      );

      await expect(handler.handle(makeEvent())).resolves.toBeUndefined();
    });
  });
});
