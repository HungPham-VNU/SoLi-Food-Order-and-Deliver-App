import { EVENT_NAMES } from '@uitfood/contracts';
import { ProcessIpnHandler } from './process-ipn.handler';
import { ProcessIpnCommand } from './process-ipn.command';
import { VNPayService } from '../services/vnpay.service';
import { PaymentTransactionRepository } from '../repositories/payment-transaction.repository';

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PaymentTransaction } from '../domain/payment-transaction.schema';

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
    status: 'awaiting_ipn',
    paymentUrl: 'https://pay.vnpay.vn/...',
    providerTxnId: null,
    vnpResponseCode: null,
    rawIpnPayload: null,
    ipnReceivedAt: null,
    paidAt: null,
    refundInitiatedAt: null,
    refundedAt: null,
    refundRetryCount: null,
    expiresAt: new Date(Date.now() + 3600_000),
    version: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as PaymentTransaction;
}

function makeSuccessVerification(
  overrides: Partial<{
    txnRef: string;
    providerTxnId: string;
    amount: number;
    responsePaid: boolean;
  }> = {},
) {
  return {
    valid: true,
    txnRef: overrides.txnRef ?? 'txn-1',
    providerTxnId: overrides.providerTxnId ?? 'vnpay-txn-1',
    amount: overrides.amount ?? 150000,
    responsePaid: overrides.responsePaid ?? true,
  };
}

/** Returns the eventTypes recorded to the outbox across all write() calls. */
function writtenEventTypes(outbox: { write: jest.Mock }): string[] {
  return outbox.write.mock.calls.map(
    (c) => (c[1] as { eventType: string }).eventType,
  );
}

function buildHandler() {
  const vnpayService = {
    verifyIpn: jest.fn(),
  } as unknown as VNPayService;

  const txnRepo = {
    findById: jest.fn(),
    updateStatus: jest.fn(),
  } as unknown as PaymentTransactionRepository;

  const outbox = { write: jest.fn().mockResolvedValue(undefined) };

  // db.transaction(cb) simply runs the callback with a stub tx object; the
  // repo and outbox are mocked, so the tx's identity is irrelevant.
  const db = {
    transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) =>
      cb({}),
    ),
  } as unknown as NodePgDatabase;

  const handler = new ProcessIpnHandler(db, vnpayService, txnRepo, outbox);

  return { handler, vnpayService, txnRepo, outbox };
}

