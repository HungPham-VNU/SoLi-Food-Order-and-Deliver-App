import { Controller, ForbiddenException } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ORDERING_RPC_PATTERNS } from '@uitfood/contracts';
import { AnalyticsService } from '@/ordering/analytics/analytics.service';
import { InternalAuthService } from '@/auth/internal-auth.service';
import type { AnalyticsRange } from '@/ordering/analytics/dto/analytics.dto';
import { asOrderingRpcException } from './ordering-rpc.errors';

interface Auth {
  internalAuth: string;
}

function requireRole(roles: string[], ...allowed: string[]): void {
  if (!roles.some((r) => allowed.includes(r))) {
    throw new ForbiddenException(
      `This action requires one of: ${allowed.join(', ')}.`,
    );
  }
}

/**
 * Restaurant-facing analytics RPC surface. Mirrors OrderingHistoryRpcController's
 * restaurant-scoped reads: the scope id is always the verified caller's user id.
 */
@Controller()
export class OrderingAnalyticsRpcController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly auth: InternalAuthService,
  ) {}

  @MessagePattern(ORDERING_RPC_PATTERNS.restaurantOperationalAnalytics)
  async restaurantOperationalAnalytics(
    @Payload() p: Auth & { range?: AnalyticsRange },
  ) {
    try {
      const caller = this.auth.verifyOrderingToken(p.internalAuth);
      requireRole(caller.roles, 'restaurant', 'admin');
      return await this.analytics.getOperational(caller.userId, p.range);
    } catch (e) {
      throw asOrderingRpcException(e);
    }
  }
}
