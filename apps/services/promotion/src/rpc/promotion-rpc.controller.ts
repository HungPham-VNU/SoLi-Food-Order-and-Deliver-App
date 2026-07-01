import { Controller, ForbiddenException } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  PROMOTION_RPC_PATTERNS,
  discountPreviewParamsSchema,
  discountReservationParamsSchema,
  listActivePromotionsRequestSchema,
  reservationByOrderRequestSchema,
  adminListPromotionsRequestSchema,
  adminPromotionIdRequestSchema,
  adminCreatePromotionRequestSchema,
  adminUpdatePromotionRequestSchema,
  adminListCouponsRequestSchema,
  adminGenerateCouponsRequestSchema,
  adminRevokeCouponRequestSchema,
  restaurantListPromotionsRequestSchema,
  restaurantPromotionIdRequestSchema,
  restaurantCreatePromotionRequestSchema,
  restaurantUpdatePromotionRequestSchema,
  type PreviewDiscountRequest,
  type ReserveDiscountRequest,
  type ReservationByOrderRequest,
  type ListActivePromotionsRequest,
  type AdminListPromotionsRequest,
  type AdminPromotionIdRequest,
  type AdminCreatePromotionRequest,
  type AdminUpdatePromotionRequest,
  type AdminListCouponsRequest,
  type AdminGenerateCouponsRequest,
  type AdminRevokeCouponRequest,
  type RestaurantListPromotionsRequest,
  type RestaurantPromotionIdRequest,
  type RestaurantCreatePromotionRequest,
  type RestaurantUpdatePromotionRequest,
} from '@uitfood/contracts';
import { PromotionService } from '@/promotion/services/promotion.service';
import { InternalAuthService } from '@/auth/internal-auth.service';
import { asPromotionRpcException } from './promotion-rpc.errors';

/**
 * Promotion TCP RPC surface — the discount lifecycle + the public active-promotion
 * read. Lifecycle calls verify the inbound `aud=promotion` internal JWT; the
 * public list is anonymous.
 */
@Controller()
export class PromotionRpcController {
  constructor(
    private readonly service: PromotionService,
    private readonly auth: InternalAuthService,
  ) {}

  @MessagePattern(PROMOTION_RPC_PATTERNS.previewDiscount)
  async preview(@Payload() p: PreviewDiscountRequest) {
    try {
      this.auth.verifyPromotionToken(p.internalAuth);
      const params = discountPreviewParamsSchema.parse(p.params);
      return await this.service.previewDiscount(params);
    } catch (e) {
      throw asPromotionRpcException(e);
    }
  }

  @MessagePattern(PROMOTION_RPC_PATTERNS.reserveDiscount)
  async reserve(@Payload() p: ReserveDiscountRequest) {
    try {
      this.auth.verifyPromotionToken(p.internalAuth);
      const params = discountReservationParamsSchema.parse(p.params);
      return await this.service.computeAndReserveDiscount(params);
    } catch (e) {
      throw asPromotionRpcException(e);
    }
  }

  @MessagePattern(PROMOTION_RPC_PATTERNS.confirmReservations)
  async confirm(@Payload() p: ReservationByOrderRequest) {
    try {
      this.auth.verifyPromotionToken(p.internalAuth);
      const { orderId } = reservationByOrderRequestSchema.parse(p);
      await this.service.confirmReservations(orderId);
      return { ok: true };
    } catch (e) {
      throw asPromotionRpcException(e);
    }
  }

  @MessagePattern(PROMOTION_RPC_PATTERNS.rollbackReservations)
  async rollback(@Payload() p: ReservationByOrderRequest) {
    try {
      this.auth.verifyPromotionToken(p.internalAuth);
      const { orderId } = reservationByOrderRequestSchema.parse(p);
      await this.service.rollbackReservations(orderId);
      return { ok: true };
    } catch (e) {
      throw asPromotionRpcException(e);
    }
  }

  @MessagePattern(PROMOTION_RPC_PATTERNS.listActivePromotions)
  async listActive(@Payload() p: ListActivePromotionsRequest) {
    try {
      const { restaurantId } = listActivePromotionsRequestSchema.parse(p ?? {});
      return await this.service.listPublicActive(restaurantId, new Date());
    } catch (e) {
      throw asPromotionRpcException(e);
    }
  }

