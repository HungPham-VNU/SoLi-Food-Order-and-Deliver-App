import { Controller, Inject, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  InternalJwtError,
  ORDERING_RPC_PATTERNS,
  orderingReviewEligibilityRequestSchema,
  verifyInternalJwt,
  type OrderingReviewEligibilityRequest,
} from '@uitfood/contracts';
import type { Env } from '@/config/env.schema';
import {
  ORDER_ELIGIBILITY_PORT,
  type IOrderEligibilityPort,
} from '@/shared/ports/order-eligibility.port';
import { asOrderingRpcException } from './ordering-rpc.errors';

@Controller()
export class OrderingRpcController {
  constructor(
    @Inject(ORDER_ELIGIBILITY_PORT)
    private readonly orderEligibility: IOrderEligibilityPort,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @MessagePattern(ORDERING_RPC_PATTERNS.getReviewEligibility)
  async getReviewEligibility(@Payload() p: OrderingReviewEligibilityRequest) {
    try {
      const request = orderingReviewEligibilityRequestSchema.parse(p);
      this.verifyOrderingToken(request.internalAuth);
      return this.orderEligibility.checkEligibility(
        request.orderId,
        request.customerId,
      );
    } catch (e) {
      throw asOrderingRpcException(e);
    }
  }

  private verifyOrderingToken(token: string): void {
    try {
      const claims = verifyInternalJwt(token, {
        audience: 'ordering',
        secret: this.config.get('INTERNAL_AUTH_JWT_SECRET', { infer: true }),
        issuers: this.config
          .get('INTERNAL_AUTH_TRUSTED_ISSUERS', { infer: true })
          .split(',')
          .map((issuer) => issuer.trim())
          .filter(Boolean),
      });
      const roles = claims.roles ?? [];
      if (!roles.includes('service') && !claims.sub.startsWith('service:')) {
        throw new UnauthorizedException(
          'Ordering RPC requires a service token.',
        );
      }
    } catch (error) {
      if (error instanceof InternalJwtError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }
}
