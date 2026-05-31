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
import { Roles, Session, type UserSession } from '@thallesp/nestjs-better-auth';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { PromotionRestaurantService } from '../services/promotion-restaurant.service';
import {
  CreatePromotionDto,
  UpdatePromotionDto,
  PromotionResponseDto,
  PromotionListResponseDto,
} from '../dto/promotion.dto';

/**
 * PromotionRestaurantController
 *
 * Restaurant-owner endpoints for managing their own promotions.
 * Base path: /promotions/restaurant
 *
 * All endpoints require the 'restaurant' role.
 * All operations are scoped to the restaurantId provided in the request,
 * which is verified against the caller's restaurant ownership.
 */
@ApiTags('Promotions — Restaurant')
@ApiBearerAuth()
@Roles(['restaurant'])
@Controller('promotions/restaurant')
export class PromotionRestaurantController {
  constructor(private readonly service: PromotionRestaurantService) {}

  @Post()
  @ApiOperation({
    summary: 'Create restaurant promotion',
    description:
      'Creates a restaurant-scoped promotion in draft status. The restaurantId in the body must be a restaurant you own.',
  })
  @ApiQuery({
    name: 'restaurantId',
    type: String,
    format: 'uuid',
    required: true,
    description: 'UUID of the restaurant to create the promotion for',
  })
  @ApiCreatedResponse({ type: PromotionResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'You do not own this restaurant' })
  async create(
    @Query('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Session() session: UserSession,
    @Body() dto: CreatePromotionDto,
  ): Promise<PromotionResponseDto> {
    const row = await this.service.createPromotion(
      dto,
      restaurantId,
      session.user.id,
    );
    return PromotionResponseDto.fromRow(row);
  }

  @Get('my')
  @ApiOperation({
    summary: 'List my restaurant promotions',
    description:
      'Returns paginated promotions for the given restaurant owned by you.',
  })
  @ApiQuery({
    name: 'restaurantId',
    type: String,
    format: 'uuid',
    required: true,
  })
  @ApiOkResponse({ type: PromotionListResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'You do not own this restaurant' })
  async findMyPromotions(
    @Query('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Session() session: UserSession,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ): Promise<PromotionListResponseDto> {
    const { rows, total } = await this.service.listMyPromotions(
      restaurantId,
      session.user.id,
      offset,
      limit,
    );
    return {
      items: rows.map((r) => PromotionResponseDto.fromRow(r)),
      total,
      offset: offset ?? 0,
      limit: limit ?? 20,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get my promotion by ID',
    description: 'Returns a specific promotion you own.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery({
    name: 'restaurantId',
    type: String,
    format: 'uuid',
    required: true,
  })
  @ApiOkResponse({ type: PromotionResponseDto })
  @ApiNotFoundResponse({ description: 'Promotion not found' })
  @ApiForbiddenResponse({ description: 'You do not own this promotion' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Session() session: UserSession,
  ): Promise<PromotionResponseDto> {
    const row = await this.service.getMyPromotion(
      id,
      restaurantId,
      session.user.id,
    );
    return PromotionResponseDto.fromRow(row);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update my promotion',
    description: 'Partial update of a promotion you own.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery({
    name: 'restaurantId',
    type: String,
    format: 'uuid',
    required: true,
  })
  @ApiOkResponse({ type: PromotionResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid input or promotion is cancelled',
  })
  @ApiNotFoundResponse({ description: 'Promotion not found' })
  @ApiForbiddenResponse({ description: 'You do not own this promotion' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Session() session: UserSession,
    @Body() dto: UpdatePromotionDto,
  ): Promise<PromotionResponseDto> {
    const row = await this.service.updatePromotion(
      id,
      dto,
      restaurantId,
      session.user.id,
    );
    return PromotionResponseDto.fromRow(row);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate my promotion' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery({
    name: 'restaurantId',
    type: String,
    format: 'uuid',
    required: true,
  })
  @ApiOkResponse({ type: PromotionResponseDto })
  @ApiBadRequestResponse({ description: 'Cannot activate in current status' })
  @ApiNotFoundResponse({ description: 'Promotion not found' })
  @ApiForbiddenResponse({ description: 'You do not own this promotion' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Session() session: UserSession,
  ): Promise<PromotionResponseDto> {
    const row = await this.service.activatePromotion(
      id,
      restaurantId,
      session.user.id,
    );
    return PromotionResponseDto.fromRow(row);
  }

  @Patch(':id/pause')
  @ApiOperation({ summary: 'Pause my promotion' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery({
    name: 'restaurantId',
    type: String,
    format: 'uuid',
    required: true,
  })
  @ApiOkResponse({ type: PromotionResponseDto })
  @ApiBadRequestResponse({ description: 'Cannot pause in current status' })
  @ApiNotFoundResponse({ description: 'Promotion not found' })
  @ApiForbiddenResponse({ description: 'You do not own this promotion' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  async pause(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Session() session: UserSession,
  ): Promise<PromotionResponseDto> {
    const row = await this.service.pausePromotion(
      id,
      restaurantId,
      session.user.id,
    );
    return PromotionResponseDto.fromRow(row);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cancel (soft-delete) my promotion',
    description:
      'Transitions a promotion you own to cancelled. The row is retained for audit/analytics; it is not hard-deleted.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery({
    name: 'restaurantId',
    type: String,
    format: 'uuid',
    required: true,
  })
  @ApiNoContentResponse({ description: 'Promotion cancelled' })
  @ApiBadRequestResponse({ description: 'Promotion is already cancelled' })
  @ApiNotFoundResponse({ description: 'Promotion not found' })
  @ApiForbiddenResponse({ description: 'You do not own this promotion' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Session() session: UserSession,
  ): Promise<void> {
    await this.service.cancelPromotion(id, restaurantId, session.user.id);
  }
}
