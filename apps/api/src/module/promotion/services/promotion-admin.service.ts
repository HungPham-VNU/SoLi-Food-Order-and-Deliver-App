import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PromotionRepository } from '../repositories/promotion.repository';
import { CouponCodeRepository } from '../repositories/coupon-code.repository';
import type {
  CreatePromotionDto,
  UpdatePromotionDto,
} from '../dto/promotion.dto';
import type { CreateCouponCodesDto } from '../dto/coupon.dto';
import type {
  Promotion,
  PromotionStatus,
  CouponCode,
} from '../domain/promotion.schema';

/**
 * PromotionAdminService
 *
 * Handles all admin-facing promotion management operations.
 * Admin users can:
 *   - Create platform or restaurant-scoped promotions
 *   - List / get / update / soft-delete any promotion
 *   - Activate / pause any promotion
 *   - Create and list coupon codes for any promotion
 */
@Injectable()
export class PromotionAdminService {
  private readonly logger = new Logger(PromotionAdminService.name);

  constructor(
    private readonly promotionRepo: PromotionRepository,
    private readonly couponRepo: CouponCodeRepository,
  ) {}

  // ---------------------------------------------------------------------------
  // Promotion CRUD
  // ---------------------------------------------------------------------------

  async createPromotion(dto: CreatePromotionDto): Promise<Promotion> {
    this.validateDiscountValue(dto.type, dto.discountValue);
    this.validateDateRange(dto.startsAt, dto.endsAt);

    if (dto.scope === 'restaurant' && !dto.restaurantId) {
      throw new BadRequestException(
        'restaurantId is required when scope is "restaurant"',
      );
    }
    if (dto.scope === 'platform' && dto.restaurantId) {
      throw new BadRequestException(
        'restaurantId must be omitted for platform-scoped promotions',
      );
    }

    const promotion = await this.promotionRepo.create({
      id: randomUUID(),
      name: dto.name,
      description: dto.description ?? null,
      type: dto.type,
      scope: dto.scope,
      status: 'draft',
      trigger: dto.trigger,
      stackingMode: dto.stackingMode ?? 'non_stackable',
      restaurantId: dto.restaurantId ?? null,
      discountValue: dto.discountValue,
      minOrderAmount: dto.minOrderAmount ?? null,
      maxDiscountAmount: dto.maxDiscountAmount ?? null,
      maxTotalUses: dto.maxTotalUses ?? null,
      currentTotalUses: 0,
      maxUsesPerUser: dto.maxUsesPerUser ?? null,
      requiresApprovedRestaurant: false,
      startsAt: new Date(dto.startsAt),
      endsAt: new Date(dto.endsAt),
      version: 0,
    });

    this.logger.log(
      `Admin created promotion id=${promotion.id} name="${promotion.name}"`,
    );
    return promotion;
  }

  async listPromotions(filters: {
    status?: PromotionStatus;
    restaurantId?: string;
    offset?: number;
    limit?: number;
  }): Promise<{ rows: Promotion[]; total: number }> {
    return this.promotionRepo.findAll({
      status: filters.status,
      restaurantId: filters.restaurantId,
      offset: filters.offset ?? 0,
      limit: Math.min(filters.limit ?? 20, 100),
    });
  }

  async getPromotion(id: string): Promise<Promotion> {
    return this.promotionRepo.findByIdOrThrow(id);
  }

