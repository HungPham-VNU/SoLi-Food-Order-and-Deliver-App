import type { ConfigType } from '@nestjs/config';
import { vnpayConfig } from '@/config/vnpay.config';
import { PaymentInitiationFailedError } from '@/shared/ports/payment-initiation.port';
import { PaymentService } from './payment.service';
import { VNPayService } from './vnpay.service';
import { PaymentTransactionRepository } from '../repositories/payment-transaction.repository';
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
    amount: 120000,
    status: 'pending',
    paymentUrl: null,
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

function buildService(timeoutSec = 1800) {
  const vnpayService = {
    buildPaymentUrl: jest
      .fn()
      .mockReturnValue('https://pay.vnpay.vn/?token=abc'),
  } as unknown as VNPayService;

  const txnRepo = {
    create: jest.fn().mockResolvedValue(makeTxn()),
    updateToAwaitingIpn: jest
      .fn()
      .mockResolvedValue(makeTxn({ status: 'awaiting_ipn' })),
    findById: jest.fn().mockResolvedValue(makeTxn()),
    updateStatus: jest.fn().mockResolvedValue(makeTxn({ status: 'failed' })),
    findByCustomerId: jest.fn().mockResolvedValue([]),
  } as unknown as PaymentTransactionRepository;

  const config: ConfigType<typeof vnpayConfig> = {
    tmnCode: 'STUB_TMN',
    hashSecret: 'STUB_SECRET',
    url: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    returnUrl: 'http://localhost:3000/api/payments/vnpay/return',
    mobileReturnUrl: 'uitfood://payment/vnpay-return',
    sessionTimeoutSeconds: timeoutSec,
  };

  const service = new PaymentService(vnpayService, txnRepo, config);

  return { service, vnpayService, txnRepo, config };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PaymentService', () => {
  describe('initiateVNPayPayment', () => {
    it('returns txnId and paymentUrl on success', async () => {
      const { service, txnRepo } = buildService();
      (txnRepo.create as jest.Mock).mockResolvedValue(makeTxn());

      const result = await service.initiateVNPayPayment(
        'order-1',
        'cust-1',
        120000,
        '127.0.0.1',
      );

      expect(typeof result.txnId).toBe('string');
      expect(result.paymentUrl).toBe('https://pay.vnpay.vn/?token=abc');
    });

    it('creates a PaymentTransaction before building the VNPay URL', async () => {
      const { service, txnRepo, vnpayService } = buildService();
      const createOrder: string[] = [];
      (txnRepo.create as jest.Mock).mockImplementation(() => {
        createOrder.push('create');
        return makeTxn();
      });
      (vnpayService.buildPaymentUrl as jest.Mock).mockImplementation(() => {
        createOrder.push('buildUrl');
        return 'https://pay.vnpay.vn/?token=xyz';
      });

      await service.initiateVNPayPayment('o1', 'c1', 100000, '1.2.3.4');

      expect(createOrder).toEqual(['create', 'buildUrl']);
    });

    it('creates PaymentTransaction with status=pending', async () => {
      const { service, txnRepo } = buildService();
      let capturedData: Record<string, unknown> = {};
      (txnRepo.create as jest.Mock).mockImplementation(
        (data: Record<string, unknown>) => {
          capturedData = data;
          return makeTxn();
        },
      );

      await service.initiateVNPayPayment('o1', 'c1', 100000, '1.2.3.4');

      expect(capturedData.status).toBe('pending');
      expect(capturedData.version).toBe(0);
    });

    it('passes amount, orderId, customerId, and ipAddr to underlying calls', async () => {
      const { service, txnRepo, vnpayService } = buildService();
      (txnRepo.create as jest.Mock).mockResolvedValue(
        makeTxn({ amount: 99000 }),
      );

      await service.initiateVNPayPayment('ord-42', 'usr-7', 99000, '10.0.0.1');

      expect(txnRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'ord-42',
          customerId: 'usr-7',
          amount: 99000,
        }),
      );
      expect(vnpayService.buildPaymentUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 99000,
          ipAddr: '10.0.0.1',
        }),
      );
    });

    it('calls updateToAwaitingIpn with version=0 after URL generation', async () => {
      const { service, txnRepo } = buildService();
      (txnRepo.create as jest.Mock).mockResolvedValue(makeTxn({ version: 0 }));

      await service.initiateVNPayPayment('o1', 'c1', 100000, '1.2.3.4');

      expect(txnRepo.updateToAwaitingIpn).toHaveBeenCalledWith(
        expect.any(String), // txnId
        'https://pay.vnpay.vn/?token=abc',
        0,
      );
    });

    it('still returns a result when updateToAwaitingIpn returns null (lock mismatch)', async () => {
      const { service, txnRepo } = buildService();
      (txnRepo.updateToAwaitingIpn as jest.Mock).mockResolvedValue(null);

      const result = await service.initiateVNPayPayment(
        'o1',
        'c1',
        100000,
        '1.2.3.4',
      );

      expect(result.paymentUrl).toBeDefined();
    });

    it('propagates error when txnRepo.create throws', async () => {
      const { service, txnRepo } = buildService();
      (txnRepo.create as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(
        service.initiateVNPayPayment('o1', 'c1', 100000, '1.2.3.4'),
      ).rejects.toMatchObject({
        phase: 'transaction_create',
      });
      await expect(
        service.initiateVNPayPayment('o1', 'c1', 100000, '1.2.3.4'),
      ).rejects.toBeInstanceOf(PaymentInitiationFailedError);
    });

    it('marks the transaction failed when VNPay URL generation throws', async () => {
      const { service, vnpayService, txnRepo } = buildService();
      (vnpayService.buildPaymentUrl as jest.Mock).mockImplementation(() => {
        throw new Error('bad VNPay config');
      });

      await expect(
        service.initiateVNPayPayment('o1', 'c1', 100000, '1.2.3.4'),
      ).rejects.toMatchObject({
        phase: 'url_generation',
      });

      expect(txnRepo.updateStatus).toHaveBeenCalledWith('txn-1', 'failed', 0);
    });

    it('marks the transaction failed when awaiting_ipn update throws', async () => {
      const { service, txnRepo } = buildService();
      (txnRepo.updateToAwaitingIpn as jest.Mock).mockRejectedValue(
        new Error('update failed'),
      );

      await expect(
        service.initiateVNPayPayment('o1', 'c1', 100000, '1.2.3.4'),
      ).rejects.toMatchObject({
        phase: 'transaction_update',
      });

      expect(txnRepo.updateStatus).toHaveBeenCalledWith('txn-1', 'failed', 0);
    });

    it('uses PAYMENT_SESSION_TIMEOUT_SECONDS from config to compute expiresAt', async () => {
      const { service, txnRepo } = buildService(3600);
      const before = Date.now();
      let capturedExpiresAt: Date | null = null;
      (txnRepo.create as jest.Mock).mockImplementation(
        (data: { expiresAt: Date }) => {
          capturedExpiresAt = data.expiresAt;
          return makeTxn();
        },
      );

      await service.initiateVNPayPayment('o1', 'c1', 100000, '1.2.3.4');

      const after = Date.now();
      const expiresMs = capturedExpiresAt!.getTime();
      // expiresAt should be ~3600s from now
      expect(expiresMs).toBeGreaterThanOrEqual(before + 3600_000 - 100);
      expect(expiresMs).toBeLessThanOrEqual(after + 3600_000 + 100);
    });
  });

  describe('getMyPayments', () => {
    it('returns transactions from repository', async () => {
      const { service, txnRepo } = buildService();
      const txns = [makeTxn(), makeTxn({ id: 'txn-2' })];
      (txnRepo.findByCustomerId as jest.Mock).mockResolvedValue(txns);

      const result = await service.getMyPayments('cust-1');

      expect(result).toHaveLength(2);
    });

    it('passes customerId to the repository', async () => {
      const { service, txnRepo } = buildService();
      (txnRepo.findByCustomerId as jest.Mock).mockResolvedValue([]);

      await service.getMyPayments('cust-99');

      expect(txnRepo.findByCustomerId).toHaveBeenCalledWith('cust-99');
    });

    it('returns empty array when no payments exist', async () => {
      const { service, txnRepo } = buildService();
      (txnRepo.findByCustomerId as jest.Mock).mockResolvedValue([]);

      const result = await service.getMyPayments('cust-1');

      expect(result).toEqual([]);
    });
  });
});
