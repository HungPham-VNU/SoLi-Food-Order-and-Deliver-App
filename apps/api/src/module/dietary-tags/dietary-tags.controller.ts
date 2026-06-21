import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AllowAnonymous, Roles } from '@thallesp/nestjs-better-auth';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  CreateDietaryTagDto,
  DIETARY_TAG_CATEGORIES,
  DietaryTagResponseDto,
  ListDietaryTagsQueryDto,
  UpdateDietaryTagDto,
} from './dto/dietary-tag.dto';
import { DietaryTagsService } from './dietary-tags.service';

@ApiTags('Dietary & Lifestyle Tags')
@Controller('dietary-tags')
export class DietaryTagsPublicController {
  constructor(private readonly service: DietaryTagsService) {}

  @Get()
  @AllowAnonymous()
  @ApiOperation({ summary: 'List active dietary and lifestyle tags' })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: DIETARY_TAG_CATEGORIES,
  })
  @ApiOkResponse({ type: [DietaryTagResponseDto] })
  async listActive(
    @Query() query: ListDietaryTagsQueryDto,
  ): Promise<DietaryTagResponseDto[]> {
    const rows = await this.service.listActive(query.category);
    return rows.map(DietaryTagResponseDto.fromRow);
  }
}

@ApiTags('Dietary & Lifestyle Tags - Admin')
@ApiBearerAuth()
@Roles(['admin'])
@Controller('dietary-tags/admin')
export class DietaryTagsAdminController {
  constructor(private readonly service: DietaryTagsService) {}

  @Get()
  @ApiOperation({ summary: 'List all dietary and lifestyle tags' })
  @ApiOkResponse({ type: [DietaryTagResponseDto] })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  async listAll(): Promise<DietaryTagResponseDto[]> {
    const rows = await this.service.listAll();
    return rows.map(DietaryTagResponseDto.fromRow);
  }

  @Post()
  @ApiOperation({ summary: 'Create a dietary or lifestyle tag' })
  @ApiCreatedResponse({ type: DietaryTagResponseDto })
  @ApiConflictResponse({ description: 'Name or slug already exists' })
  async create(
    @Body() dto: CreateDietaryTagDto,
  ): Promise<DietaryTagResponseDto> {
    return DietaryTagResponseDto.fromRow(await this.service.create(dto));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a dietary or lifestyle tag' })
  @ApiOkResponse({ type: DietaryTagResponseDto })
  @ApiNotFoundResponse({ description: 'Tag not found' })
  @ApiConflictResponse({ description: 'Name or slug already exists' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDietaryTagDto,
  ): Promise<DietaryTagResponseDto> {
    return DietaryTagResponseDto.fromRow(await this.service.update(id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a dietary or lifestyle tag' })
  @ApiNoContentResponse({ description: 'Tag deleted' })
  @ApiNotFoundResponse({ description: 'Tag not found' })
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.service.delete(id);
  }
}