  // ---------------------------------------------------------------------------
  // Admin CRUD — promotion + coupon management. Every handler re-verifies the
  // `aud=promotion` token and requires the `admin` role.
  // ---------------------------------------------------------------------------

  @MessagePattern(PROMOTION_RPC_PATTERNS.adminListPromotions)
  async adminList(@Payload() p: AdminListPromotionsRequest) {
    try {
      const req = adminListPromotionsRequestSchema.parse(p);
      this.requireAdmin(req.internalAuth);
      return await this.service.adminList(req);
    } catch (e) {
      throw asPromotionRpcException(e);
    }
  }

  @MessagePattern(PROMOTION_RPC_PATTERNS.adminGetPromotion)
  async adminGet(@Payload() p: AdminPromotionIdRequest) {
    try {
      const req = adminPromotionIdRequestSchema.parse(p);
      this.requireAdmin(req.internalAuth);
      return await this.service.adminGet(req.id);
    } catch (e) {
      throw asPromotionRpcException(e);
    }
  }

  @MessagePattern(PROMOTION_RPC_PATTERNS.adminCreatePromotion)
  async adminCreate(@Payload() p: AdminCreatePromotionRequest) {
    try {
      const req = adminCreatePromotionRequestSchema.parse(p);
      this.requireAdmin(req.internalAuth);
      return await this.service.adminCreate(req.data);
    } catch (e) {
      throw asPromotionRpcException(e);
    }
  }

  @MessagePattern(PROMOTION_RPC_PATTERNS.adminUpdatePromotion)
  async adminUpdate(@Payload() p: AdminUpdatePromotionRequest) {
    try {
      const req = adminUpdatePromotionRequestSchema.parse(p);
      this.requireAdmin(req.internalAuth);
      return await this.service.adminUpdate(req.id, req.data);
    } catch (e) {
      throw asPromotionRpcException(e);
    }
  }

  @MessagePattern(PROMOTION_RPC_PATTERNS.adminActivatePromotion)
  async adminActivate(@Payload() p: AdminPromotionIdRequest) {
    try {
      const req = adminPromotionIdRequestSchema.parse(p);
      this.requireAdmin(req.internalAuth);
      return await this.service.adminActivate(req.id);
    } catch (e) {
      throw asPromotionRpcException(e);
    }
  }

  @MessagePattern(PROMOTION_RPC_PATTERNS.adminPausePromotion)
  async adminPause(@Payload() p: AdminPromotionIdRequest) {
    try {
      const req = adminPromotionIdRequestSchema.parse(p);
      this.requireAdmin(req.internalAuth);
      return await this.service.adminPause(req.id);
    } catch (e) {
      throw asPromotionRpcException(e);
    }
  }

  @MessagePattern(PROMOTION_RPC_PATTERNS.adminCancelPromotion)
  async adminCancel(@Payload() p: AdminPromotionIdRequest) {
    try {
      const req = adminPromotionIdRequestSchema.parse(p);
      this.requireAdmin(req.internalAuth);
      return await this.service.adminCancel(req.id);
    } catch (e) {
      throw asPromotionRpcException(e);
    }
  }

  @MessagePattern(PROMOTION_RPC_PATTERNS.adminListCoupons)
  async adminListCoupons(@Payload() p: AdminListCouponsRequest) {
    try {
      const req = adminListCouponsRequestSchema.parse(p);
      this.requireAdmin(req.internalAuth);
      return await this.service.adminListCoupons(req.promotionId, req);
    } catch (e) {
      throw asPromotionRpcException(e);
    }
  }

  @MessagePattern(PROMOTION_RPC_PATTERNS.adminGenerateCoupons)
  async adminGenerateCoupons(@Payload() p: AdminGenerateCouponsRequest) {
    try {
      const req = adminGenerateCouponsRequestSchema.parse(p);
      this.requireAdmin(req.internalAuth);
      return await this.service.adminGenerateCoupons(req.promotionId, req);
    } catch (e) {
      throw asPromotionRpcException(e);
    }
  }

  @MessagePattern(PROMOTION_RPC_PATTERNS.adminRevokeCoupon)
  async adminRevokeCoupon(@Payload() p: AdminRevokeCouponRequest) {
    try {
      const req = adminRevokeCouponRequestSchema.parse(p);
      this.requireAdmin(req.internalAuth);
      return await this.service.adminRevokeCoupon(
        req.promotionId,
        req.couponId,
      );
    } catch (e) {
      throw asPromotionRpcException(e);
    }
  }

