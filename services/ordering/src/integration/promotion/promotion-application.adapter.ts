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
  PROMOTION_RPC_PATTERNS,
  discountPreviewResultSchema,
  discountReservationResultSchema,
  promotionRpcErrorSchema,
  signInternalJwt,
} from '@uitfood/contracts';
import type { Env } from '@/config/env.schema';
import type {
  IPromotionApplicationPort,
  DiscountPreviewParams,
  DiscountPreviewResult,
  DiscountReservationParams,
  DiscountReservationResult,
} from '@/shared/ports/promotion-application.port';
import { PROMOTION_TCP_CLIENT } from './promotion-client.constants';

/**
 * Remote implementation of IPromotionApplicationPort — Ordering reaches the
 * extracted Promotion service over TCP instead of an in-process call.
 *
 * Design parity with the local PromotionService it replaces:
 *  - preview/reserve degrade gracefully: on an unavailable service they return a
 *    no-discount result so checkout is never blocked by Promotion.
 *  - confirm/rollback are fire-and-forget: failures are logged, never thrown,
 *    so an already-committed order or a cancellation is never aborted.
 */
@Injectable()
export class PromotionApplicationAdapter
  implements IPromotionApplicationPort, OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(PromotionApplicationAdapter.name);

  constructor(
    @Inject(PROMOTION_TCP_CLIENT) private readonly client: ClientProxy,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get('PROMOTION_RPC_REQUIRED', { infer: true })) {
      await this.client.connect();
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }

  async previewDiscount(
    params: DiscountPreviewParams,
  ): Promise<DiscountPreviewResult> {
    try {
      const response = await this.send(PROMOTION_RPC_PATTERNS.previewDiscount, {
        internalAuth: this.signServiceToken(),
        params,
      });
      return discountPreviewResultSchema.parse(response) as DiscountPreviewResult;
    } catch (error) {
      this.rethrowClientError(error);
      this.logger.warn(
        `Promotion previewDiscount unavailable for order; returning no discount: ${this.describe(error)}`,
      );
      return {
        applicable: false,
        promotionId: null,
        couponCodeId: null,
        discountAmount: 0,
        finalItemsSubtotal: params.itemsSubtotal,
        finalShippingFee: params.shippingFee,
        breakdown: [],
        reason: 'Promotion service temporarily unavailable',
      };
    }
  }

  async computeAndReserveDiscount(
    params: DiscountReservationParams,
  ): Promise<DiscountReservationResult> {
    try {
      const response = await this.send(PROMOTION_RPC_PATTERNS.reserveDiscount, {
        internalAuth: this.signServiceToken(),
        params,
      });
      return discountReservationResultSchema.parse(
        response,
      ) as DiscountReservationResult;
    } catch (error) {
      this.rethrowClientError(error);
      this.logger.warn(
        `Promotion reserve unavailable for order=${params.tempOrderId}; proceeding without discount: ${this.describe(error)}`,
      );
      return {
        reserved: false,
        promotionId: null,
        couponCodeId: null,
        usageId: null,
        discountAmount: 0,
        breakdown: [],
        reason: 'Promotion service temporarily unavailable',
      };
    }
  }

  async confirmReservations(orderId: string): Promise<void> {
    try {
      await this.send(PROMOTION_RPC_PATTERNS.confirmReservations, {
        internalAuth: this.signServiceToken(),
        orderId,
      });
    } catch (error) {
      // Never throw — the order is already committed.
      this.logger.error(
        `Promotion confirmReservations failed for order=${orderId}: ${this.describe(error)}`,
      );
    }
  }

  async rollbackReservations(orderId: string): Promise<void> {
    try {
      await this.send(PROMOTION_RPC_PATTERNS.rollbackReservations, {
        internalAuth: this.signServiceToken(),
        orderId,
      });
    } catch (error) {
      // Never throw — cancellation must not be blocked by Promotion.
      this.logger.error(
        `Promotion rollbackReservations failed for order=${orderId}: ${this.describe(error)}`,
      );
    }
  }

  // ---------------------------------------------------------------------------

  private send(pattern: string, payload: unknown): Promise<unknown> {
    const timeoutMs = this.config.get('PROMOTION_RPC_TIMEOUT_MS', {
      infer: true,
    });
    return firstValueFrom(
      this.client.send(pattern, payload).pipe(timeout(timeoutMs)),
    );
  }

  /** Re-throw deterministic 4xx envelopes (e.g. bad payload / auth) as HTTP. */
  private rethrowClientError(error: unknown): void {
    const rpcError = promotionRpcErrorSchema.safeParse(error);
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
    if (this.config.get('PROMOTION_RPC_REQUIRED', { infer: true })) {
      throw new ServiceUnavailableException('Promotion service is unavailable.');
    }
  }

  private describe(error: unknown): string {
    const rpcError = promotionRpcErrorSchema.safeParse(error);
    if (rpcError.success) return rpcError.data.message;
    return error instanceof Error ? error.message : String(error);
  }

  private signServiceToken(): string {
    return signInternalJwt({
      issuer: this.config.get('INTERNAL_AUTH_JWT_ISSUER', { infer: true }),
      subject: 'service:api',
      audience: 'promotion',
      roles: ['service'],
      secret: this.config.get('INTERNAL_AUTH_JWT_SECRET', { infer: true }),
      correlationId: randomUUID(),
      ttlSeconds: this.config.get('INTERNAL_AUTH_JWT_TTL_SECONDS', {
        infer: true,
      }),
    });
  }
}
