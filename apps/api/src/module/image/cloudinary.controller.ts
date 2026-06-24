import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CloudinaryService } from './cloudinary.service';
import {
  CloudinarySignatureQueryDto,
  CloudinarySignatureResponseDto,
} from './dto/cloudinary.dto';
import { LegacyMediaRouteGuard } from './legacy-media-route.guard';

@ApiTags('Cloudinary')
@ApiBearerAuth()
@Controller('cloudinary')
@UseGuards(LegacyMediaRouteGuard)
export class CloudinaryController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Get('signature')
  @ApiOperation({
    summary: 'Get a signed upload signature',
    description:
      'Returns Cloudinary signature data for direct browser uploads.',
  })
  @ApiQuery({
    name: 'folder',
    required: false,
    description: 'Optional Cloudinary folder path for the upload',
    example: 'app-images',
  })
  @ApiOkResponse({ type: CloudinarySignatureResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  getSignature(@Query() query: CloudinarySignatureQueryDto) {
    return this.cloudinaryService.getUploadSignature(query.folder);
  }
}
