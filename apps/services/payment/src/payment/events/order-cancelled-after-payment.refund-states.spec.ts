import { OrderCancelledAfterPaymentHandler } from './order-cancelled-after-payment.handler';
import { PaymentTransactionRepository } from '../repositories/payment-transaction.repository';
import { VNPayService } from '../services/vnpay.service';
import { OrderCancelledAfterPaymentEvent } from './order-cancelled-after-payment.event';
import type { PaymentTransaction } from '../domain/payment-transaction.schema';
import type { VNPayConfig } from '@/config/vnpay.config';
import type { VNPayRefundResult } from '../services/vnpay.service';

/**
 * Phase 0 — VNPay refund states (cases 3d / 3e).
 *
 * Asserts the refund state machine the Phase 0 fix introduced:
 *
 *  3d  refund disabled (sandbox / simulated success):
 *        completed → refund_pending → refunded
 *
 *  3e  refund call fails (real call, provider/transport error):
 *        completed → refund_pending  (stays parked)
 *        refundRetryCount incremented; NEVER transitions to 'refunded'
 *
 * These run at the handler level with a mocked repository + VNPayService so the
 * transitions are deterministic and DB-free. (The provider HTTP signing/gating
 * itself lives in vnpay.service and can be covered separately.)
 */

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
    paidAt: new Date('2026-06-20T03:00:00.000Z'),
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

function makeEvent(): OrderCancelledAfterPaymentEvent {
  return new OrderCancelledAfterPaymentEvent(
    'order-1',
    'cust-1',
    'vnpay',
    150000,
    new Date(),
    'admin',
  );
}

function buildHandler(refundResult: VNPayRefundResult) {
  const txnRepo = {
    findCompletedByOrderId: jest.fn(),
    updateStatus: jest.fn(),
  } as unknown as PaymentTransactionRepository;

  const vnpayService = {
    requestRefund: jest.fn().mockResolvedValue(refundResult),
  } as unknown as VNPayService;

  const config = { refundMaxRetries: 5 } as unknown as VNPayConfig;

  const handler = new OrderCancelledAfterPaymentHandler(
    txnRepo,
    vnpayService,
    config,
  );

  return { handler, txnRepo, vnpayService };
}

describe('OrderCancelledAfterPaymentHandler — Phase 0 refund states', () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 3d — refund disabled / simulated success
  // ──────────────────────────────────────────────────────────────────────────

  describe('3d simulated success (VNPAY_REFUND_ENABLED=false)', () => {
    it('drives completed → refund_pending → refunded', async () => {
      const { handler, txnRepo, vnpayService } = buildHandler({
        success: true,
        simulated: true,
        message: 'simulated',
      });

      (txnRepo.findCompletedByOrderId as jest.Mock).mockResolvedValue(
        makeTxn({ status: 'completed', version: 2 }),
      );
      (txnRepo.updateStatus as jest.Mock)
        // completed → refund_pending
        .mockResolvedValueOnce(
          makeTxn({
            status: 'refund_pending',
            version: 3,
            refundRetryCount: null,
          }),
        )
        // refund_pending → refunded
        .mockResolvedValueOnce(makeTxn({ status: 'refunded', version: 4 }));

      await handler.handle(makeEvent());

      // requestRefund called with the Payment BC's ground-truth amount + ids.
      expect(vnpayService.requestRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          txnRef: 'txn-1',
          providerTxnId: 'vnpay-txn-1',
          amount: 150000,
        }),
      );

      const calls = (txnRepo.updateStatus as jest.Mock).mock.calls as [
        string,
        string,
        number,
        Record<string, unknown>,
      ][];
      expect(calls).toHaveLength(2);
      // 1st: completed → refund_pending
      expect(calls[0][1]).toBe('refund_pending');
      // 2nd: refund_pending → refunded
      expect(calls[1][1]).toBe('refunded');
      expect(calls[1][3]).toEqual(
        expect.objectContaining({ refundedAt: expect.any(Date) as unknown }),
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3e — real refund call fails
  // ──────────────────────────────────────────────────────────────────────────

  describe('3e refund call fails (provider/transport error)', () => {
    it('stays refund_pending, increments refundRetryCount, never marks refunded', async () => {
      const { handler, txnRepo, vnpayService } = buildHandler({
        success: false,
        simulated: false,
        responseCode: '99',
        message: 'provider error',
      });

      (txnRepo.findCompletedByOrderId as jest.Mock).mockResolvedValue(
        makeTxn({ status: 'completed', version: 2 }),
      );
      (txnRepo.updateStatus as jest.Mock)
        // completed → refund_pending (refundRetryCount still null here)
        .mockResolvedValueOnce(
          makeTxn({
            status: 'refund_pending',
            version: 3,
            refundRetryCount: null,
          }),
        )
        // retry-count bump (stays refund_pending)
        .mockResolvedValueOnce(
          makeTxn({
            status: 'refund_pending',
            version: 4,
            refundRetryCount: 1,
          }),
        );

      await handler.handle(makeEvent());

      expect(vnpayService.requestRefund).toHaveBeenCalledTimes(1);

      const calls = (txnRepo.updateStatus as jest.Mock).mock.calls as [
        string,
        string,
        number,
        Record<string, unknown>,
      ][];
      expect(calls).toHaveLength(2);

      // 1st: completed → refund_pending
      expect(calls[0][1]).toBe('refund_pending');

      // 2nd: still refund_pending, with refundRetryCount incremented to 1.
      expect(calls[1][1]).toBe('refund_pending');
      expect(calls[1][3]).toEqual(
        expect.objectContaining({ refundRetryCount: 1 }),
      );

      // Never transitioned to 'refunded'.
      const transitionedToRefunded = calls.some((c) => c[1] === 'refunded');
      expect(transitionedToRefunded).toBe(false);
    });
  });
});
