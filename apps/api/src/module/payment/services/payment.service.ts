import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  IPaymentInitiationPort,
  PaymentInitiationFailedError,
} from '@/shared/ports/payment-initiation.port';
import { VNPayService } from './vnpay.service';
import { PaymentTransactionRepository } from '../repositories/payment-transaction.repository';
import type { PaymentTransaction } from '../domain/payment-transaction.schema';
import { runObserved } from '@/observability/trace';
import { vnpayConfig } from '@/config/vnpay.config';

/**
 * PaymentService
 *
 * Orchestrates the full payment initiation flow for the Payment BC.
 * Implements IPaymentInitiationPort so it can be injected into the
 * Ordering BC via the DIP token PAYMENT_INITIATION_PORT.
 *
 * Flow for VNPay:
 *   1. Create PaymentTransaction with status='pending' (DB first-write guarantee).
 *   2. Build VNPay payment URL (pure computation in VNPayService).
 *   3. Update PaymentTransaction to status='awaiting_ipn' + store URL.
 *   4. Return { txnId, paymentUrl } to PlaceOrderHandler.
 *
 * Failure handling:
 *   - If step 1 fails: a typed PaymentInitiationFailedError is propagated.
 *   - If step 2/3 fails: the PaymentTransaction is marked failed before the
 *     typed error is propagated. Ordering rejects VNPay checkout when initiation
 *     fails, so successful VNPay order placement always has a payment session.
 *
 * This class does NOT:
 *   - Call any Ordering BC service or repository.
 *   - Publish domain events directly (events are fired from IPN handler, Phase 8.3).
 */
@Injectable()
export class PaymentService implements IPaymentInitiationPort {
  private readonly logger = new Logger(PaymentService.name);
  private readonly sessionTimeoutMs: number;

  constructor(
    private readonly vnpayService: VNPayService,
    private readonly txnRepo: PaymentTransactionRepository,
    @Inject(vnpayConfig.KEY)
    private readonly config: ConfigType<typeof vnpayConfig>,
  ) {
    // sessionTimeoutSeconds is already validated and parsed by the Zod schema in
    // env.schema.ts - no manual parseInt / fallback needed here.
    this.sessionTimeoutMs = config.sessionTimeoutSeconds * 1_000;
  }

  /**
   * @inheritdoc IPaymentInitiationPort.initiateVNPayPayment
   */
  async initiateVNPayPayment(
    orderId: string,
    customerId: string,
    amount: number,
    ipAddr: string,
  ): Promise<{ txnId: string; paymentUrl: string }> {
    return runObserved(
      'payment.initiate',
      {
        orderId,
        customerId,
        amount,
        provider: 'vnpay',
      },
      () =>
        this.initiateVNPayPaymentInternal(orderId, customerId, amount, ipAddr),
    );
  }

  private async initiateVNPayPaymentInternal(
    orderId: string,
    customerId: string,
    amount: number,
    ipAddr: string,
  ): Promise<{ txnId: string; paymentUrl: string }> {
    const txnId = randomUUID();
    const expiresAt = new Date(Date.now() + this.sessionTimeoutMs);

    // -------------------------------------------------------------------------
    // Step 1: Persist PaymentTransaction in 'pending' state.
    //
    // Writing to DB BEFORE generating the VNPay URL is intentional:
    //   - If this fails, we don't waste a VNPay session.
    //   - The record serves as the idempotency anchor for the entire flow.
    // -------------------------------------------------------------------------
    try {
      await this.txnRepo.create({
        id: txnId,
        orderId,
        customerId,
        amount,
        status: 'pending',
        expiresAt,
        version: 0,
      });
    } catch (err) {
      throw new PaymentInitiationFailedError(
        'Failed to create VNPay payment transaction.',
        'transaction_create',
        err,
      );
    }

    this.logger.log(
      `PaymentTransaction ${txnId} created (pending) for order=${orderId} amount=${amount}`,
    );

    // -------------------------------------------------------------------------
    // Step 2: Generate VNPay redirect URL.
    //
    // VNPayService.buildPaymentUrl() is a pure function â€” it throws only if
    // config is misconfigured (caught at startup in onModuleInit) or the
    // input params are invalid.
    // -------------------------------------------------------------------------
    let paymentUrl: string;
    try {
      paymentUrl = this.vnpayService.buildPaymentUrl({
        txnRef: txnId,
        amount,
        ipAddr,
      });
    } catch (err) {
      await this.markPaymentAttemptFailed(
        txnId,
        'VNPay payment URL generation failed',
      );
      throw new PaymentInitiationFailedError(
        'Failed to build VNPay payment URL.',
        'url_generation',
        err,
      );
    }

    // -------------------------------------------------------------------------
    // Step 3: Transition to 'awaiting_ipn' and store the URL.
    //
    // Uses optimistic locking (version=0). This is safe here because the record
    // was just created and no other process could have incremented the version.
    // If this write fails, the record stays in 'pending'. PaymentTimeoutTask
    // handles recovery automatically (fail-safe, not fail-secure).
    // -------------------------------------------------------------------------
    let updated: PaymentTransaction | null;
    try {
      updated = await this.txnRepo.updateToAwaitingIpn(txnId, paymentUrl, 0);
    } catch (err) {
      await this.markPaymentAttemptFailed(
        txnId,
        'VNPay payment transaction update failed after URL generation',
      );
      throw new PaymentInitiationFailedError(
        'Failed to update VNPay payment transaction.',
        'transaction_update',
        err,
      );
    }

    if (!updated) {
      // Log but don't throw: VNPay URL was already generated.
      // The 'pending' record will be expired by PaymentTimeoutTask.
      this.logger.warn(
        `PaymentTransaction ${txnId}: status update to awaiting_ipn failed ` +
          `(optimistic lock mismatch â€” should not happen at creation time)`,
      );
    } else {
      this.logger.log(
        `PaymentTransaction ${txnId} â†’ awaiting_ipn for order=${orderId}`,
      );
    }

    return { txnId, paymentUrl };
  }

