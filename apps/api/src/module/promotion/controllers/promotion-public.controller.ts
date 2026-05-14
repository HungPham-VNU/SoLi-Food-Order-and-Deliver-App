import { Controller, Get, Post, HttpCode, HttpStatus, Query, Body } from '@nestjs/common';
import {
  AllowAnonymous,
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { PromotionService } from '../services/promotion.service';
import {
  PreviewDiscountDto,
  PreviewDiscountResponseDto,
  PromotionResponseDto,
  ValidateCouponDto,
} from '../dto/promotion.dto';

/**
 * PromotionPublicController
 *
 * Customer-facing (and anonymous) endpoints for promotion discovery.
 * Base path: /promotions
 *
 * Endpoints:
 *   GET  /promotions/active          — list active auto-apply promotions for a restaurant (anonymous)
 *   POST /promotions/preview         — preview discount for a cart (authenticated)
 *   POST /promotions/coupons/validate — validate a coupon code (authenticated)
 */
@ApiTags('Promotions — Public')
@ApiBearerAuth()
@Controller('promotions')
export class PromotionPublicController {
  constructor(private readonly promotionService: PromotionService) {}

  @Get('active')
  @AllowAnonymous()
  @ApiOperation({
    summary: 'List active auto-apply promotions',
    description:
      'Returns currently active auto-apply promotions for a restaurant ' +
      '(or platform-wide if no restaurantId is provided). ' +
      'Customers can use this to show active deal banners in the cart UI.',
  })
  @ApiQuery({
    name: 'restaurantId',
    type: String,
    format: 'uuid',
    required: false,
    description:
      'Filter by restaurant UUID. Omit to get platform-wide promotions only.',
  })
  @ApiOkResponse({ type: [PromotionResponseDto] })
  async getActive(
    @Query('restaurantId') restaurantId?: string,
  ): Promise<PromotionResponseDto[]> {
    const rows = await this.promotionService.listPublicActive(
      restaurantId,
      new Date(),
    );
    return rows.map((r) => PromotionResponseDto.fromRow(r));
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Preview discount for a cart',
    description:
      'Read-only discount preview — no reservation is created. ' +
      'Supply itemsSubtotal + shippingFee + optional couponCode to get the computed discount.',
  })
  @ApiOkResponse({ type: PreviewDiscountResponseDto })
  async previewDiscount(
    @Body() dto: PreviewDiscountDto,
    @Session() session: UserSession,
  ): Promise<PreviewDiscountResponseDto> {
    const result = await this.promotionService.previewDiscount({
      customerId: session.user.id,
      restaurantId: dto.restaurantId,
      items: [],
      itemsSubtotal: dto.itemsSubtotal,
      shippingFee: dto.shippingFee,
      couponCode: dto.couponCode,
    });

    return {
      applicable: result.applicable,
      promotionId: result.promotionId,
      couponCodeId: result.couponCodeId,
      discountAmount: result.discountAmount,
      finalItemsSubtotal: result.finalItemsSubtotal,
      finalShippingFee: result.finalShippingFee,
      reason: result.reason,
    };
  }

  @Post('coupons/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate a coupon code',
    description:
      'Checks whether a coupon code is valid for the given restaurant and cart total. ' +
      'Does not consume the coupon. Returns the computed discount if applicable.',
  })
  @ApiOkResponse({ type: PreviewDiscountResponseDto })
  async validateCoupon(
    @Body() dto: ValidateCouponDto,
    @Session() session: UserSession,
  ): Promise<PreviewDiscountResponseDto> {
    const result = await this.promotionService.previewDiscount({
      customerId: session.user.id,
      restaurantId: dto.restaurantId,
      items: [],
      itemsSubtotal: dto.itemsSubtotal,
      shippingFee: dto.shippingFee,
      couponCode: dto.code,
    });

    return {
      applicable: result.applicable,
      promotionId: result.promotionId,
      couponCodeId: result.couponCodeId,
      discountAmount: result.discountAmount,
      finalItemsSubtotal: result.finalItemsSubtotal,
      finalShippingFee: result.finalShippingFee,
      reason: result.reason,
    };
  }
}
