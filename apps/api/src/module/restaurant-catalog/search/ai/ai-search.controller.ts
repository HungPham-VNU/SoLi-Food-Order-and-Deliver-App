import { Body, Controller, Post } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AiSearchRequestDto, AiSearchResponseDto } from './ai-search.dto';
import { AiSearchService } from './ai-search.service';

@ApiTags('Search')
@ApiBearerAuth()
@Controller('search')
export class AiSearchController {
  constructor(private readonly service: AiSearchService) {}

  @Post('ai')
  @AllowAnonymous()
  @ApiOperation({
    summary: 'AI-assisted grounded food search',
    description:
      'Interprets a natural-language food search, retrieves real menu and restaurant data, ranks deterministically, and uses classic search only for confident direct food-name lookups.',
  })
  @ApiBody({ type: AiSearchRequestDto })
  @ApiOkResponse({
    description:
      'AI search results with applied filters, match reasons, and follow-up suggestions.',
    type: AiSearchResponseDto,
  })
  search(@Body() body: AiSearchRequestDto) {
    return this.service.search(body);
  }
}
