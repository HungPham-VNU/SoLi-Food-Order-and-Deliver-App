import { Controller, ForbiddenException } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  REPORTING_RPC_PATTERNS,
  platformAnalyticsRequestSchema,
  restaurantAnalyticsRequestSchema,
  type PlatformAnalyticsRequest,
  type RestaurantAnalyticsRequest,
} from '@uitfood/contracts';
import { AdminAnalyticsService } from '@/reporting/admin-analytics.service';
import { InternalAuthService } from '@/auth/internal-auth.service';
import { asReportingRpcException } from './reporting-rpc.errors';

/**
 * Reporting TCP RPC surface — the admin analytics reads, served entirely from
 * the local event-fed projections. Verifies the `aud=reporting` token and
 * re-checks the admin role.
 */
@Controller()
export class ReportingRpcController {
  constructor(
    private readonly service: AdminAnalyticsService,
    private readonly auth: InternalAuthService,
  ) {}

  @MessagePattern(REPORTING_RPC_PATTERNS.getPlatformAnalytics)
  async getPlatformAnalytics(@Payload() p: PlatformAnalyticsRequest) {
    try {
      const req = platformAnalyticsRequestSchema.parse(p);
      const caller = this.auth.verifyReportingToken(req.internalAuth);
      if (!caller.isAdmin) {
        throw new ForbiddenException('Admin role required.');
      }
      return await this.service.getPlatformAnalytics(req.range);
    } catch (e) {
      throw asReportingRpcException(e);
    }
  }

  @MessagePattern(REPORTING_RPC_PATTERNS.getRestaurantAnalytics)
  async getRestaurantAnalytics(@Payload() p: RestaurantAnalyticsRequest) {
    try {
      const req = restaurantAnalyticsRequestSchema.parse(p);
      const caller = this.auth.verifyReportingToken(req.internalAuth);
      if (!caller.isAdmin) {
        throw new ForbiddenException('Admin role required.');
      }
      return await this.service.getRestaurantAnalytics(
        req.restaurantId,
        req.range,
      );
    } catch (e) {
      throw asReportingRpcException(e);
    }
  }
}
