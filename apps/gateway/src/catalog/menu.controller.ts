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

const num = (v: unknown): number | undefined =>
  v === undefined || v === '' ? undefined : Number(v);

@ApiTags('Catalog: Menu')
@ApiBearerAuth()
@Controller('api/menu-items')
export class MenuController {
  constructor(
    @Inject(CATALOG_RPC_GATEWAY) private readonly catalog: CatalogRpcGateway,
    private readonly internalJwt: InternalJwtService,
  ) {}

  private token(req: GatewayRequestWithSession): string {
    return this.internalJwt.issueForRequest(req, 'catalog');
  }

  // --- Categories (declared before :id so 'categories' isn't captured as an id) ---

  @Get('categories')
  listCategories(@Query() q: Record<string, string>) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.listMenuCategories, {
      restaurantId: q.restaurantId,
    });
  }

  @Post('categories')
  @UseGuards(CatalogSessionGuard)
  createCategory(@Req() req: GatewayRequestWithSession, @Body() dto: unknown) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.createMenuCategory, {
      internalAuth: this.token(req),
      dto,
    });
  }

  @Patch('categories/:id')
  @UseGuards(CatalogSessionGuard)
  updateCategory(
    @Req() req: GatewayRequestWithSession,
    @Param('id') id: string,
    @Body() dto: unknown,
  ) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.updateMenuCategory, {
      internalAuth: this.token(req),
      id,
      dto,
    });
  }

  @Delete('categories/:id')
  @UseGuards(CatalogSessionGuard)
  removeCategory(
    @Req() req: GatewayRequestWithSession,
    @Param('id') id: string,
  ) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.removeMenuCategory, {
      internalAuth: this.token(req),
      id,
    });
  }

  // --- Items ---

  @Get()
  list(@Query() q: Record<string, string>) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.listMenuItems, {
      restaurantId: q.restaurantId,
      categoryId: q.categoryId,
      status: q.status,
      offset: num(q.offset),
      limit: num(q.limit),
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.getMenuItem, { id });
  }

  @Post()
  @UseGuards(CatalogSessionGuard)
  create(@Req() req: GatewayRequestWithSession, @Body() dto: unknown) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.createMenuItem, {
      internalAuth: this.token(req),
      dto,
    });
  }

  @Patch(':id')
  @UseGuards(CatalogSessionGuard)
  update(
    @Req() req: GatewayRequestWithSession,
    @Param('id') id: string,
    @Body() dto: unknown,
  ) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.updateMenuItem, {
      internalAuth: this.token(req),
      id,
      dto,
    });
  }

  @Post(':id/image')
  @UseGuards(CatalogSessionGuard)
  image(
    @Req() req: GatewayRequestWithSession,
    @Param('id') id: string,
    @Body() image: unknown,
  ) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.updateMenuItemImage, {
      internalAuth: this.token(req),
      id,
      image,
    });
  }

  @Patch(':id/sold-out')
  @UseGuards(CatalogSessionGuard)
  toggleSoldOut(
    @Req() req: GatewayRequestWithSession,
    @Param('id') id: string,
  ) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.toggleMenuItemSoldOut, {
      internalAuth: this.token(req),
      id,
    });
  }

  @Delete(':id')
  @UseGuards(CatalogSessionGuard)
  remove(@Req() req: GatewayRequestWithSession, @Param('id') id: string) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.removeMenuItem, {
      internalAuth: this.token(req),
      id,
    });
  }
}
