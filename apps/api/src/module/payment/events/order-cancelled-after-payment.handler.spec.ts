import { OrderCancelledAfterPaymentHandler } from './order-cancelled-after-payment.handler';
import { PaymentTransactionRepository } from '../repositories/payment-transaction.repository';
import { VNPayService } from '../services/vnpay.service';
import { OrderCancelledAfterPaymentEvent } from '@/shared/events/order-cancelled-after-payment.event';
import type { PaymentTransaction } from '../domain/payment-transaction.schema';
import type { VNPayConfig } from '@/config/vnpay.config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTxn(
  overrides: Partial<PaymentTransaction> = {},
): PaymentTransaction {
  return {
    id: 'txn-1',
    orderId: 'order-1',
    customerId: 'cust-1',
    amount: 150000,
    status: 'completed',
    paymentUrl: null,
    providerTxnId: 'vnpay-txn-1',
    vnpResponseCode: '00',
    rawIpnPayload: null,
    ipnReceivedAt: null,
    paidAt: new Date(),
    refundInitiatedAt: null,
    refundedAt: null,
    refundRetryCount: null,
    expiresAt: new Date(Date.now() + 3600_000),
    version: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as PaymentTransaction;
}

function makeEvent(
  overrides: Partial<{
    orderId: string;
    paidAmount: number;
    cancelledByRole: 'customer' | 'restaurant' | 'admin' | 'system';
  }> = {},
): OrderCancelledAfterPaymentEvent {
  return new OrderCancelledAfterPaymentEvent(
    overrides.orderId ?? 'order-1',
    'cust-1',
    'vnpay',
    overrides.paidAmount ?? 150000,
    new Date(),
    overrides.cancelledByRole ?? 'admin',
  );
}

function buildHandler() {
  const txnRepo = {
    findCompletedByOrderId: jest.fn(),
    updateStatus: jest.fn(),
  } as unknown as PaymentTransactionRepository;

  // Default: refund succeeds (simulated). Individual tests can override.
  const vnpayService = {
    requestRefund: jest
      .fn()
      .mockResolvedValue({ success: true, simulated: true, message: 'ok' }),
  } as unknown as VNPayService;

  const config = { refundMaxRetries: 5 } as unknown as VNPayConfig;

  const handler = new OrderCancelledAfterPaymentHandler(
    txnRepo,
    vnpayService,
    config,
  );

  return { handler, txnRepo, vnpayService };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OrderCancelledAfterPaymentHandler', () => {
  describe('handle', () => {
    it('does nothing when no completed transaction exists (COD or pre-confirmation cancel)', async () => {
      const { handler, txnRepo } = buildHandler();
      (txnRepo.findCompletedByOrderId as jest.Mock).mockResolvedValue(null);

      await handler.handle(makeEvent());

      expect(txnRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('does nothing when transaction amount is non-positive', async () => {
      const { handler, txnRepo } = buildHandler();
      (txnRepo.findCompletedByOrderId as jest.Mock).mockResolvedValue(
        makeTxn({ amount: 0 }),
      );

      await handler.handle(makeEvent());

      expect(txnRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('does nothing when transaction is already refund_pending', async () => {
      const { handler, txnRepo } = buildHandler();
      (txnRepo.findCompletedByOrderId as jest.Mock).mockResolvedValue(
        makeTxn({ status: 'refund_pending' }),
      );

      await handler.handle(makeEvent());

      expect(txnRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('does nothing when transaction is already refunded', async () => {
      const { handler, txnRepo } = buildHandler();
      (txnRepo.findCompletedByOrderId as jest.Mock).mockResolvedValue(
        makeTxn({ status: 'refunded' }),
      );

      await handler.handle(makeEvent());

      expect(txnRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('transitions completed → refund_pending → refunded on happy path', async () => {
      const { handler, txnRepo } = buildHandler();
      const completedTxn = makeTxn({ version: 2 });
      const refundPendingTxn = makeTxn({
        status: 'refund_pending',
        version: 3,
      });

      (txnRepo.findCompletedByOrderId as jest.Mock).mockResolvedValue(
        completedTxn,
      );
      (txnRepo.updateStatus as jest.Mock)
        .mockResolvedValueOnce(refundPendingTxn) // completed → refund_pending
        .mockResolvedValueOnce(makeTxn({ status: 'refunded', version: 4 })); // refund_pending → refunded

      await handler.handle(makeEvent());

      expect(txnRepo.updateStatus).toHaveBeenCalledTimes(2);
    });

    it('first updateStatus call uses toStatus=refund_pending with current version', async () => {
      const { handler, txnRepo } = buildHandler();
      const completedTxn = makeTxn({ version: 5 });
      (txnRepo.findCompletedByOrderId as jest.Mock).mockResolvedValue(
        completedTxn,
      );
      (txnRepo.updateStatus as jest.Mock).mockResolvedValue(null); // lock lost

      await handler.handle(makeEvent());

      expect(txnRepo.updateStatus).toHaveBeenCalledWith(
        'txn-1',
        'refund_pending',
        5,
        expect.any(Object),
      );
    });

    it('stops after refund_pending transition when optimistic lock is lost', async () => {
      const { handler, txnRepo } = buildHandler();
      (txnRepo.findCompletedByOrderId as jest.Mock).mockResolvedValue(
        makeTxn(),
      );
      (txnRepo.updateStatus as jest.Mock).mockResolvedValue(null); // lock lost

      await handler.handle(makeEvent());

      // Only called once (refund_pending attempt), not twice (refunded attempt)
      expect(txnRepo.updateStatus).toHaveBeenCalledTimes(1);
    });

    it('second updateStatus call uses version from the refund_pending row', async () => {
      const { handler, txnRepo } = buildHandler();
      const refundPendingTxn = makeTxn({
        status: 'refund_pending',
        version: 7,
      });
      (txnRepo.findCompletedByOrderId as jest.Mock).mockResolvedValue(
        makeTxn({ version: 6 }),
      );
      (txnRepo.updateStatus as jest.Mock)
        .mockResolvedValueOnce(refundPendingTxn)
        .mockResolvedValueOnce(null); // refunded lock lost

      await handler.handle(makeEvent());

      expect(txnRepo.updateStatus).toHaveBeenNthCalledWith(
        2,
        'txn-1',
        'refunded',
        7,
        expect.any(Object),
      );
    });

    it('does not throw even when txnRepo.findCompletedByOrderId throws', async () => {
      const { handler, txnRepo } = buildHandler();
      (txnRepo.findCompletedByOrderId as jest.Mock).mockRejectedValue(
        new Error('DB error'),
      );

      await expect(handler.handle(makeEvent())).resolves.toBeUndefined();
    });

    it('does not throw even when updateStatus throws unexpectedly', async () => {
      const { handler, txnRepo } = buildHandler();
      (txnRepo.findCompletedByOrderId as jest.Mock).mockResolvedValue(
        makeTxn(),
      );
      (txnRepo.updateStatus as jest.Mock).mockRejectedValue(
        new Error('Unexpected DB error'),
      );

      await expect(handler.handle(makeEvent())).resolves.toBeUndefined();
    });

    it('includes refundInitiatedAt in the first updateStatus call', async () => {
      const { handler, txnRepo } = buildHandler();
      (txnRepo.findCompletedByOrderId as jest.Mock).mockResolvedValue(
        makeTxn(),
      );
      (txnRepo.updateStatus as jest.Mock).mockResolvedValue(null);

      await handler.handle(makeEvent());

      const [, , , extras] = (txnRepo.updateStatus as jest.Mock).mock
        .calls[0] as [string, string, string, { refundInitiatedAt: Date }];
      expect(extras.refundInitiatedAt).toBeInstanceOf(Date);
    });
  });
});
