import { Controller, ForbiddenException, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { hasRole } from '@/module/auth/role.util';
import { AdminAnalyticsService } from './admin-analytics.service';
import {
  PlatformAnalyticsQueryDto,
  PlatformAnalyticsResponseDto,
} from './dto/admin-analytics.dto';

@ApiTags('Admin Analytics')
@ApiBearerAuth()
@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(private readonly service: AdminAnalyticsService) {}

  @Get('platform')
  @ApiOperation({
    summary:
      'Platform analytics bundle for the admin Mission Control dashboard',
    description:
      'Returns platform-wide GMV, revenue, restaurant counts, hourly load, ' +
      'top earners, bottleneck watchlist, and order district distribution for the requested window.',
  })
  @ApiOkResponse({ type: PlatformAnalyticsResponseDto })
  @ApiForbiddenResponse({ description: 'Admin role required.' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated.' })
  async getPlatformAnalytics(
    @Session() session: UserSession,
    @Query() query: PlatformAnalyticsQueryDto,
  ): Promise<PlatformAnalyticsResponseDto> {
    if (!hasRole(session.user.role, 'admin')) {
      throw new ForbiddenException('Admin role required.');
    }
    return this.service.getPlatformAnalytics(query.range ?? 'today');
  }
}