  async updatePromotion(
    id: string,
    dto: UpdatePromotionDto,
  ): Promise<Promotion> {
    const existing = await this.promotionRepo.findByIdOrThrow(id);

    if (existing.status === 'cancelled') {
      throw new BadRequestException('Cannot update a cancelled promotion');
    }

    if (dto.discountValue !== undefined) {
      this.validateDiscountValue(existing.type, dto.discountValue);
    }
    if (dto.startsAt || dto.endsAt) {
      const newStart = dto.startsAt
        ? new Date(dto.startsAt)
        : existing.startsAt;
      const newEnd = dto.endsAt ? new Date(dto.endsAt) : existing.endsAt;
      if (newEnd <= newStart) {
        throw new BadRequestException('endsAt must be after startsAt');
      }
    }

    const updated = await this.promotionRepo.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.stackingMode !== undefined && { stackingMode: dto.stackingMode }),
      ...(dto.restaurantId !== undefined && { restaurantId: dto.restaurantId }),
      ...(dto.discountValue !== undefined && {
        discountValue: dto.discountValue,
      }),
      ...(dto.minOrderAmount !== undefined && {
        minOrderAmount: dto.minOrderAmount,
      }),
      ...(dto.maxDiscountAmount !== undefined && {
        maxDiscountAmount: dto.maxDiscountAmount,
      }),
      ...(dto.maxTotalUses !== undefined && { maxTotalUses: dto.maxTotalUses }),
      ...(dto.maxUsesPerUser !== undefined && {
        maxUsesPerUser: dto.maxUsesPerUser,
      }),
      ...(dto.startsAt !== undefined && { startsAt: new Date(dto.startsAt) }),
      ...(dto.endsAt !== undefined && { endsAt: new Date(dto.endsAt) }),
    });

    if (!updated) throw new NotFoundException(`Promotion ${id} not found`);
    return updated;
  }

  /** Soft-delete: transitions status → 'cancelled'. */
  async cancelPromotion(id: string): Promise<Promotion> {
    const existing = await this.promotionRepo.findByIdOrThrow(id);
    if (existing.status === 'cancelled') {
      throw new BadRequestException('Promotion is already cancelled');
    }

    const updated = await this.promotionRepo.update(id, {
      status: 'cancelled',
    });
    if (!updated) throw new NotFoundException(`Promotion ${id} not found`);

    this.logger.log(`Admin cancelled promotion id=${id}`);
    return updated;
  }

  async activatePromotion(id: string): Promise<Promotion> {
    const existing = await this.promotionRepo.findByIdOrThrow(id);
    if (!['draft', 'paused'].includes(existing.status)) {
      throw new BadRequestException(
        `Cannot activate promotion in status '${existing.status}'`,
      );
    }

    const updated = await this.promotionRepo.update(id, { status: 'active' });
    if (!updated) throw new NotFoundException(`Promotion ${id} not found`);

    this.logger.log(`Admin activated promotion id=${id}`);
    return updated;
  }

  async pausePromotion(id: string): Promise<Promotion> {
    const existing = await this.promotionRepo.findByIdOrThrow(id);
    if (existing.status !== 'active') {
      throw new BadRequestException(
        `Cannot pause promotion in status '${existing.status}'`,
      );
    }

    const updated = await this.promotionRepo.update(id, { status: 'paused' });
    if (!updated) throw new NotFoundException(`Promotion ${id} not found`);

    this.logger.log(`Admin paused promotion id=${id}`);
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Coupon Code management
  // ---------------------------------------------------------------------------

  async createCouponCodes(
    promotionId: string,
    dto: CreateCouponCodesDto,
  ): Promise<CouponCode[]> {
    const promotion = await this.promotionRepo.findByIdOrThrow(promotionId);

    if (promotion.trigger !== 'coupon_code') {
      throw new BadRequestException(
        'Coupon codes can only be created for coupon_code-triggered promotions',
      );
    }
    if (promotion.status === 'cancelled') {
      throw new BadRequestException(
        'Cannot create coupon codes for a cancelled promotion',
      );
    }

    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    const rows = dto.codes.map((rawCode) => ({
      id: randomUUID(),
      promotionId,
      code: rawCode.trim().toUpperCase(),
      status: 'active' as const,
      maxUses: dto.maxUsesPerCode ?? null,
      currentUses: 0,
      expiresAt,
      version: 0,
    }));

    try {
      const created = await this.couponRepo.createMany(rows);
      this.logger.log(
        `Created ${created.length} coupon code(s) for promotion id=${promotionId}`,
      );
      return created;
    } catch (err: unknown) {
      // Unique constraint violation on code — DrizzleQueryError wraps the pg error
      const errMsg =
        err instanceof Error
          ? `${err.message} ${err.cause instanceof Error ? err.cause.message : String(err.cause ?? '')}`
          : '';
      if (errMsg.includes('coupon_codes_code_unique') || errMsg.includes('duplicate key')) {
        throw new ConflictException(
          'One or more coupon codes already exist. All codes must be globally unique.',
        );
      }
      throw err;
    }
  }

  async listCouponCodes(
    promotionId: string,
    offset = 0,
    limit = 50,
  ): Promise<{ rows: CouponCode[]; total: number }> {
    // Verify promotion exists
    await this.promotionRepo.findByIdOrThrow(promotionId);
    return this.couponRepo.findByPromotionId(
      promotionId,
      offset,
      Math.min(limit, 200),
    );
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private validateDiscountValue(type: string, value: number): void {
    if (type === 'percentage') {
      if (!Number.isInteger(value) || value < 1 || value > 100) {
        throw new BadRequestException(
          'discountValue for percentage type must be an integer between 1 and 100',
        );
      }
    } else {
      // VND types: must be multiple of 1000, min 1000
      if (!Number.isInteger(value) || value < 1000 || value % 1000 !== 0) {
        throw new BadRequestException(
          `discountValue for '${type}' type must be an integer multiple of 1000 VND (minimum 1000)`,
        );
      }
    }
  }

  private validateDateRange(startsAt: string, endsAt: string): void {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException(
        'startsAt and endsAt must be valid ISO 8601 dates',
      );
    }
    if (end <= start) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
  }
}
