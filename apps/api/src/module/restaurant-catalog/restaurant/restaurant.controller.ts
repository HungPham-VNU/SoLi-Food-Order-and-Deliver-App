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
import {
  AllowAnonymous,
  Roles,
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import { RestaurantService } from './restaurant.service';
import { hasRole } from '@/shared/security/role.util';
import {
  CreateRestaurantDto,
  RestaurantListResponseDto,
  RestaurantResponseDto,
  UpdateRestaurantDto,
} from './dto/restaurant.dto';
import { CreateImageDto } from '@/shared/contracts/image.dto';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('Restaurants')
@ApiBearerAuth()
@Controller('restaurants')
export class RestaurantController {
  constructor(private readonly service: RestaurantService) {}

  @Get()
  @AllowAnonymous()
  @ApiOperation({
    summary: 'List restaurants',
    description: 'Returns paginated restaurants ordered by creation date.',
  })
  @ApiOkResponse({
    description: 'Restaurants retrieved successfully',
    type: RestaurantListResponseDto,
  })
  findAll(
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.service.findAll(offset, limit);
  }

  @Get('admin/all')
  @Roles(['admin'])
  @ApiOperation({
    summary: 'List all restaurants (admin)',
    description:
      'Returns all restaurants including unapproved ones. Admin only.',
  })
  @ApiOkResponse({ type: RestaurantListResponseDto })
  findAllAdmin(
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.service.findAllAdmin(offset, limit);
  }

  @Get('my')
  @ApiOperation({
    summary: "Get current user's restaurant",
    description:
      "Returns the authenticated caller's restaurant (any approval status). Returns null when the caller does not own a restaurant — used by the post-login redirect.",
  })
  @ApiOkResponse({ type: RestaurantResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  findMine(@Session() session: UserSession) {
    return this.service.findMine(session.user.id);
  }

  @Get(':id')
  @AllowAnonymous()
  @ApiOperation({
    summary: 'Get restaurant details',
    description: 'Returns one restaurant by its UUID.',
  })
  @ApiParam({
    name: 'id',
    description: 'Restaurant UUID',
    format: 'uuid',
    example: 'f7d6df40-6c7e-4f44-b0d0-c544d6f9e8f9',
  })
  @ApiOkResponse({
    description: 'Restaurant found',
    type: RestaurantResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid UUID format' })
  @ApiNotFoundResponse({ description: 'Restaurant not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiOperation({
    summary: 'Create restaurant',
    description:
      'Creates a new restaurant for the authenticated owner. Any authenticated user may submit; the restaurant is pending approval until an admin approves it.',
  })
  @ApiCreatedResponse({
    description: 'Restaurant created successfully',
    type: RestaurantResponseDto,
  })
  create(@Session() session: UserSession, @Body() dto: CreateRestaurantDto) {
    return this.service.create(session.user.id, dto);
  }

  @Patch(':id')
  @Roles(['admin', 'restaurant'])
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiOperation({
    summary: 'Update restaurant',
    description:
      'Updates an existing restaurant. Admins can update any restaurant; restaurant users can only update their own.',
  })
  @ApiParam({
    name: 'id',
    description: 'Restaurant UUID',
    format: 'uuid',
    example: 'f7d6df40-6c7e-4f44-b0d0-c544d6f9e8f9',
  })
  @ApiOkResponse({
    description: 'Restaurant updated successfully',
    type: RestaurantResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid UUID format or invalid request body',
  })
  @ApiForbiddenResponse({
    description: 'You do not own this restaurant or your role is not allowed',
  })
  @ApiNotFoundResponse({ description: 'Restaurant not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: UserSession,
    @Body() dto: UpdateRestaurantDto,
  ) {
    return this.service.update(
      id,
      session.user.id,
      hasRole(session.user.role, 'admin'),
      dto,
    );
  }

  @Post(':id/logo-image')
  @Roles(['admin', 'restaurant'])
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiOperation({
    summary: 'Attach restaurant logo image',
    description:
      'Stores Cloudinary upload metadata and updates the restaurant logoUrl.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: CreateImageDto })
  @ApiCreatedResponse({ type: RestaurantResponseDto })
  @ApiForbiddenResponse({ description: 'You do not own this restaurant' })
  @ApiNotFoundResponse({ description: 'Restaurant not found' })
  updateLogoImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: UserSession,
    @Body() dto: CreateImageDto,
  ) {
    return this.service.updateLogoImage(
      id,
      session.user.id,
      hasRole(session.user.role, 'admin'),
      dto,
    );
  }

  @Post(':id/cover-image')
  @Roles(['admin', 'restaurant'])
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiOperation({
    summary: 'Attach restaurant cover image',
    description:
      'Stores Cloudinary upload metadata and updates the restaurant coverImageUrl.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: CreateImageDto })
  @ApiCreatedResponse({ type: RestaurantResponseDto })
  @ApiForbiddenResponse({ description: 'You do not own this restaurant' })
  @ApiNotFoundResponse({ description: 'Restaurant not found' })
  updateCoverImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: UserSession,
    @Body() dto: CreateImageDto,
  ) {
    return this.service.updateCoverImage(
      id,
      session.user.id,
      hasRole(session.user.role, 'admin'),
      dto,
    );
  }

  @Patch(':id/approve')
  @Roles(['admin'])
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiOperation({
    summary: 'Approve restaurant',
    description: 'Mark a restaurant as approved. Admin only endpoint.',
  })
  @ApiParam({
    name: 'id',
    description: 'Restaurant UUID',
    format: 'uuid',
    example: 'f7d6df40-6c7e-4f44-b0d0-c544d6f9e8f9',
  })
  @ApiOkResponse({
    description: 'Restaurant approved successfully',
    type: RestaurantResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid UUID format' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions (admin role required)',
  })
  @ApiNotFoundResponse({ description: 'Restaurant not found' })
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.setApproved(id, true);
  }

  @Patch(':id/unapprove')
  @Roles(['admin'])
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiOperation({
    summary: 'Unapprove restaurant',
    description: 'Mark a restaurant as unapproved. Admin only endpoint.',
  })
  @ApiParam({
    name: 'id',
    description: 'Restaurant UUID',
    format: 'uuid',
    example: 'f7d6df40-6c7e-4f44-b0d0-c544d6f9e8f9',
  })
  @ApiOkResponse({
    description: 'Restaurant unapproved successfully',
    type: RestaurantResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid UUID format' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions (admin role required)',
  })
  @ApiNotFoundResponse({ description: 'Restaurant not found' })
  unapprove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.setApproved(id, false);
  }

  @Delete(':id')
  @Roles(['admin'])
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiOperation({
    summary: 'Delete restaurant',
    description: 'Deletes a restaurant by UUID. Admin only endpoint.',
  })
  @ApiParam({
    name: 'id',
    description: 'Restaurant UUID',
    format: 'uuid',
    example: 'f7d6df40-6c7e-4f44-b0d0-c544d6f9e8f9',
  })
  @ApiNoContentResponse({ description: 'Restaurant deleted successfully' })
  @ApiBadRequestResponse({ description: 'Invalid UUID format' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions (admin role required)',
  })
  @ApiNotFoundResponse({ description: 'Restaurant not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
