import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
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

interface PreviewBody {
  restaurantId: string;
  itemsSubtotal: number;
  shippingFee: number;
  couponCode?: string;
}

interface ValidateCouponBody {
  restaurantId: string;
  itemsSubtotal: number;
  shippingFee: number;
  code: string;
}

/**
 * Public Promotion endpoints. Mirrors the public
 * PromotionPublicController surface, translating HTTP into Promotion TCP RPC.
 */
@ApiTags('Promotions: Public')
@ApiBearerAuth()
@Controller('api/promotions')
export class PromotionsController {
  constructor(
    @Inject(PROMOTION_RPC_GATEWAY)
    private readonly promotion: PromotionRpcGateway,
    private readonly internalJwt: InternalJwtService,
  ) {}

  private token(req: GatewayRequestWithSession): string {
    return this.internalJwt.issueForRequest(req, 'promotion');
  }

  @Get('active')
  active(@Query('restaurantId') restaurantId?: string) {
    return this.promotion.send(PROMOTION_RPC_PATTERNS.listActivePromotions, {
      restaurantId,
    });
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PromotionSessionGuard)
  preview(@Req() req: GatewayRequestWithSession, @Body() body: PreviewBody) {
    return this.promotion.send(PROMOTION_RPC_PATTERNS.previewDiscount, {
      internalAuth: this.token(req),
      params: {
        customerId: req.gatewaySession!.userId,
        restaurantId: body.restaurantId,
        items: [],
        itemsSubtotal: body.itemsSubtotal,
        shippingFee: body.shippingFee,
        couponCode: body.couponCode,
      },
    });
  }

  @Post('coupons/validate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PromotionSessionGuard)
  validateCoupon(
    @Req() req: GatewayRequestWithSession,
    @Body() body: ValidateCouponBody,
  ) {
    return this.promotion.send(PROMOTION_RPC_PATTERNS.previewDiscount, {
      internalAuth: this.token(req),
      params: {
        customerId: req.gatewaySession!.userId,
        restaurantId: body.restaurantId,
        items: [],
        itemsSubtotal: body.itemsSubtotal,
        shippingFee: body.shippingFee,
        couponCode: body.code,
      },
    });
  }
}
