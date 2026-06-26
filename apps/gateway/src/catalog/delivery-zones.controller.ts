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

@ApiTags('Catalog: Delivery Zones')
@ApiBearerAuth()
@Controller('api/restaurants/:restaurantId/delivery-zones')
export class DeliveryZonesController {
  constructor(
    @Inject(CATALOG_RPC_GATEWAY) private readonly catalog: CatalogRpcGateway,
    private readonly internalJwt: InternalJwtService,
  ) {}

  private token(req: GatewayRequestWithSession): string {
    return this.internalJwt.issueForRequest(req, 'catalog');
  }

  @Get()
  list(@Param('restaurantId') restaurantId: string) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.listDeliveryZones, {
      restaurantId,
    });
  }

  @Get('delivery-estimate')
  estimate(
    @Param('restaurantId') restaurantId: string,
    @Query() q: Record<string, string>,
  ) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.estimateDelivery, {
      restaurantId,
      coordinates: { latitude: Number(q.lat), longitude: Number(q.lon) },
    });
  }

  @Post()
  @UseGuards(CatalogSessionGuard)
  create(
    @Req() req: GatewayRequestWithSession,
    @Param('restaurantId') restaurantId: string,
    @Body() dto: unknown,
  ) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.createDeliveryZone, {
      internalAuth: this.token(req),
      restaurantId,
      dto,
    });
  }

  @Patch(':id')
  @UseGuards(CatalogSessionGuard)
  update(
    @Req() req: GatewayRequestWithSession,
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
    @Body() dto: unknown,
  ) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.updateDeliveryZone, {
      internalAuth: this.token(req),
      id,
      restaurantId,
      dto,
    });
  }

  @Delete(':id')
  @UseGuards(CatalogSessionGuard)
  remove(
    @Req() req: GatewayRequestWithSession,
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
  ) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.removeDeliveryZone, {
      internalAuth: this.token(req),
      id,
      restaurantId,
    });
  }
}
