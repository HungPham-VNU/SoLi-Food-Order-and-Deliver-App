import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { REPORTING_RPC_PATTERNS } from '@uitfood/contracts';
import type { ReportingRpcGateway } from './reporting.interfaces';
import { REPORTING_RPC_GATEWAY } from './reporting.tokens';
import { ReportingSessionGuard } from './reporting-session.guard';
import { InternalJwtService } from '@/identity/internal-jwt.service';
import type { GatewayRequestWithSession } from '@/identity/identity.interfaces';

/**
 * Public admin analytics endpoints, translating HTTP into Reporting TCP RPC.
 * Mirrors the public AdminAnalyticsController surface; the admin role is
 * re-checked inside the Reporting service.
 */
@ApiTags('Reporting: Admin Analytics')
@ApiBearerAuth()
@Controller('api/admin/analytics')
@UseGuards(ReportingSessionGuard)
export class ReportsController {
  constructor(
    @Inject(REPORTING_RPC_GATEWAY)
    private readonly reporting: ReportingRpcGateway,
    private readonly internalJwt: InternalJwtService,
  ) {}

  @Get('platform')
  getPlatformAnalytics(
    @Req() req: GatewayRequestWithSession,
    @Query('range') range?: string,
  ) {
    return this.reporting.send(REPORTING_RPC_PATTERNS.getPlatformAnalytics, {
      internalAuth: this.internalJwt.issueForRequest(req, 'reporting'),
      range,
    });
  }

  @Get('restaurant/:id')
  getRestaurantAnalytics(
    @Req() req: GatewayRequestWithSession,
    @Param('id') restaurantId: string,
    @Query('range') range?: string,
  ) {
    return this.reporting.send(REPORTING_RPC_PATTERNS.getRestaurantAnalytics, {
      internalAuth: this.internalJwt.issueForRequest(req, 'reporting'),
      restaurantId,
      range,
    });
  }
}