function makeCommand(query: Record<string, string> = {}): ProcessIpnCommand {
  return new ProcessIpnCommand({
    vnp_TxnRef: 'txn-1',
    vnp_TransactionNo: 'vnpay-txn-1',
    vnp_Amount: '15000000',
    vnp_ResponseCode: '00',
    vnp_TransactionStatus: '00',
    vnp_SecureHash: 'abc123',
    ...query,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProcessIpnHandler', () => {
  describe('invalid signature', () => {
    it('returns RspCode 97 when signature is invalid', async () => {
      const { handler, vnpayService } = buildHandler();
      (vnpayService.verifyIpn as jest.Mock).mockReturnValue({ valid: false });

      const result = await handler.execute(makeCommand());

      expect(result.RspCode).toBe('97');
    });

    it('does not call txnRepo when signature is invalid', async () => {
      const { handler, vnpayService, txnRepo } = buildHandler();
      (vnpayService.verifyIpn as jest.Mock).mockReturnValue({ valid: false });

      await handler.execute(makeCommand());

      expect(txnRepo.findById).not.toHaveBeenCalled();
    });
  });

  describe('transaction not found', () => {
    it('returns RspCode 01 when txnRef is not in DB', async () => {
      const { handler, vnpayService, txnRepo } = buildHandler();
      (vnpayService.verifyIpn as jest.Mock).mockReturnValue(
        makeSuccessVerification(),
      );
      (txnRepo.findById as jest.Mock).mockResolvedValue(null);

      const result = await handler.execute(makeCommand());

      expect(result.RspCode).toBe('01');
    });
  });

  describe('idempotency', () => {
    it.each([['completed'], ['refund_pending'], ['refunded']] as const)(
      'returns RspCode 00 immediately when transaction is already %s',
      async (status) => {
        const { handler, vnpayService, txnRepo, outbox } = buildHandler();
        (vnpayService.verifyIpn as jest.Mock).mockReturnValue(
          makeSuccessVerification(),
        );
        (txnRepo.findById as jest.Mock).mockResolvedValue(makeTxn({ status }));

        const result = await handler.execute(makeCommand());

        expect(result.RspCode).toBe('00');
        expect(txnRepo.updateStatus).not.toHaveBeenCalled();
        expect(outbox.write).not.toHaveBeenCalled();
      },
    );

    it('returns RspCode 00 immediately when transaction is already failed and IPN is unpaid', async () => {
      const { handler, vnpayService, txnRepo, outbox } = buildHandler();
      (vnpayService.verifyIpn as jest.Mock).mockReturnValue(
        makeSuccessVerification({ responsePaid: false }),
      );
      (txnRepo.findById as jest.Mock).mockResolvedValue(
        makeTxn({ status: 'failed' }),
      );

      const result = await handler.execute(
        makeCommand({ vnp_ResponseCode: '24', vnp_TransactionStatus: '02' }),
      );

      expect(result.RspCode).toBe('00');
      expect(txnRepo.updateStatus).not.toHaveBeenCalled();
      expect(outbox.write).not.toHaveBeenCalled();
    });
  });

  describe('amount mismatch', () => {
    it('returns RspCode 04 when IPN amount differs from stored amount', async () => {
      const { handler, vnpayService, txnRepo } = buildHandler();
      (vnpayService.verifyIpn as jest.Mock).mockReturnValue(
        makeSuccessVerification({ amount: 200000 }),
      );
      (txnRepo.findById as jest.Mock).mockResolvedValue(
        makeTxn({ amount: 150000 }),
      );
      (txnRepo.updateStatus as jest.Mock).mockResolvedValue(
        makeTxn({ status: 'failed' }),
      );

      const result = await handler.execute(makeCommand());

      expect(result.RspCode).toBe('04');
    });

    it('records a payment.failed outbox event when amount mismatches and lock is won', async () => {
      const { handler, vnpayService, txnRepo, outbox } = buildHandler();
      (vnpayService.verifyIpn as jest.Mock).mockReturnValue(
        makeSuccessVerification({ amount: 200000 }),
      );
      (txnRepo.findById as jest.Mock).mockResolvedValue(
        makeTxn({ amount: 150000 }),
      );
      (txnRepo.updateStatus as jest.Mock).mockResolvedValue(
        makeTxn({ status: 'failed' }),
      );

      await handler.execute(makeCommand());

      expect(writtenEventTypes(outbox)).toContain(EVENT_NAMES.PaymentFailed);
    });

    it('does not record an event when optimistic lock is lost on amount mismatch', async () => {
      const { handler, vnpayService, txnRepo, outbox } = buildHandler();
      (vnpayService.verifyIpn as jest.Mock).mockReturnValue(
        makeSuccessVerification({ amount: 200000 }),
      );
      (txnRepo.findById as jest.Mock).mockResolvedValue(
        makeTxn({ amount: 150000 }),
      );
      (txnRepo.updateStatus as jest.Mock).mockResolvedValue(null); // lock lost

      await handler.execute(makeCommand());

      expect(outbox.write).not.toHaveBeenCalled();
    });
  });

  describe('payment success (responsePaid=true)', () => {
    it('returns RspCode 00 on successful payment', async () => {
      const { handler, vnpayService, txnRepo } = buildHandler();
      (vnpayService.verifyIpn as jest.Mock).mockReturnValue(
        makeSuccessVerification(),
      );
      (txnRepo.findById as jest.Mock).mockResolvedValue(makeTxn());
      (txnRepo.updateStatus as jest.Mock).mockResolvedValue(
        makeTxn({ status: 'completed' }),
      );

      const result = await handler.execute(makeCommand());

      expect(result.RspCode).toBe('00');
    });

    it('records a payment.confirmed outbox event after successful update', async () => {
      const { handler, vnpayService, txnRepo, outbox } = buildHandler();
      (vnpayService.verifyIpn as jest.Mock).mockReturnValue(
        makeSuccessVerification(),
      );
      (txnRepo.findById as jest.Mock).mockResolvedValue(makeTxn());
      (txnRepo.updateStatus as jest.Mock).mockResolvedValue(
        makeTxn({ status: 'completed' }),
      );

      await handler.execute(makeCommand());

      expect(writtenEventTypes(outbox)).toContain(EVENT_NAMES.PaymentConfirmed);
    });

    it('payment.confirmed payload carries correct orderId and amount', async () => {
      const { handler, vnpayService, txnRepo, outbox } = buildHandler();
      (vnpayService.verifyIpn as jest.Mock).mockReturnValue(
        makeSuccessVerification({ amount: 150000 }),
      );
      (txnRepo.findById as jest.Mock).mockResolvedValue(
        makeTxn({ orderId: 'order-99', amount: 150000 }),
      );
      (txnRepo.updateStatus as jest.Mock).mockResolvedValue(
        makeTxn({ status: 'completed' }),
      );

      await handler.execute(makeCommand());

      const [, envelope] = outbox.write.mock.calls[0] as [
        unknown,
        { payload: { orderId: string; amount: number } },
      ];
      expect(envelope.payload.orderId).toBe('order-99');
      expect(envelope.payload.amount).toBe(150000);
    });

    it('calls updateStatus with toStatus=completed, current version, and a tx', async () => {
      const { handler, vnpayService, txnRepo } = buildHandler();
      (vnpayService.verifyIpn as jest.Mock).mockReturnValue(
        makeSuccessVerification(),
      );
      (txnRepo.findById as jest.Mock).mockResolvedValue(
        makeTxn({ version: 3 }),
      );
      (txnRepo.updateStatus as jest.Mock).mockResolvedValue(
        makeTxn({ status: 'completed', version: 4 }),
      );

      await handler.execute(makeCommand());

      expect(txnRepo.updateStatus).toHaveBeenCalledWith(
        'txn-1',
        'completed',
        3,
        expect.any(Object),
        expect.anything(),
      );
    });

    it('returns RspCode 00 even when optimistic lock is lost (concurrent handler won)', async () => {
      const { handler, vnpayService, txnRepo } = buildHandler();
      (vnpayService.verifyIpn as jest.Mock).mockReturnValue(
        makeSuccessVerification(),
      );
      (txnRepo.findById as jest.Mock)
        .mockResolvedValueOnce(makeTxn())
        .mockResolvedValueOnce(makeTxn({ status: 'completed' }));
      (txnRepo.updateStatus as jest.Mock).mockResolvedValue(null); // lock lost

      const result = await handler.execute(makeCommand());

      expect(result.RspCode).toBe('00');
    });

    it('queues refund instead of confirming when a paid IPN arrives after failure', async () => {
      const { handler, vnpayService, txnRepo, outbox } = buildHandler();
      (vnpayService.verifyIpn as jest.Mock).mockReturnValue(
        makeSuccessVerification({ amount: 150000, responsePaid: true }),
      );
      (txnRepo.findById as jest.Mock).mockResolvedValue(
        makeTxn({
          status: 'failed',
          orderId: 'order-late-paid',
          customerId: 'cust-late-paid',
          amount: 150000,
        }),
      );
      (txnRepo.updateStatus as jest.Mock).mockResolvedValue(
        makeTxn({ status: 'completed' }),
      );

      const result = await handler.execute(makeCommand());

      expect(result.RspCode).toBe('00');
      expect(txnRepo.updateStatus).toHaveBeenCalledWith(
        'txn-1',
        'completed',
        0,
        expect.any(Object),
        expect.anything(),
      );
      const types = writtenEventTypes(outbox);
      expect(types).toContain(EVENT_NAMES.OrderingOrderCancelledAfterPayment);
      expect(types).not.toContain(EVENT_NAMES.PaymentConfirmed);
    });
  });

  describe('payment failure (responsePaid=false)', () => {
    it('returns RspCode 00 after processing a declined payment', async () => {
      const { handler, vnpayService, txnRepo } = buildHandler();
      (vnpayService.verifyIpn as jest.Mock).mockReturnValue(
        makeSuccessVerification({ responsePaid: false }),
      );
      (txnRepo.findById as jest.Mock).mockResolvedValue(makeTxn());
      (txnRepo.updateStatus as jest.Mock).mockResolvedValue(
        makeTxn({ status: 'failed' }),
      );

      const result = await handler.execute(
        makeCommand({ vnp_ResponseCode: '09' }),
      );

      expect(result.RspCode).toBe('00');
    });

    it('records a payment.failed outbox event on declined payment', async () => {
      const { handler, vnpayService, txnRepo, outbox } = buildHandler();
      (vnpayService.verifyIpn as jest.Mock).mockReturnValue(
        makeSuccessVerification({ responsePaid: false }),
      );
      (txnRepo.findById as jest.Mock).mockResolvedValue(makeTxn());
      (txnRepo.updateStatus as jest.Mock).mockResolvedValue(
        makeTxn({ status: 'failed' }),
      );

      await handler.execute(makeCommand({ vnp_ResponseCode: '09' }));

      expect(writtenEventTypes(outbox)).toContain(EVENT_NAMES.PaymentFailed);
    });

    it('does not record an event when optimistic lock is lost on failure', async () => {
      const { handler, vnpayService, txnRepo, outbox } = buildHandler();
      (vnpayService.verifyIpn as jest.Mock).mockReturnValue(
        makeSuccessVerification({ responsePaid: false }),
      );
      (txnRepo.findById as jest.Mock).mockResolvedValue(makeTxn());
      (txnRepo.updateStatus as jest.Mock).mockResolvedValue(null); // lock lost

      await handler.execute(makeCommand());

      expect(outbox.write).not.toHaveBeenCalled();
    });

    it('calls updateStatus with toStatus=failed, current version, and a tx', async () => {
      const { handler, vnpayService, txnRepo } = buildHandler();
      (vnpayService.verifyIpn as jest.Mock).mockReturnValue(
        makeSuccessVerification({ responsePaid: false }),
      );
      (txnRepo.findById as jest.Mock).mockResolvedValue(
        makeTxn({ version: 2 }),
      );
      (txnRepo.updateStatus as jest.Mock).mockResolvedValue(
        makeTxn({ status: 'failed' }),
      );

      await handler.execute(makeCommand({ vnp_ResponseCode: '09' }));

      expect(txnRepo.updateStatus).toHaveBeenCalledWith(
        'txn-1',
        'failed',
        2,
        expect.any(Object),
        expect.anything(),
      );
    });
  });
});
