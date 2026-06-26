import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { randomUUID } from 'node:crypto';
import {
  PAYMENT_RPC_PATTERNS,
  paymentAttemptCreateResponseSchema,
  paymentPendingCancelResponseSchema,
  paymentRpcErrorSchema,
  signInternalJwt,
} from '@uitfood/contracts';
import type { Env } from '@/config/env.schema';
import type { IPaymentInitiationPort } from '@/shared/ports/payment-initiation.port';
import { PAYMENT_TCP_CLIENT } from './payment-client.constants';

@Injectable()
export class PaymentInitiationAdapter
  implements IPaymentInitiationPort, OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(PaymentInitiationAdapter.name);

  constructor(
    @Inject(PAYMENT_TCP_CLIENT) private readonly client: ClientProxy,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get('PAYMENT_RPC_REQUIRED', { infer: true })) {
      await this.client.connect();
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }

  async initiateVNPayPayment(
    orderId: string,
    customerId: string,
    amount: number,
    ipAddr: string,
  ): Promise<{ txnId: string; paymentUrl: string }> {
    try {
      const response = await this.send(PAYMENT_RPC_PATTERNS.createAttempt, {
        internalAuth: this.signServiceToken(),
        orderId,
        customerId,
        amount,
        ipAddr,
      });
      return paymentAttemptCreateResponseSchema.parse(response);
    } catch (error) {
      this.rethrowClientError(error);
      this.logger.error(
        `Payment createAttempt unavailable for order=${orderId}: ${this.describe(error)}`,
      );
      throw new ServiceUnavailableException(
        'Payment service is unavailable.',
      );
    }
  }

  async markPaymentAttemptFailed(
    txnId: string,
    reason: string,
  ): Promise<void> {
    try {
      await this.send(PAYMENT_RPC_PATTERNS.markAttemptFailed, {
        internalAuth: this.signServiceToken(),
        txnId,
        reason,
      });
    } catch (error) {
      this.rethrowClientError(error);
      this.logger.error(
        `Payment markAttemptFailed failed for txn=${txnId}: ${this.describe(error)}`,
      );
      if (this.config.get('PAYMENT_RPC_REQUIRED', { infer: true })) {
        throw new ServiceUnavailableException(
          'Payment service is unavailable.',
        );
      }
    }
  }

  async cancelPendingPaymentForOrder(
    orderId: string,
    customerId: string,
    reason?: string,
  ): Promise<{ id: string; orderId: string; status: string; updatedAt: Date }> {
    try {
      const response = await this.send(
        PAYMENT_RPC_PATTERNS.cancelPendingAttempt,
        {
          internalAuth: this.signServiceToken(),
          orderId,
          customerId,
          reason,
        },
      );
      return paymentPendingCancelResponseSchema.parse(response);
    } catch (error) {
      this.rethrowClientError(error);
      throw new ServiceUnavailableException('Payment service is unavailable.');
    }
  }

  private send(pattern: string, payload: unknown): Promise<unknown> {
    const timeoutMs = this.config.get('PAYMENT_RPC_TIMEOUT_MS', {
      infer: true,
    });
    return firstValueFrom(
      this.client.send(pattern, payload).pipe(timeout(timeoutMs)),
    );
  }

  private rethrowClientError(error: unknown): void {
    const rpcError = paymentRpcErrorSchema.safeParse(error);
    if (rpcError.success && rpcError.data.statusCode < 500) {
      throw new HttpException(
        {
          statusCode: rpcError.data.statusCode,
          error: HttpStatus[rpcError.data.statusCode],
          message: rpcError.data.message,
        },
        rpcError.data.statusCode,
      );
    }
  }

  private describe(error: unknown): string {
    const rpcError = paymentRpcErrorSchema.safeParse(error);
    if (rpcError.success) return rpcError.data.message;
    return error instanceof Error ? error.message : String(error);
  }

  private signServiceToken(): string {
    return signInternalJwt({
      issuer: this.config.get('INTERNAL_AUTH_JWT_ISSUER', { infer: true }),
      subject: 'service:api',
      audience: 'payment',
      roles: ['service'],
      secret: this.config.get('INTERNAL_AUTH_JWT_SECRET', { infer: true }),
      correlationId: randomUUID(),
      ttlSeconds: this.config.get('INTERNAL_AUTH_JWT_TTL_SECONDS', {
        infer: true,
      }),
    });
  }
}
