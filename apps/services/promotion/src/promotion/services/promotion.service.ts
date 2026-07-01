import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  CreatePromotionInput,
  UpdatePromotionInput,
} from '@uitfood/contracts';
import {
  IPromotionApplicationPort,
  DiscountPreviewParams,
  DiscountPreviewResult,
  DiscountReservationParams,
  DiscountReservationResult,
  DiscountBreakdown,
} from '@/shared/ports/promotion-application.port';
import { CatalogRestaurantLookupService } from '@/integration/catalog/catalog-restaurant-lookup.service';
import { PromotionRepository } from '../repositories/promotion.repository';
import { CouponCodeRepository } from '../repositories/coupon-code.repository';
import { PromotionUsageRepository } from '../repositories/promotion-usage.repository';
import { PromotionPricingEngine } from '../engine/promotion-pricing-engine';
import type {
  CouponCode,
  CouponStatus,
  Promotion,
  PromotionStatus,
} from '../domain/promotion.schema';

/**
 * PromotionService — implements IPromotionApplicationPort.
 *
 * Orchestrates the full promotion lifecycle:
 *   - previewDiscount: read-only eligibility + discount calculation
 *   - computeAndReserveDiscount: atomically reserves discount for a pending order
 *   - confirmReservations: transitions reserved → confirmed after order persistence
 *   - rollbackReservations: transitions reserved/confirmed → rolled_back on cancel
 *
 * PromotionModule exposes this service only through PROMOTION_APPLICATION_PORT.
 * Consumers import PromotionModule explicitly.
 */
@Injectable()
export class PromotionService implements IPromotionApplicationPort {
  private readonly logger = new Logger(PromotionService.name);
  private readonly engine = new PromotionPricingEngine();

  constructor(
    private readonly promotionRepo: PromotionRepository,
    private readonly couponRepo: CouponCodeRepository,
    private readonly usageRepo: PromotionUsageRepository,
    private readonly catalogLookup: CatalogRestaurantLookupService,
  ) {}

  // ---------------------------------------------------------------------------
  // previewDiscount — read-only
  // ---------------------------------------------------------------------------

  async previewDiscount(
    params: DiscountPreviewParams,
  ): Promise<DiscountPreviewResult> {
    const now = new Date();
    const { customerId, restaurantId, itemsSubtotal, shippingFee, couponCode } =
      params;

    // ------------------------------------------------------------------
    // Branch A: coupon code supplied — find the matching promotion
    // ------------------------------------------------------------------
    if (couponCode) {
      return this.previewCoupon(
        couponCode,
        restaurantId,
        customerId,
        itemsSubtotal,
        shippingFee,
        now,
      );
    }

    // ------------------------------------------------------------------
    // Branch B: auto-apply — find best applicable promotion
    // ------------------------------------------------------------------
    return this.previewAutoApply(
      restaurantId,
      customerId,
      itemsSubtotal,
      shippingFee,
      now,
    );
  }

  // ---------------------------------------------------------------------------
  // computeAndReserveDiscount — writes to DB
  // ---------------------------------------------------------------------------