  private requireAdmin(internalAuth: string) {
    const caller = this.auth.verifyPromotionToken(internalAuth);
    if (!caller.isAdmin) {
      throw new ForbiddenException('Admin role required.');
    }
  }

  // ---------------------------------------------------------------------------
  // Restaurant-owner CRUD — promotion management scoped to one restaurant.
  // Every handler re-verifies the `aud=promotion` token; PromotionService
  // verifies restaurant ownership against Catalog before any write.
  // ---------------------------------------------------------------------------

  @MessagePattern(PROMOTION_RPC_PATTERNS.restaurantListPromotions)
  async restaurantList(@Payload() p: RestaurantListPromotionsRequest) {
    try {
      const req = restaurantListPromotionsRequestSchema.parse(p);
      this.auth.verifyPromotionToken(req.internalAuth);
      return await this.service.restaurantList(req.restaurantId, req);
    } catch (e) {
      throw asPromotionRpcException(e);
    }
  }

  @MessagePattern(PROMOTION_RPC_PATTERNS.restaurantGetPromotion)
  async restaurantGet(@Payload() p: RestaurantPromotionIdRequest) {
    try {
      const req = restaurantPromotionIdRequestSchema.parse(p);
      this.auth.verifyPromotionToken(req.internalAuth);
      return await this.service.restaurantGet(req.restaurantId, req.id);
    } catch (e) {
      throw asPromotionRpcException(e);
    }
  }

  @MessagePattern(PROMOTION_RPC_PATTERNS.restaurantCreatePromotion)
  async restaurantCreate(@Payload() p: RestaurantCreatePromotionRequest) {
    try {
      const req = restaurantCreatePromotionRequestSchema.parse(p);
      const caller = this.auth.verifyPromotionToken(req.internalAuth);
      return await this.service.restaurantCreate(
        req.restaurantId,
        caller.userId,
        caller.isAdmin,
        req.data,
      );
    } catch (e) {
      throw asPromotionRpcException(e);
    }
  }

  @MessagePattern(PROMOTION_RPC_PATTERNS.restaurantUpdatePromotion)
  async restaurantUpdate(@Payload() p: RestaurantUpdatePromotionRequest) {
    try {
      const req = restaurantUpdatePromotionRequestSchema.parse(p);
      const caller = this.auth.verifyPromotionToken(req.internalAuth);
      return await this.service.restaurantUpdate(
        req.restaurantId,
        caller.userId,
        caller.isAdmin,
        req.id,
        req.data,
      );
    } catch (e) {
      throw asPromotionRpcException(e);
    }
  }

  @MessagePattern(PROMOTION_RPC_PATTERNS.restaurantActivatePromotion)
  async restaurantActivate(@Payload() p: RestaurantPromotionIdRequest) {
    try {
      const req = restaurantPromotionIdRequestSchema.parse(p);
      const caller = this.auth.verifyPromotionToken(req.internalAuth);
      return await this.service.restaurantActivate(
        req.restaurantId,
        caller.userId,
        caller.isAdmin,
        req.id,
      );
    } catch (e) {
      throw asPromotionRpcException(e);
    }
  }

  @MessagePattern(PROMOTION_RPC_PATTERNS.restaurantPausePromotion)
  async restaurantPause(@Payload() p: RestaurantPromotionIdRequest) {
    try {
      const req = restaurantPromotionIdRequestSchema.parse(p);
      const caller = this.auth.verifyPromotionToken(req.internalAuth);
      return await this.service.restaurantPause(
        req.restaurantId,
        caller.userId,
        caller.isAdmin,
        req.id,
      );
    } catch (e) {
      throw asPromotionRpcException(e);
    }
  }

  @MessagePattern(PROMOTION_RPC_PATTERNS.restaurantCancelPromotion)
  async restaurantCancel(@Payload() p: RestaurantPromotionIdRequest) {
    try {
      const req = restaurantPromotionIdRequestSchema.parse(p);
      const caller = this.auth.verifyPromotionToken(req.internalAuth);
      return await this.service.restaurantCancel(
        req.restaurantId,
        caller.userId,
        caller.isAdmin,
        req.id,
      );
    } catch (e) {
      throw asPromotionRpcException(e);
    }
  }
}
