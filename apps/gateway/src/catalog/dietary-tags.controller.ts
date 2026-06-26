import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
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
import { InternalJwtService } from '@/identity/internal-jwt.service';
import type { GatewayRequestWithSession } from '@/identity/identity.interfaces';

@ApiTags('Catalog: Dietary Tags')
@Controller('api/dietary-tags')
export class DietaryTagsController {
  constructor(
    @Inject(CATALOG_RPC_GATEWAY) private readonly catalog: CatalogRpcGateway,
    private readonly internalJwt: InternalJwtService,
  ) {}

  private token(req: GatewayRequestWithSession): string {
    return this.internalJwt.issueForRequest(req, 'catalog');
  }

  // Public listing
  @Get()
  listActive(@Query() q: Record<string, string>) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.listDietaryTags, {
      category: q.category,
    });
  }

  // Admin
  @Get('admin')
  @UseGuards(CatalogSessionGuard)
  listAll(@Req() req: GatewayRequestWithSession) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.listAllDietaryTags, {
      internalAuth: this.token(req),
    });
  }

  @Post('admin')
  @UseGuards(CatalogSessionGuard)
  create(@Req() req: GatewayRequestWithSession, @Body() dto: unknown) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.createDietaryTag, {
      internalAuth: this.token(req),
      dto,
    });
  }

  @Patch('admin/:id')
  @UseGuards(CatalogSessionGuard)
  update(
    @Req() req: GatewayRequestWithSession,
    @Param('id') id: string,
    @Body() dto: unknown,
  ) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.updateDietaryTag, {
      internalAuth: this.token(req),
      id,
      dto,
    });
  }

  @Delete('admin/:id')
  @UseGuards(CatalogSessionGuard)
  remove(@Req() req: GatewayRequestWithSession, @Param('id') id: string) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.removeDietaryTag, {
      internalAuth: this.token(req),
      id,
    });
  }
}