  async computeAndReserveDiscount(
    params: DiscountReservationParams,
  ): Promise<DiscountReservationResult> {
    const now = new Date();
    const {
      customerId,
      restaurantId,
      itemsSubtotal,
      shippingFee,
      couponCode,
      tempOrderId,
    } = params;

    const noDiscount = (reason: string): DiscountReservationResult => ({
      reserved: false,
      promotionId: null,
      couponCodeId: null,
      usageId: null,
      discountAmount: 0,
      breakdown: [],
      reason,
    });

    try {
      // ------------------------------------------------------------------
      // Step 1: find the applicable promotion + run engine
      // ------------------------------------------------------------------
      let promotion: Promotion | null = null;
      let couponCodeId: string | null = null;

      if (couponCode) {
        const normalized = couponCode.trim().toUpperCase();
        const coupon = await this.couponRepo.findActiveByCode(normalized, now);
        if (!coupon) return noDiscount('Coupon code not found or inactive');

        promotion =
          await this.promotionRepo.findActiveCouponPromotionForRestaurant(
            coupon.promotionId,
            restaurantId,
            now,
          );
        if (!promotion)
          return noDiscount('Promotion for this coupon is not available');
        couponCodeId = coupon.id;
      } else {
        // Pick the best auto-apply promotion (highest discount)
        const candidates =
          await this.promotionRepo.findActiveAutoApplyForRestaurant(
            restaurantId,
            now,
          );

        let bestDiscount = 0;
        for (const p of candidates) {
          // Skip promotions the customer has already exhausted their per-user
          // quota on, so reservation selection matches previewAutoApply (which
          // filters inside the loop). Without this, the engine could pick a
          // higher-discount promotion the user can no longer use and bail in
          // Step 3 — denying a deserved lesser discount and diverging from the
          // previewed amount.
          if (p.maxUsesPerUser !== null && p.maxUsesPerUser !== undefined) {
            const userUses = await this.usageRepo.countActiveUsagesByCustomer(
              p.id,
              customerId,
            );
            if (userUses >= p.maxUsesPerUser) continue;
          }

          const result = this.engine.computeDiscount({
            promotion: p,
            itemsSubtotal,
            shippingFee,
            now,
          });
          if (result.eligible && result.discountAmount > bestDiscount) {
            bestDiscount = result.discountAmount;
            promotion = p;
          }
        }
      }

      if (!promotion) return noDiscount('No applicable promotion found');

      // ------------------------------------------------------------------
      // Step 2: run pricing engine
      // ------------------------------------------------------------------
      const pricing = this.engine.computeDiscount({
        promotion,
        itemsSubtotal,
        shippingFee,
        now,
      });
      if (!pricing.eligible)
        return noDiscount(pricing.reason ?? 'Not eligible');

      // ------------------------------------------------------------------
      // Step 3: per-user quota check
      // ------------------------------------------------------------------
      if (
        promotion.maxUsesPerUser !== null &&
        promotion.maxUsesPerUser !== undefined
      ) {
        const userUses = await this.usageRepo.countActiveUsagesByCustomer(
          promotion.id,
          customerId,
        );
        if (userUses >= promotion.maxUsesPerUser) {
          return noDiscount(
            `You have already used this promotion ${userUses} time(s)`,
          );
        }
      }

      // ------------------------------------------------------------------
      // Step 4: atomically increment total uses on the promotion
      // ------------------------------------------------------------------
      const quotaOk = await this.promotionRepo.atomicIncrementUses(
        promotion.id,
      );
      if (!quotaOk) return noDiscount('Promotion quota exhausted');

      // ------------------------------------------------------------------
      // From here the promotion counter is incremented. Any failure before the
      // promotion_usages reservation row is persisted must compensate the
      // counters — otherwise they leak permanently: there is no usage row for
      // the cleanup task (releaseStaleReservations) to find and roll back.
      // ------------------------------------------------------------------
      let couponIncremented = false;
      try {
        // ----------------------------------------------------------------
        // Step 5: atomically increment coupon uses (if coupon trigger)
        // ----------------------------------------------------------------
        if (couponCodeId) {
          const couponOk = await this.couponRepo.atomicIncrementUses(
            couponCodeId,
            now,
          );
          if (!couponOk) {
            // Rollback the promotion increment before returning
            await this.promotionRepo.decrementUses(promotion.id);
            return noDiscount('Coupon code has been exhausted or expired');
          }
          couponIncremented = true;
          // Check if code is now exhausted and update status
          await this.couponRepo.checkAndMarkExhausted(couponCodeId);
        }

        // ----------------------------------------------------------------
        // Step 6: insert promotion_usages reservation row
        // ----------------------------------------------------------------
        const usage = await this.usageRepo.create({
          id: randomUUID(),
          promotionId: promotion.id,
          couponCodeId,
          orderId: tempOrderId,
          customerId,
          discountOnItems: pricing.discountOnItems,
          discountOnShipping: pricing.discountOnShipping,
          discountAmount: pricing.discountAmount,
          status: 'reserved',
          reservedAt: now,
        });

        this.logger.log(
          `Discount reserved: promotionId=${promotion.id} orderId=${tempOrderId} ` +
            `discount=${pricing.discountAmount} VND usageId=${usage.id}`,
        );

        return {
          reserved: true,
          promotionId: promotion.id,
          couponCodeId,
          usageId: usage.id,
          discountAmount: pricing.discountAmount,
          breakdown: [pricing.breakdown],
        };
      } catch (innerErr) {
        // Compensate every counter we incremented before the failure so a
        // transient DB error can never permanently consume quota.
        await this.promotionRepo.decrementUses(promotion.id);
        if (couponIncremented && couponCodeId) {
          await this.couponRepo.decrementUses(couponCodeId);
        }
        throw innerErr;
      }
    } catch (err) {
      this.logger.error('computeAndReserveDiscount failed', err);
      // On unexpected errors, return no-discount rather than failing checkout
      return noDiscount('Promotion service temporarily unavailable');
    }
  }

