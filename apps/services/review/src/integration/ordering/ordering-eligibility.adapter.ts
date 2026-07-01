import {
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import { firstValueFrom, timeout } from 'rxjs';
import {
  ORDERING_RPC_PATTERNS,
  orderingReviewEligibilityResponseSchema,
  orderingRpcErrorSchema,
  signInternalJwt,
} from '@uitfood/contracts';
import type { Env } from '@/config/env.schema';
import type { IOrderEligibilityPort } from '@/shared/ports/order-eligibility.port';
import { ORDERING_TCP_CLIENT } from './ordering-client.constants';

@Injectable()
export class OrderingEligibilityAdapter
  implements IOrderEligibilityPort, OnApplicationShutdown
{
  constructor(
    @Inject(ORDERING_TCP_CLIENT) private readonly client: ClientProxy,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }

  async checkEligibility(
    orderId: string,
    customerId: string,
  ): Promise<{ restaurantId: string }> {
    try {
      const response = (await firstValueFrom(
        this.client
          .send(ORDERING_RPC_PATTERNS.getReviewEligibility, {
            internalAuth: this.signServiceToken(),
            orderId,
            customerId,
          })
          .pipe(
            timeout(
              this.config.get('ORDERING_RPC_TIMEOUT_MS', { infer: true }),
            ),
          ),
      )) as { restaurantId: string };
      return orderingReviewEligibilityResponseSchema.parse(response);
    } catch (error) {
      const rpcError = orderingRpcErrorSchema.safeParse(error);
      if (rpcError.success) {
        throw new HttpException(
          {
            statusCode: rpcError.data.statusCode,
            error: HttpStatus[rpcError.data.statusCode],
            message: rpcError.data.message,
          },
          rpcError.data.statusCode,
        );
      }
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new GatewayTimeoutException(
          'Ordering eligibility request timed out.',
        );
      }
      throw new ServiceUnavailableException(
        'Ordering eligibility is unavailable.',
        { cause: error },
      );
    }
  }

  private signServiceToken(): string {
    return signInternalJwt({
      issuer: this.config.get('INTERNAL_AUTH_JWT_ISSUER', { infer: true }),
      subject: 'service:review',
      audience: 'ordering',
      roles: ['service'],
      secret: this.config.get('INTERNAL_AUTH_JWT_SECRET', { infer: true }),
      correlationId: randomUUID(),
      ttlSeconds: this.config.get('INTERNAL_AUTH_JWT_TTL_SECONDS', {
        infer: true,
      }),
    });
  }
}
