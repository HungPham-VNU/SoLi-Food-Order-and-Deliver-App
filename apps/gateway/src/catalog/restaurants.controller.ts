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

@ApiTags('Catalog: Restaurants')
@ApiBearerAuth()
@Controller('api/restaurants')
export class RestaurantsController {
  constructor(
    @Inject(CATALOG_RPC_GATEWAY) private readonly catalog: CatalogRpcGateway,
    private readonly internalJwt: InternalJwtService,
  ) {}

  private token(req: GatewayRequestWithSession): string {
    return this.internalJwt.issueForRequest(req, 'catalog');
  }

  @Get()
  list(@Query() q: Record<string, string>) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.listRestaurants, {
      offset: num(q.offset),
      limit: num(q.limit),
    });
  }

  @Get('admin/all')
  @UseGuards(CatalogSessionGuard)
  listAdmin(
    @Req() req: GatewayRequestWithSession,
    @Query() q: Record<string, string>,
  ) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.listRestaurantsAdmin, {
      internalAuth: this.token(req),
      offset: num(q.offset),
      limit: num(q.limit),
    });
  }

  @Get('my')
  @UseGuards(CatalogSessionGuard)
  mine(@Req() req: GatewayRequestWithSession) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.getRestaurantByOwner, {
      ownerId: req.gatewaySession!.userId,
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.getRestaurant, { id });
  }

  @Post()
  @UseGuards(CatalogSessionGuard)
  create(@Req() req: GatewayRequestWithSession, @Body() dto: unknown) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.createRestaurant, {
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
    return this.catalog.send(CATALOG_RPC_PATTERNS.updateRestaurant, {
      internalAuth: this.token(req),
      id,
      dto,
    });
  }

  @Post(':id/logo-image')
  @UseGuards(CatalogSessionGuard)
  logo(
    @Req() req: GatewayRequestWithSession,
    @Param('id') id: string,
    @Body() image: unknown,
  ) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.attachRestaurantLogo, {
      internalAuth: this.token(req),
      id,
      image,
    });
  }

  @Post(':id/cover-image')
  @UseGuards(CatalogSessionGuard)
  cover(
    @Req() req: GatewayRequestWithSession,
    @Param('id') id: string,
    @Body() image: unknown,
  ) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.attachRestaurantCover, {
      internalAuth: this.token(req),
      id,
      image,
    });
  }

  @Patch(':id/approve')
  @UseGuards(CatalogSessionGuard)
  approve(@Req() req: GatewayRequestWithSession, @Param('id') id: string) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.setRestaurantApproved, {
      internalAuth: this.token(req),
      id,
      isApproved: true,
    });
  }

  @Patch(':id/unapprove')
  @UseGuards(CatalogSessionGuard)
  unapprove(@Req() req: GatewayRequestWithSession, @Param('id') id: string) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.setRestaurantApproved, {
      internalAuth: this.token(req),
      id,
      isApproved: false,
    });
  }

  @Delete(':id')
  @UseGuards(CatalogSessionGuard)
  remove(@Req() req: GatewayRequestWithSession, @Param('id') id: string) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.removeRestaurant, {
      internalAuth: this.token(req),
      id,
    });
  }
}
