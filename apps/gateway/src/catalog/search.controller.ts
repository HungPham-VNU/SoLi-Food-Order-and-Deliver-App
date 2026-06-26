import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CATALOG_RPC_PATTERNS } from '@uitfood/contracts';
import type { CatalogRpcGateway } from './catalog.interfaces';
import { CATALOG_RPC_GATEWAY } from './catalog.tokens';
import { CatalogSessionGuard } from './catalog-session.guard';
import type { GatewayRequestWithSession } from '@/identity/identity.interfaces';

const num = (v: unknown): number | undefined =>
  v === undefined || v === '' ? undefined : Number(v);

@ApiTags('Catalog: Search')
@Controller('api/search')
export class SearchController {
  constructor(
    @Inject(CATALOG_RPC_GATEWAY) private readonly catalog: CatalogRpcGateway,
  ) {}

  @Get()
  search(@Query() q: Record<string, string>) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.search, {
      q: q.q,
      category: q.category,
      cuisineType: q.cuisineType,
      tag: q.tag,
      lat: num(q.lat),
      lon: num(q.lon),
      radiusKm: num(q.radiusKm),
      offset: num(q.offset),
      limit: num(q.limit),
    });
  }

  @Post('ai')
  @UseGuards(CatalogSessionGuard)
  searchAi(
    @Req() req: GatewayRequestWithSession,
    @Body() body: Record<string, unknown>,
  ) {
    // Carry the authenticated userId for the per-user daily-limit policy.
    return this.catalog.send(CATALOG_RPC_PATTERNS.searchAi, {
      ...body,
      userId: req.gatewaySession!.userId,
    });
  }
}
