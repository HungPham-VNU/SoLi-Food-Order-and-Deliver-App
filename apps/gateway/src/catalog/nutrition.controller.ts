import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CATALOG_RPC_PATTERNS } from '@uitfood/contracts';
import type { CatalogRpcGateway } from './catalog.interfaces';
import { CATALOG_RPC_GATEWAY } from './catalog.tokens';
import { CatalogSessionGuard } from './catalog-session.guard';
import { InternalJwtService } from '@/identity/internal-jwt.service';
import type { GatewayRequestWithSession } from '@/identity/identity.interfaces';

@ApiTags('Catalog: Nutrition')
@ApiBearerAuth()
@Controller('api/restaurant/menu-items/:menuItemId/nutrition')
@UseGuards(CatalogSessionGuard)
export class NutritionController {
  constructor(
    @Inject(CATALOG_RPC_GATEWAY) private readonly catalog: CatalogRpcGateway,
    private readonly internalJwt: InternalJwtService,
  ) {}

  private token(req: GatewayRequestWithSession): string {
    return this.internalJwt.issueForRequest(req, 'catalog');
  }

  @Get('latest')
  latest(
    @Req() req: GatewayRequestWithSession,
    @Param('menuItemId') menuItemId: string,
  ) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.getNutrition, {
      internalAuth: this.token(req),
      menuItemId,
    });
  }

  @Post('analyze-recipe')
  @Sse('analyze-recipe')
  analyze(
    @Req() req: GatewayRequestWithSession,
    @Param('menuItemId') menuItemId: string,
    @Body() dto: unknown,
  ): Observable<MessageEvent> {
    return this.catalog
      .stream(CATALOG_RPC_PATTERNS.analyzeNutrition, {
        internalAuth: this.token(req),
        menuItemId,
        dto,
      })
      .pipe(
        map((response: any) => {
          return { data: response } as MessageEvent;
        }),
      );
  }

  @Post('manual-session')
  startManualSession(
    @Req() req: GatewayRequestWithSession,
    @Param('menuItemId') menuItemId: string,
  ) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.startManualNutrition, {
      internalAuth: this.token(req),
      menuItemId,
    });
  }

  @Post('calculate')
  calculate(
    @Req() req: GatewayRequestWithSession,
    @Param('menuItemId') menuItemId: string,
    @Body() dto: unknown,
  ) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.calculateNutrition, {
      internalAuth: this.token(req),
      menuItemId,
      dto,
    });
  }

  @Put()
  save(
    @Req() req: GatewayRequestWithSession,
    @Param('menuItemId') menuItemId: string,
    @Body() dto: unknown,
  ) {
    return this.catalog.send(CATALOG_RPC_PATTERNS.upsertNutrition, {
      internalAuth: this.token(req),
      menuItemId,
      dto,
    });
  }
}
