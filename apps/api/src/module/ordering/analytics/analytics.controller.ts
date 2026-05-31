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
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto, AnalyticsResponseDto } from './dto/analytics.dto';

/**
 * GET /restaurant/analytics/operational
 *
 * Returns the full Operational Analytics bundle (current window + 7-day baseline)
 * for the restaurant owned by the authenticated caller. Role-gated to
 * `restaurant` and `admin`, mirroring the other /restaurant/* routes in the
 * order-history module.
 */
@ApiTags('Ordering - Restaurant Analytics')
@ApiBearerAuth()
@Controller('restaurant/analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('operational')
  @ApiOperation({
    summary: "Operational analytics bundle for the caller's restaurant",
  })
  @ApiOkResponse({
    type: AnalyticsResponseDto,
    description:
      'Current-window aggregates plus prior-7-day baseline. Powers the entire /analytics page in one round-trip.',
  })
  @ApiForbiddenResponse({
    description: 'Caller is not a restaurant owner or has no restaurant.',
  })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async getOperational(
    @Session() session: UserSession,
    @Query() query: AnalyticsQueryDto,
  ): Promise<AnalyticsResponseDto> {
    if (!hasRole(session.user.role, 'restaurant', 'admin')) {
      throw new ForbiddenException(
        'Only restaurant owners and admins can access analytics.',
      );
    }
    return this.service.getOperational(session.user.id, query.range ?? 'today');
  }
}
