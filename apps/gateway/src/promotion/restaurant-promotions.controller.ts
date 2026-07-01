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
import { PROMOTION_RPC_PATTERNS } from '@uitfood/contracts';
import type { PromotionRpcGateway } from './promotion.interfaces';
import { PROMOTION_RPC_GATEWAY } from './promotion.tokens';
import { PromotionSessionGuard } from './promotion-session.guard';
import { InternalJwtService } from '@/identity/internal-jwt.service';
import type { GatewayRequestWithSession } from '@/identity/identity.interfaces';

interface CreatePromotionBody {
  name: string;
  description?: string;
  type: string;
  scope: string;
  trigger: string;
  stackingMode?: string;
  restaurantId?: string;
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  maxTotalUses?: number;
  maxUsesPerUser?: number;
  startsAt: string;
  endsAt: string;
}

type UpdatePromotionBody = Partial<
  Omit<CreatePromotionBody, 'type' | 'scope' | 'trigger' | 'restaurantId'>
>;

/**
 * Restaurant-owner Promotion management endpoints — promotion CRUD +
 * lifecycle transitions scoped to the caller's own restaurant. Translates
 * HTTP into Promotion TCP RPC; ownership of `restaurantId` is re-verified
 * inside the Promotion service (against Catalog) before any write.
 */
@ApiTags('Promotions: Restaurant')
@ApiBearerAuth()
@Controller('api/promotions/restaurant')
@UseGuards(PromotionSessionGuard)
export class RestaurantPromotionsController {
  constructor(
    @Inject(PROMOTION_RPC_GATEWAY)
    private readonly promotion: PromotionRpcGateway,
    private readonly internalJwt: InternalJwtService,
  ) {}

  private token(req: GatewayRequestWithSession): string {
    return this.internalJwt.issueForRequest(req, 'promotion');
  }

  // 'my' is declared before ':id' so it isn't captured as an id.
  @Get('my')
  list(
    @Req() req: GatewayRequestWithSession,
    @Query('restaurantId') restaurantId: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.promotion.send(
      PROMOTION_RPC_PATTERNS.restaurantListPromotions,
      {
        internalAuth: this.token(req),
        restaurantId,
        offset,
        limit,
      },
    );
  }

  @Get(':id')
  get(
    @Req() req: GatewayRequestWithSession,
    @Param('id') id: string,
    @Query('restaurantId') restaurantId: string,
  ) {
    return this.promotion.send(PROMOTION_RPC_PATTERNS.restaurantGetPromotion, {
      internalAuth: this.token(req),
      restaurantId,
      id,
    });
  }

  @Post()
  create(
    @Req() req: GatewayRequestWithSession,
    @Query('restaurantId') restaurantId: string,
    @Body() body: CreatePromotionBody,
  ) {
    return this.promotion.send(
      PROMOTION_RPC_PATTERNS.restaurantCreatePromotion,
      {
        internalAuth: this.token(req),
        restaurantId,
        data: body,
      },
    );
  }

  @Patch(':id')
  update(
    @Req() req: GatewayRequestWithSession,
    @Param('id') id: string,
    @Query('restaurantId') restaurantId: string,
    @Body() body: UpdatePromotionBody,
  ) {
    return this.promotion.send(
      PROMOTION_RPC_PATTERNS.restaurantUpdatePromotion,
      {
        internalAuth: this.token(req),
        restaurantId,
        id,
        data: body,
      },
    );
  }

  @Patch(':id/activate')
  activate(
    @Req() req: GatewayRequestWithSession,
    @Param('id') id: string,
    @Query('restaurantId') restaurantId: string,
  ) {
    return this.promotion.send(
      PROMOTION_RPC_PATTERNS.restaurantActivatePromotion,
      { internalAuth: this.token(req), restaurantId, id },
    );
  }

  @Patch(':id/pause')
  pause(
    @Req() req: GatewayRequestWithSession,
    @Param('id') id: string,
    @Query('restaurantId') restaurantId: string,
  ) {
    return this.promotion.send(
      PROMOTION_RPC_PATTERNS.restaurantPausePromotion,
      {
        internalAuth: this.token(req),
        restaurantId,
        id,
      },
    );
  }

  @Delete(':id')
  cancel(
    @Req() req: GatewayRequestWithSession,
    @Param('id') id: string,
    @Query('restaurantId') restaurantId: string,
  ) {
    return this.promotion.send(
      PROMOTION_RPC_PATTERNS.restaurantCancelPromotion,
      {
        internalAuth: this.token(req),
        restaurantId,
        id,
      },
    );
  }
}