  // ---------------------------------------------------------------------------
  // confirmReservations
  // ---------------------------------------------------------------------------

  async confirmReservations(orderId: string): Promise<void> {
    try {
      await this.usageRepo.confirmByOrderId(orderId);
      this.logger.log(`Promotion reservations confirmed for order=${orderId}`);
    } catch (err) {
      // Log but don't rethrow — promotion confirmation failure must never
      // abort an already-committed order
      this.logger.error(`confirmReservations failed for order=${orderId}`, err);
    }
  }

  // ---------------------------------------------------------------------------
  // rollbackReservations
  // ---------------------------------------------------------------------------

  async rollbackReservations(orderId: string): Promise<void> {
    try {
      const rolledBack = await this.usageRepo.rollbackByOrderId(orderId);
      // Decrement counters for each rolled-back usage
      for (const usage of rolledBack) {
        await this.promotionRepo.decrementUses(usage.promotionId);
        if (usage.couponCodeId) {
          await this.couponRepo.decrementUses(usage.couponCodeId);
        }
      }
      if (rolledBack.length > 0) {
        this.logger.log(
          `Rolled back ${rolledBack.length} promotion usage(s) for order=${orderId}`,
        );
      }
    } catch (err) {
      // Log but don't rethrow — rollback failure must never block order cancellation
      this.logger.error(
        `rollbackReservations failed for order=${orderId}`,
        err,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // releaseStaleReservations (Cron Task)
  // ---------------------------------------------------------------------------

  async releaseStaleReservations(cutoff: Date): Promise<number> {
    try {
      const staleUsages = await this.usageRepo.findStaleReservations(
        cutoff,
        500,
      );
      if (staleUsages.length === 0) return 0;

      const rolledBack = await this.usageRepo.rollbackByIds(
        staleUsages.map((u) => u.id),
      );

      // Decrement counters for each rolled-back usage
      for (const usage of rolledBack) {
        await this.promotionRepo.decrementUses(usage.promotionId);
        if (usage.couponCodeId) {
          await this.couponRepo.decrementUses(usage.couponCodeId);
        }
      }

      if (rolledBack.length > 0) {
        this.logger.log(
          `Released ${rolledBack.length} stale promotion reservation(s)`,
        );
      }

      return rolledBack.length;
    } catch (err) {
      this.logger.error('releaseStaleReservations failed', err);
      return 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // listPublicActive — customer-facing read (not part of the DIP port)
  // ---------------------------------------------------------------------------

  /**
   * Returns active auto-apply promotions visible to customers.
   * Called by PromotionPublicController — not part of IPromotionApplicationPort.
   */
  async listPublicActive(
    restaurantId?: string,
    now?: Date,
  ): Promise<Promotion[]> {
    return this.promotionRepo.findPublicActive(restaurantId, now ?? new Date());
  }

  // ---------------------------------------------------------------------------
  // Admin CRUD — promotion management
  // ---------------------------------------------------------------------------

  async adminList(filters: {
    status?: PromotionStatus;
    restaurantId?: string;
    offset?: number;
    limit?: number;
  }): Promise<{
    items: Promotion[];
    total: number;
    offset: number;
    limit: number;
  }> {
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 20;
    const { rows, total } = await this.promotionRepo.findAll({
      ...filters,
      offset,
      limit,
    });
    return { items: rows, total, offset, limit };
  }

  async adminGet(id: string): Promise<Promotion> {
    return this.promotionRepo.findByIdOrThrow(id);
  }

  async adminCreate(data: CreatePromotionInput): Promise<Promotion> {
    if (data.scope === 'restaurant' && !data.restaurantId) {
      throw new BadRequestException(
        'restaurantId is required for restaurant-scoped promotions.',
      );
    }
    if (data.endsAt <= data.startsAt) {
      throw new BadRequestException('endsAt must be after startsAt.');
    }

    return this.promotionRepo.create({
      name: data.name,
      description: data.description ?? null,
      type: data.type,
      scope: data.scope,
      trigger: data.trigger,
      stackingMode: data.stackingMode ?? 'non_stackable',
      restaurantId:
        data.scope === 'platform' ? null : (data.restaurantId ?? null),
      discountValue: data.discountValue,
      minOrderAmount: data.minOrderAmount ?? null,
      maxDiscountAmount: data.maxDiscountAmount ?? null,
      maxTotalUses: data.maxTotalUses ?? null,
      maxUsesPerUser: data.maxUsesPerUser ?? null,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
    });
  }

  async adminUpdate(
    id: string,
    data: UpdatePromotionInput,
  ): Promise<Promotion> {
    const existing = await this.promotionRepo.findByIdOrThrow(id);
    const startsAt = data.startsAt ?? existing.startsAt;
    const endsAt = data.endsAt ?? existing.endsAt;
    if (endsAt <= startsAt) {
      throw new BadRequestException('endsAt must be after startsAt.');
    }

    const updated = await this.promotionRepo.update(id, {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && {
        description: data.description ?? null,
      }),
      ...(data.stackingMode !== undefined && {
        stackingMode: data.stackingMode,
      }),
      ...(data.restaurantId !== undefined && {
        restaurantId: data.restaurantId ?? null,
      }),
      ...(data.discountValue !== undefined && {
        discountValue: data.discountValue,
      }),
      ...(data.minOrderAmount !== undefined && {
        minOrderAmount: data.minOrderAmount ?? null,
      }),
      ...(data.maxDiscountAmount !== undefined && {
        maxDiscountAmount: data.maxDiscountAmount ?? null,
      }),
      ...(data.maxTotalUses !== undefined && {
        maxTotalUses: data.maxTotalUses ?? null,
      }),
      ...(data.maxUsesPerUser !== undefined && {
        maxUsesPerUser: data.maxUsesPerUser ?? null,
      }),
      ...(data.startsAt !== undefined && { startsAt: data.startsAt }),
      ...(data.endsAt !== undefined && { endsAt: data.endsAt }),
    });
    if (!updated) throw new NotFoundException(`Promotion ${id} not found`);
    return updated;
  }

  async adminActivate(id: string): Promise<Promotion> {
    return this.transitionStatus(id, ['draft', 'paused'], 'active');
  }

  async adminPause(id: string): Promise<Promotion> {
    return this.transitionStatus(id, ['active'], 'paused');
  }

  async adminCancel(id: string): Promise<Promotion> {
    return this.transitionStatus(
      id,
      ['draft', 'active', 'paused'],
      'cancelled',
    );
  }

  private async transitionStatus(
    id: string,
    allowedFrom: PromotionStatus[],
    to: PromotionStatus,
  ): Promise<Promotion> {
    const promotion = await this.promotionRepo.findByIdOrThrow(id);
    if (!allowedFrom.includes(promotion.status)) {
      throw new BadRequestException(
        `Cannot transition promotion from '${promotion.status}' to '${to}'.`,
      );
    }
    const updated = await this.promotionRepo.update(id, { status: to });
    if (!updated) throw new NotFoundException(`Promotion ${id} not found`);
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Admin CRUD — coupon code management
  // ---------------------------------------------------------------------------

  async adminListCoupons(
    promotionId: string,
    filters: { status?: CouponStatus; offset?: number; limit?: number },
  ): Promise<{
    items: CouponCode[];
    total: number;
    offset: number;
    limit: number;
  }> {
    await this.promotionRepo.findByIdOrThrow(promotionId);
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 50;
    const { rows, total } = await this.couponRepo.findByPromotionId(
      promotionId,
      offset,
      limit,
      filters.status,
    );
    return { items: rows, total, offset, limit };
  }

  async adminGenerateCoupons(
    promotionId: string,
    dto: { codes: string[]; maxUsesPerCode?: number; expiresAt?: Date },
  ): Promise<CouponCode[]> {
    await this.promotionRepo.findByIdOrThrow(promotionId);

    const codes = Array.from(
      new Set(
        dto.codes.map((code) => code.trim().toUpperCase()).filter(Boolean),
      ),
    );
    if (codes.length === 0) {
      throw new BadRequestException('At least one coupon code is required.');
    }

    return this.couponRepo.createMany(
      codes.map((code) => ({
        id: randomUUID(),
        promotionId,
        code,
        maxUses: dto.maxUsesPerCode ?? null,
        expiresAt: dto.expiresAt ?? null,
      })),
    );
  }

  async adminRevokeCoupon(
    promotionId: string,
    couponId: string,
  ): Promise<CouponCode> {
    const coupon = await this.couponRepo.findById(couponId);
    if (!coupon || coupon.promotionId !== promotionId) {
      throw new NotFoundException(
        `Coupon ${couponId} not found for this promotion`,
      );
    }
    const revoked = await this.couponRepo.revokeCode(couponId);
    if (!revoked) throw new NotFoundException(`Coupon ${couponId} not found`);
    return revoked;
  }

  // ---------------------------------------------------------------------------
  // Restaurant-owner CRUD — promotion management scoped to one restaurant.
  // Every write re-verifies restaurant ownership against Catalog (unless the
  // caller is an admin), and every read/write on an existing promotion checks
  // it actually belongs to the given restaurantId — otherwise a restaurant
  // owner could read/mutate another restaurant's promotion by guessing its id.
  // ---------------------------------------------------------------------------

  async restaurantList(
    restaurantId: string,
    filters: { offset?: number; limit?: number },
  ): Promise<{
    items: Promotion[];
    total: number;
    offset: number;
    limit: number;
  }> {
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 20;
    const { rows, total } = await this.promotionRepo.findByRestaurantId(
      restaurantId,
      offset,
      limit,
    );
    return { items: rows, total, offset, limit };
  }

  async restaurantGet(restaurantId: string, id: string): Promise<Promotion> {
    return this.findOwnedPromotion(id, restaurantId);
  }

  async restaurantCreate(
    restaurantId: string,
    callerId: string,
    isAdmin: boolean,
    data: CreatePromotionInput,
  ): Promise<Promotion> {
    await this.verifyRestaurantOwnership(restaurantId, callerId, isAdmin);
    if (data.endsAt <= data.startsAt) {
      throw new BadRequestException('endsAt must be after startsAt.');
    }

    return this.promotionRepo.create({
      name: data.name,
      description: data.description ?? null,
      type: data.type,
      // Scope and restaurantId are forced regardless of the request body —
      // a restaurant owner can only ever create promotions for their own
      // restaurant, never a platform-wide one.
      scope: 'restaurant',
      restaurantId,
      trigger: data.trigger,
      stackingMode: data.stackingMode ?? 'non_stackable',
      discountValue: data.discountValue,
      minOrderAmount: data.minOrderAmount ?? null,
      maxDiscountAmount: data.maxDiscountAmount ?? null,
      maxTotalUses: data.maxTotalUses ?? null,
      maxUsesPerUser: data.maxUsesPerUser ?? null,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
    });
  }

  async restaurantUpdate(
    restaurantId: string,
    callerId: string,
    isAdmin: boolean,
    id: string,
    data: UpdatePromotionInput,
  ): Promise<Promotion> {
    await this.verifyRestaurantOwnership(restaurantId, callerId, isAdmin);
    const existing = await this.findOwnedPromotion(id, restaurantId);
    const startsAt = data.startsAt ?? existing.startsAt;
    const endsAt = data.endsAt ?? existing.endsAt;
    if (endsAt <= startsAt) {
      throw new BadRequestException('endsAt must be after startsAt.');
    }

    const updated = await this.promotionRepo.update(id, {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && {
        description: data.description ?? null,
      }),
      ...(data.stackingMode !== undefined && {
        stackingMode: data.stackingMode,
      }),
      ...(data.discountValue !== undefined && {
        discountValue: data.discountValue,
      }),
      ...(data.minOrderAmount !== undefined && {
        minOrderAmount: data.minOrderAmount ?? null,
      }),
      ...(data.maxDiscountAmount !== undefined && {
        maxDiscountAmount: data.maxDiscountAmount ?? null,
      }),
      ...(data.maxTotalUses !== undefined && {
        maxTotalUses: data.maxTotalUses ?? null,
      }),
      ...(data.maxUsesPerUser !== undefined && {
        maxUsesPerUser: data.maxUsesPerUser ?? null,
      }),
      ...(data.startsAt !== undefined && { startsAt: data.startsAt }),
      ...(data.endsAt !== undefined && { endsAt: data.endsAt }),
      // restaurantId is intentionally never accepted here — a restaurant
      // owner cannot reassign a promotion to a different restaurant.
    });
    if (!updated) throw new NotFoundException(`Promotion ${id} not found`);
    return updated;
  }

  async restaurantActivate(
    restaurantId: string,
    callerId: string,
    isAdmin: boolean,
    id: string,
  ): Promise<Promotion> {
    await this.verifyRestaurantOwnership(restaurantId, callerId, isAdmin);
    await this.findOwnedPromotion(id, restaurantId);
    return this.transitionStatus(id, ['draft', 'paused'], 'active');
  }

  async restaurantPause(
    restaurantId: string,
    callerId: string,
    isAdmin: boolean,
    id: string,
  ): Promise<Promotion> {
    await this.verifyRestaurantOwnership(restaurantId, callerId, isAdmin);
    await this.findOwnedPromotion(id, restaurantId);
    return this.transitionStatus(id, ['active'], 'paused');
  }

  async restaurantCancel(
    restaurantId: string,
    callerId: string,
    isAdmin: boolean,
    id: string,
  ): Promise<Promotion> {
    await this.verifyRestaurantOwnership(restaurantId, callerId, isAdmin);
    await this.findOwnedPromotion(id, restaurantId);
    return this.transitionStatus(
      id,
      ['draft', 'active', 'paused'],
      'cancelled',
    );
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Loads a promotion and confirms it belongs to the given restaurant. */
  private async findOwnedPromotion(
    id: string,
    restaurantId: string,
  ): Promise<Promotion> {
    const promotion = await this.promotionRepo.findByIdOrThrow(id);
    if (promotion.restaurantId !== restaurantId) {
      throw new NotFoundException(`Promotion ${id} not found`);
    }
    return promotion;
  }

  /** Verifies restaurantId is owned by callerId, via Catalog, unless isAdmin. */
  private async verifyRestaurantOwnership(
    restaurantId: string,
    callerId: string,
    isAdmin: boolean,
  ): Promise<void> {
    if (isAdmin) return;
    const ownerId = await this.catalogLookup.getOwnerId(restaurantId);
    if (ownerId !== callerId) {
      throw new ForbiddenException('You do not own this restaurant');
    }
  }

  private async previewAutoApply(
    restaurantId: string,
    customerId: string,
    itemsSubtotal: number,
    shippingFee: number,
    now: Date,
  ): Promise<DiscountPreviewResult> {
    const candidates =
      await this.promotionRepo.findActiveAutoApplyForRestaurant(
        restaurantId,
        now,
      );

    let best: {
      promotion: Promotion;
      discountOnItems: number;
      discountOnShipping: number;
      discountAmount: number;
      breakdown: DiscountBreakdown;
    } | null = null;

    for (const p of candidates) {
      // Per-user quota pre-check (read-only)
      if (p.maxUsesPerUser !== null && p.maxUsesPerUser !== undefined) {
        const userUses = await this.usageRepo.countActiveUsagesByCustomer(
          p.id,
          customerId,
        );
        if (userUses >= p.maxUsesPerUser) continue;
      }

      const result = this.engine.computeDiscount({
        promotion: p,
        itemsSubtotal,
        shippingFee,
        now,
      });

      if (
        result.eligible &&
        result.discountAmount > (best?.discountAmount ?? 0)
      ) {
        best = {
          promotion: p,
          discountOnItems: result.discountOnItems,
          discountOnShipping: result.discountOnShipping,
          discountAmount: result.discountAmount,
          breakdown: result.breakdown,
        };
      }
    }

    if (!best) {
      return {
        applicable: false,
        promotionId: null,
        couponCodeId: null,
        discountAmount: 0,
        finalItemsSubtotal: itemsSubtotal,
        finalShippingFee: shippingFee,
        breakdown: [],
        reason: 'No applicable auto-apply promotion',
      };
    }

    return {
      applicable: true,
      promotionId: best.promotion.id,
      couponCodeId: null,
      discountAmount: best.discountAmount,
      finalItemsSubtotal: itemsSubtotal - best.discountOnItems,
      finalShippingFee: shippingFee - best.discountOnShipping,
      breakdown: [best.breakdown],
    };
  }

  private async previewCoupon(
    couponCode: string,
    restaurantId: string,
    customerId: string,
    itemsSubtotal: number,
    shippingFee: number,
    now: Date,
  ): Promise<DiscountPreviewResult> {
    const normalized = couponCode.trim().toUpperCase();

    const notApplicable = (reason: string): DiscountPreviewResult => ({
      applicable: false,
      promotionId: null,
      couponCodeId: null,
      discountAmount: 0,
      finalItemsSubtotal: itemsSubtotal,
      finalShippingFee: shippingFee,
      breakdown: [],
      reason,
    });

    const coupon = await this.couponRepo.findActiveByCode(normalized, now);
    if (!coupon) return notApplicable('Coupon code not found or inactive');

    const promotion =
      await this.promotionRepo.findActiveCouponPromotionForRestaurant(
        coupon.promotionId,
        restaurantId,
        now,
      );
    if (!promotion)
      return notApplicable('Promotion is not available for this restaurant');

    // Per-user quota check
    if (
      promotion.maxUsesPerUser !== null &&
      promotion.maxUsesPerUser !== undefined
    ) {
      const userUses = await this.usageRepo.countActiveUsagesByCustomer(
        promotion.id,
        customerId,
      );
      if (userUses >= promotion.maxUsesPerUser) {
        return notApplicable('You have already used this coupon');
      }
    }

    const result = this.engine.computeDiscount({
      promotion,
      itemsSubtotal,
      shippingFee,
      now,
    });

    if (!result.eligible) return notApplicable(result.reason ?? 'Not eligible');

    return {
      applicable: true,
      promotionId: promotion.id,
      couponCodeId: coupon.id,
      discountAmount: result.discountAmount,
      finalItemsSubtotal: itemsSubtotal - result.discountOnItems,
      finalShippingFee: shippingFee - result.discountOnShipping,
      breakdown: [result.breakdown],
    };
  }
}
