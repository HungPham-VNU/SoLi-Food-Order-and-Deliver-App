import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ImageService } from './image.service';
import {
  CreateImageDto,
  ImageListResponseDto,
  ImageResponseDto,
  PaginationQueryDto,
} from './dto/image.dto';
import { LegacyMediaRouteGuard } from './legacy-media-route.guard';

@ApiTags('Images')
@ApiBearerAuth()
@Controller('images')
@UseGuards(LegacyMediaRouteGuard)
export class ImageController {
  constructor(private readonly service: ImageService) {}

  @Get()
  @AllowAnonymous()
  @ApiOperation({
    summary: 'List stored images',
    description: 'Returns paginated image metadata stored by the backend.',
  })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ type: ImageListResponseDto })
  findAll(@Query() pagination: PaginationQueryDto) {
    return this.service.findAll(pagination.offset, pagination.limit);
  }

  @Post()
  @ApiOperation({
    summary: 'Store image metadata',
    description:
      'Persists Cloudinary upload metadata for later use by clients.',
  })
  @ApiCreatedResponse({ type: ImageResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  create(@Body() dto: CreateImageDto) {
    return this.service.create(dto);
  }
}
