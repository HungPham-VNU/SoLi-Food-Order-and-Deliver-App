import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Roles } from '@thallesp/nestjs-better-auth';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { PromotionAdminService } from '../services/promotion-admin.service';
import {
  CreatePromotionDto,
  UpdatePromotionDto,
  PromotionResponseDto,
  PromotionListResponseDto,
} from '../dto/promotion.dto';
import {
  CreateCouponCodesDto,
  CouponCodeResponseDto,
  CouponCodeListResponseDto,
} from '../dto/coupon.dto';
import type { PromotionStatus } from '../domain/promotion.schema';

/**
 * PromotionAdminController
 *
 * Admin-only endpoints for full promotion lifecycle management.
 * Base path: /promotions/admin
 *
 * All endpoints require the 'admin' role.
 */
@ApiTags('Promotions — Admin')
@ApiBearerAuth()
@Roles(['admin'])
@Controller('promotions/admin')
export class PromotionAdminController {
  constructor(private readonly service: PromotionAdminService) {}

  // ---------------------------------------------------------------------------
  // Promotion CRUD
  // ---------------------------------------------------------------------------

  @Post()
  @ApiOperation({
    summary: 'Create promotion',
    description:
      'Creates a new promotion in draft status. Set scope=platform for all restaurants, or scope=restaurant + restaurantId for a specific restaurant.',
  })
  @ApiCreatedResponse({ type: PromotionResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  async create(@Body() dto: CreatePromotionDto): Promise<PromotionResponseDto> {
    const row = await this.service.createPromotion(dto);
    return PromotionResponseDto.fromRow(row);
  }

  @Get()
  @ApiOperation({
    summary: 'List all promotions',
    description:
      'Returns paginated promotions with optional status / restaurantId filters.',
  })
  @ApiOkResponse({ type: PromotionListResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  async findAll(
    @Query('status') status?: PromotionStatus,
    @Query('restaurantId') restaurantId?: string,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ): Promise<PromotionListResponseDto> {
    const { rows, total } = await this.service.listPromotions({
      status,
      restaurantId,
      offset,
      limit,
    });
    return {
      items: rows.map((r) => PromotionResponseDto.fromRow(r)),
      total,
      offset: offset ?? 0,
      limit: limit ?? 20,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get promotion by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PromotionResponseDto })
  @ApiNotFoundResponse({ description: 'Promotion not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PromotionResponseDto> {
    const row = await this.service.getPromotion(id);
    return PromotionResponseDto.fromRow(row);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update promotion',
    description:
      'Partial update of a promotion. Cannot update cancelled promotions.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PromotionResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid input or promotion is cancelled',
  })
  @ApiNotFoundResponse({ description: 'Promotion not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePromotionDto,
  ): Promise<PromotionResponseDto> {
    const row = await this.service.updatePromotion(id, dto);
    return PromotionResponseDto.fromRow(row);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cancel (soft-delete) promotion',
    description:
      'Transitions promotion status to cancelled. Does not delete the row.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Promotion cancelled' })
  @ApiNotFoundResponse({ description: 'Promotion not found' })
  @ApiBadRequestResponse({ description: 'Promotion is already cancelled' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  async cancel(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.service.cancelPromotion(id);
  }

  // ---------------------------------------------------------------------------
  // Status transitions
  // ---------------------------------------------------------------------------

  @Patch(':id/activate')
  @ApiOperation({
    summary: 'Activate promotion',
    description: 'Transitions draft or paused promotion to active status.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PromotionResponseDto })
  @ApiBadRequestResponse({ description: 'Cannot activate in current status' })
  @ApiNotFoundResponse({ description: 'Promotion not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PromotionResponseDto> {
    const row = await this.service.activatePromotion(id);
    return PromotionResponseDto.fromRow(row);
  }

  @Patch(':id/pause')
  @ApiOperation({
    summary: 'Pause promotion',
    description: 'Transitions active promotion to paused status.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PromotionResponseDto })
  @ApiBadRequestResponse({ description: 'Cannot pause in current status' })
  @ApiNotFoundResponse({ description: 'Promotion not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  async pause(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PromotionResponseDto> {
    const row = await this.service.pausePromotion(id);
    return PromotionResponseDto.fromRow(row);
  }

  // ---------------------------------------------------------------------------
  // Coupon codes
  // ---------------------------------------------------------------------------

  @Post(':id/coupons')
  @ApiOperation({
    summary: 'Create coupon codes for a promotion',
    description:
      'Batch-creates coupon codes for a coupon_code-triggered promotion. All codes must be unique across the system.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Promotion UUID' })
  @ApiCreatedResponse({ type: [CouponCodeResponseDto] })
  @ApiBadRequestResponse({
    description: 'Promotion is not coupon_code-triggered or is cancelled',
  })
  @ApiConflictResponse({
    description: 'One or more coupon codes already exist',
  })
  @ApiNotFoundResponse({ description: 'Promotion not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  async createCoupons(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCouponCodesDto,
  ): Promise<CouponCodeResponseDto[]> {
    const rows = await this.service.createCouponCodes(id, dto);
    return rows.map((r) => CouponCodeResponseDto.fromRow(r));
  }

  @Get(':id/coupons')
  @ApiOperation({
    summary: 'List coupon codes for a promotion',
    description: 'Returns paginated coupon codes for the given promotion.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Promotion UUID' })
  @ApiOkResponse({ type: CouponCodeListResponseDto })
  @ApiNotFoundResponse({ description: 'Promotion not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  async listCoupons(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ): Promise<CouponCodeListResponseDto> {
    const { rows, total } = await this.service.listCouponCodes(
      id,
      offset,
      limit,
    );
    return {
      items: rows.map((r) => CouponCodeResponseDto.fromRow(r)),
      total,
      offset: offset ?? 0,
      limit: limit ?? 50,
    };
  }
}
