import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CATALOG_RPC_PATTERNS } from '@uitfood/contracts';
import { SearchService } from '@/search/standard/search.service';
import { AiSearchService } from '@/search/ai/ai-search.service';
import type { AiSearchRequestDto } from '@/search/ai/ai-search.dto';
import { asCatalogRpcException } from './catalog-rpc.errors';

interface StandardSearchPayload {
  q?: string;
  category?: string;
  cuisineType?: string;
  tag?: string;
  lat?: number;
  lon?: number;
  radiusKm?: number;
  offset?: number;
  limit?: number;
}

@Controller()
export class SearchRpcController {
  constructor(
    private readonly standard: SearchService,
    private readonly ai: AiSearchService,
  ) {}

  @MessagePattern(CATALOG_RPC_PATTERNS.search)
  async search(@Payload() p: StandardSearchPayload) {
    try {
      return await this.standard.search(
        p.q,
        p.category,
        p.cuisineType,
        p.tag,
        p.lat,
        p.lon,
        p.radiusKm,
        p.offset,
        p.limit,
      );
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }

  @MessagePattern(CATALOG_RPC_PATTERNS.searchAi)
  async searchAi(@Payload() p: AiSearchRequestDto) {
    try {
      return await this.ai.search(p);
    } catch (e) {
      throw asCatalogRpcException(e);
    }
  }
}
