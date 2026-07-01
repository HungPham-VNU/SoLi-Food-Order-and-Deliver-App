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
  Omit<CreatePromotionBody, 'type' | 'scope' | 'trigger'>
>;

interface GenerateCouponsBody {
  codes: string[];
  maxUsesPerCode?: number;
  expiresAt?: string;
}

/**
 * Admin Promotion management endpoints — promotion CRUD + lifecycle
 * transitions and coupon code management. Translates HTTP into Promotion TCP
 * RPC; the admin role is re-checked inside the Promotion service.
 */
@ApiTags('Promotions: Admin')
@ApiBearerAuth()
@Controller('api/promotions/admin')
@UseGuards(PromotionSessionGuard)
export class AdminPromotionsController {
  constructor(
    @Inject(PROMOTION_RPC_GATEWAY)
    private readonly promotion: PromotionRpcGateway,
    private readonly internalJwt: InternalJwtService,
  ) {}

  private token(req: GatewayRequestWithSession): string {
    return this.internalJwt.issueForRequest(req, 'promotion');
  }

  @Get()
  list(
    @Req() req: GatewayRequestWithSession,
    @Query('status') status?: string,
    @Query('restaurantId') restaurantId?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.promotion.send(PROMOTION_RPC_PATTERNS.adminListPromotions, {
      internalAuth: this.token(req),
      status,
      restaurantId,
      offset,
      limit,
    });
  }

  @Get(':id')
  get(@Req() req: GatewayRequestWithSession, @Param('id') id: string) {
    return this.promotion.send(PROMOTION_RPC_PATTERNS.adminGetPromotion, {
      internalAuth: this.token(req),
      id,
    });
  }

  @Post()
  create(
    @Req() req: GatewayRequestWithSession,
    @Body() body: CreatePromotionBody,
  ) {
    return this.promotion.send(PROMOTION_RPC_PATTERNS.adminCreatePromotion, {
      internalAuth: this.token(req),
      data: body,
    });
  }

  @Patch(':id')
  update(
    @Req() req: GatewayRequestWithSession,
    @Param('id') id: string,
    @Body() body: UpdatePromotionBody,
  ) {
    return this.promotion.send(PROMOTION_RPC_PATTERNS.adminUpdatePromotion, {
      internalAuth: this.token(req),
      id,
      data: body,
    });
  }

  @Delete(':id')
  cancel(@Req() req: GatewayRequestWithSession, @Param('id') id: string) {
    return this.promotion.send(PROMOTION_RPC_PATTERNS.adminCancelPromotion, {
      internalAuth: this.token(req),
      id,
    });
  }

  @Patch(':id/activate')
  activate(@Req() req: GatewayRequestWithSession, @Param('id') id: string) {
    return this.promotion.send(PROMOTION_RPC_PATTERNS.adminActivatePromotion, {
      internalAuth: this.token(req),
      id,
    });
  }

  @Patch(':id/pause')
  pause(@Req() req: GatewayRequestWithSession, @Param('id') id: string) {
    return this.promotion.send(PROMOTION_RPC_PATTERNS.adminPausePromotion, {
      internalAuth: this.token(req),
      id,
    });
  }

  @Get(':id/coupons')
  listCoupons(
    @Req() req: GatewayRequestWithSession,
    @Param('id') id: string,
    @Query('status') status?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.promotion.send(PROMOTION_RPC_PATTERNS.adminListCoupons, {
      internalAuth: this.token(req),
      promotionId: id,
      status,
      offset,
      limit,
    });
  }

  @Post(':id/coupons')
  generateCoupons(
    @Req() req: GatewayRequestWithSession,
    @Param('id') id: string,
    @Body() body: GenerateCouponsBody,
  ) {
    return this.promotion.send(PROMOTION_RPC_PATTERNS.adminGenerateCoupons, {
      internalAuth: this.token(req),
      promotionId: id,
      codes: body.codes,
      maxUsesPerCode: body.maxUsesPerCode,
      expiresAt: body.expiresAt,
    });
  }

  @Patch(':id/coupons/:couponId/revoke')
  revokeCoupon(
    @Req() req: GatewayRequestWithSession,
    @Param('id') id: string,
    @Param('couponId') couponId: string,
  ) {
    return this.promotion.send(PROMOTION_RPC_PATTERNS.adminRevokeCoupon, {
      internalAuth: this.token(req),
      promotionId: id,
      couponId,
    });
  }
}
