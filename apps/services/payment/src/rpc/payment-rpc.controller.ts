import { Controller, ForbiddenException } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  PAYMENT_RPC_PATTERNS,
  paymentAttemptCreateRequestSchema,
  paymentAttemptFailRequestSchema,
  paymentPendingCancelRequestSchema,
  paymentTransactionsMineRequestSchema,
  paymentIpnProcessRequestSchema,
  paymentReturnResolveRequestSchema,
} from '@uitfood/contracts';
import { InternalAuthService } from '@/auth/internal-auth.service';
import { PaymentService } from '@/payment/services/payment.service';
import { PaymentTransactionRepository } from '@/payment/repositories/payment-transaction.repository';
import { VNPayService } from '@/payment/services/vnpay.service';
import { ProcessIpnCommand } from '@/payment/commands/process-ipn.command';
import { ProcessIpnHandler } from '@/payment/commands/process-ipn.handler';
import { vnpayConfig } from '@/config/vnpay.config';
import { Inject } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { asPaymentRpcException } from './payment-rpc.errors';

interface ReturnUrlResponse {
  txnRef: string;
  orderId: string;
  status: string;
  signatureValid: boolean;
  vnpResponseCode: string | null;
}

@Controller()
export class PaymentRpcController {
  constructor(
    private readonly auth: InternalAuthService,
    private readonly payments: PaymentService,
    private readonly txnRepo: PaymentTransactionRepository,
    private readonly vnpayService: VNPayService,
    private readonly processIpn: ProcessIpnHandler,
    @Inject(vnpayConfig.KEY)
    private readonly config: ConfigType<typeof vnpayConfig>,
  ) {}

  @MessagePattern(PAYMENT_RPC_PATTERNS.createAttempt)
  async createAttempt(payload: unknown) {
    try {
      const request = paymentAttemptCreateRequestSchema.parse(payload);
      const caller = this.auth.verifyPaymentToken(request.internalAuth);
      this.requireService(caller);
      return this.payments.initiateVNPayPayment(
        request.orderId,
        request.customerId,
        request.amount,
        request.ipAddr,
      );
    } catch (error) {
      throw asPaymentRpcException(error);
    }
  }

  @MessagePattern(PAYMENT_RPC_PATTERNS.markAttemptFailed)
  async markAttemptFailed(payload: unknown) {
    try {
      const request = paymentAttemptFailRequestSchema.parse(payload);
      const caller = this.auth.verifyPaymentToken(request.internalAuth);
      this.requireService(caller);
      await this.payments.markPaymentAttemptFailed(
        request.txnId,
        request.reason,
      );
      return { ok: true };
    } catch (error) {
      throw asPaymentRpcException(error);
    }
  }

  @MessagePattern(PAYMENT_RPC_PATTERNS.cancelPendingAttempt)
  async cancelPendingAttempt(payload: unknown) {
    try {
      const request = paymentPendingCancelRequestSchema.parse(payload);
      const caller = this.auth.verifyPaymentToken(request.internalAuth);
      if (!caller.isService && caller.userId !== request.customerId) {
        throw new ForbiddenException(
          'You can only cancel your own VNPay payments.',
        );
      }
      return this.payments.cancelPendingPaymentForOrder(
        request.orderId,
        request.customerId,
        request.reason,
      );
    } catch (error) {
      throw asPaymentRpcException(error);
    }
  }

  @MessagePattern(PAYMENT_RPC_PATTERNS.processIpn)
  async processIpnCallback(payload: unknown) {
    try {
      const request = paymentIpnProcessRequestSchema.parse(payload);
      return this.processIpn.execute(new ProcessIpnCommand(request.query));
    } catch (error) {
      throw asPaymentRpcException(error);
    }
  }

  @MessagePattern(PAYMENT_RPC_PATTERNS.resolveReturn)
  async resolveReturn(payload: unknown): Promise<ReturnUrlResponse> {
    try {
      const request = paymentReturnResolveRequestSchema.parse(payload);
      return this.resolveReturnUrlResponse(request.query);
    } catch (error) {
      throw asPaymentRpcException(error);
    }
  }

  @MessagePattern(PAYMENT_RPC_PATTERNS.resolveMobileReturn)
  async resolveMobileReturn(
    payload: unknown,
  ): Promise<{ redirectUrl: string }> {
    try {
      const request = paymentReturnResolveRequestSchema.parse(payload);
      const response = await this.resolveReturnUrlResponse(request.query);
      return { redirectUrl: this.buildMobileReturnRedirectUrl(response) };
    } catch (error) {
      throw asPaymentRpcException(error);
    }
  }

  @MessagePattern(PAYMENT_RPC_PATTERNS.listMyTransactions)
  async listMyTransactions(payload: unknown) {
    try {
      const request = paymentTransactionsMineRequestSchema.parse(payload);
      const caller = this.auth.verifyPaymentToken(request.internalAuth);
      const transactions = await this.payments.getMyPayments(caller.userId);
      return transactions.map((txn) => ({
        id: txn.id,
        orderId: txn.orderId,
        amount: txn.amount,
        status: txn.status,
        paidAt: txn.paidAt ?? null,
        providerTxnId: txn.providerTxnId ?? null,
        createdAt: txn.createdAt,
      }));
    } catch (error) {
      throw asPaymentRpcException(error);
    }
  }

  private requireService(caller: { isService: boolean }): void {
    if (!caller.isService) {
      throw new ForbiddenException('Service credentials are required.');
    }
  }

  private async resolveReturnUrlResponse(
    query: Record<string, string>,
  ): Promise<ReturnUrlResponse> {
    const txnRef = query['vnp_TxnRef'];
    const { valid: signatureValid } = this.vnpayService.verifyReturn(query);

    if (!txnRef) {
      return {
        txnRef: '',
        orderId: '',
        status: 'unknown',
        signatureValid,
        vnpResponseCode: query['vnp_ResponseCode'] ?? null,
      };
    }

    const txn = await this.txnRepo.findById(txnRef);
    if (!txn) {
      return {
        txnRef,
        orderId: '',
        status: 'unknown',
        signatureValid,
        vnpResponseCode: query['vnp_ResponseCode'] ?? null,
      };
    }

    return {
      txnRef: txn.id,
      orderId: txn.orderId,
      status: txn.status,
      signatureValid,
      vnpResponseCode: txn.vnpResponseCode ?? query['vnp_ResponseCode'] ?? null,
    };
  }

  private buildMobileReturnRedirectUrl(response: ReturnUrlResponse): string {
    const url = new URL(this.config.mobileReturnUrl);
    url.searchParams.set('txnRef', response.txnRef);
    url.searchParams.set('orderId', response.orderId);
    url.searchParams.set('status', response.status);
    url.searchParams.set('signatureValid', String(response.signatureValid));
    if (response.vnpResponseCode) {
      url.searchParams.set('vnpResponseCode', response.vnpResponseCode);
    }
    return url.toString();
  }
}