  /**
   * Returns the caller's payment transactions ordered newest-first.
   * Used by GET /payments/my (Phase 8.7).
   *
   * Fields with sensitive details (rawIpnPayload, paymentUrl) are stripped
   * from the returned objects â€” callers receive only the subset needed for
   * display. The raw objects are typed as PaymentTransaction; the controller
   * applies the response DTO mapping.
   */
  async getMyPayments(customerId: string): Promise<PaymentTransaction[]> {
    return this.txnRepo.findByCustomerId(customerId);
  }

  async cancelPendingPaymentForOrder(
    orderId: string,
    customerId: string,
    reason = 'Customer cancelled VNPay payment',
  ): Promise<PaymentTransaction> {
    const txn = await this.txnRepo.findByOrderId(orderId);

    if (!txn) {
      throw new NotFoundException(
        `VNPay payment transaction for order ${orderId} not found.`,
      );
    }

    if (txn.customerId !== customerId) {
      throw new ForbiddenException(
        'You can only cancel your own VNPay payments.',
      );
    }

    if (txn.status === 'failed') {
      this.logger.log(
        `cancelPendingPaymentForOrder: txn=${txn.id} already failed. reason=${reason}`,
      );
      return txn;
    }

    if (
      txn.status === 'completed' ||
      txn.status === 'refund_pending' ||
      txn.status === 'refunded'
    ) {
      throw new UnprocessableEntityException(
        'This VNPay payment has already completed and cannot be cancelled.',
      );
    }

    const updated = await this.txnRepo.updateStatus(
      txn.id,
      'failed',
      txn.version,
    );

    if (!updated) {
      throw new ConflictException(
        'Payment status changed while cancellation was being processed. Please refresh and try again.',
      );
    }

    this.logger.warn(
      `PaymentTransaction ${txn.id} manually cancelled for order=${orderId}. reason=${reason}`,
    );

    return updated;
  }

  async markPaymentAttemptFailed(txnId: string, reason: string): Promise<void> {
    try {
      const txn = await this.txnRepo.findById(txnId);
      if (!txn) {
        this.logger.warn(
          `markPaymentAttemptFailed: txn=${txnId} not found. reason=${reason}`,
        );
        return;
      }

      if (
        txn.status === 'completed' ||
        txn.status === 'failed' ||
        txn.status === 'refund_pending' ||
        txn.status === 'refunded'
      ) {
        this.logger.log(
          `markPaymentAttemptFailed: txn=${txnId} already terminal (${txn.status}). reason=${reason}`,
        );
        return;
      }

      await this.txnRepo.updateStatus(txn.id, 'failed', txn.version);
      this.logger.warn(
        `PaymentTransaction ${txnId} marked failed. reason=${reason}`,
      );
    } catch (err) {
      throw new PaymentInitiationFailedError(
        `Failed to mark VNPay payment transaction ${txnId} as failed.`,
        'transaction_fail',
        err,
      );
    }
  }
}
