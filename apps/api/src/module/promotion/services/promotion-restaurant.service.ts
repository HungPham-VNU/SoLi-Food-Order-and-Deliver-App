import {
  Inject,
  Injectable,
  Logger,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PromotionRepository } from '../repositories/promotion.repository';
import {
  RESTAURANT_ACCESS_PORT,
  type IRestaurantAccessPort,
} from '@/shared/ports/restaurant-access.port';
import type {
  CreatePromotionDto,
  UpdatePromotionDto,
} from '../dto/promotion.dto';
import type { Promotion } from '../domain/promotion.schema';

/**
 * PromotionRestaurantService
 *
 * Handles restaurant-owner-facing promotion management.
 * Restaurant owners can only:
 *   - Create restaurant-scoped promotions for their own restaurant
 *   - List their own promotions
 *   - Update / activate / pause their own promotions
 *
 * Ownership enforcement:
 *   All mutations call assertRestaurantOwner() which looks up the restaurant
 *   through RESTAURANT_ACCESS_PORT, which enforces ownership inside Catalog.
 *   This mirrors the pattern used by MenuService.
 */
@Injectable()
export class PromotionRestaurantService {
  private readonly logger = new Logger(PromotionRestaurantService.name);

  constructor(
    private readonly promotionRepo: PromotionRepository,
    @Inject(RESTAURANT_ACCESS_PORT)
    private readonly restaurantAccess: IRestaurantAccessPort,
  ) {}

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async createPromotion(
    dto: CreatePromotionDto,
    restaurantId: string,
    callerId: string,
  ): Promise<Promotion> {
    // Verify the caller owns the restaurant
    await this.assertRestaurantOwner(restaurantId, callerId);

    // Restaurant owners can only create restaurant-scoped promotions
    if (dto.scope !== 'restaurant') {
      throw new ForbiddenException(
        'Restaurant owners can only create restaurant-scoped promotions',
      );
    }

    // The promotion must target the caller's own restaurant
    if (dto.restaurantId && dto.restaurantId !== restaurantId) {
      throw new ForbiddenException(
        'You can only create promotions for your own restaurant',
      );
    }

    this.validateDiscountValue(dto.type, dto.discountValue);
    this.validateDateRange(dto.startsAt, dto.endsAt);

    const promotion = await this.promotionRepo.create({
      id: randomUUID(),
      name: dto.name,
      description: dto.description ?? null,
      type: dto.type,
      scope: 'restaurant',
      status: 'draft',
      trigger: dto.trigger,
      stackingMode: dto.stackingMode ?? 'non_stackable',
      restaurantId,
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
      `Restaurant owner created promotion id=${promotion.id} restaurantId=${restaurantId}`,
    );
    return promotion;
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  async listMyPromotions(
    restaurantId: string,
    callerId: string,
    offset = 0,
    limit = 20,
  ): Promise<{ rows: Promotion[]; total: number }> {
    await this.assertRestaurantOwner(restaurantId, callerId);
    return this.promotionRepo.findByRestaurantId(
      restaurantId,
      offset,
      Math.min(limit, 100),
    );
  }

  async getMyPromotion(
    id: string,
    restaurantId: string,
    callerId: string,
  ): Promise<Promotion> {
    await this.assertRestaurantOwner(restaurantId, callerId);
    const promotion = await this.promotionRepo.findByIdOrThrow(id);
    this.assertPromotionBelongsToRestaurant(promotion, restaurantId);
    return promotion;
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  async updatePromotion(
    id: string,
    dto: UpdatePromotionDto,
    restaurantId: string,
    callerId: string,
  ): Promise<Promotion> {
    await this.assertRestaurantOwner(restaurantId, callerId);
    const existing = await this.promotionRepo.findByIdOrThrow(id);
    this.assertPromotionBelongsToRestaurant(existing, restaurantId);

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

  async activatePromotion(
    id: string,
    restaurantId: string,
    callerId: string,
  ): Promise<Promotion> {
    await this.assertRestaurantOwner(restaurantId, callerId);
    const existing = await this.promotionRepo.findByIdOrThrow(id);
    this.assertPromotionBelongsToRestaurant(existing, restaurantId);

    if (!['draft', 'paused'].includes(existing.status)) {
      throw new BadRequestException(
        `Cannot activate promotion in status '${existing.status}'`,
      );
    }

    const updated = await this.promotionRepo.update(id, { status: 'active' });
    if (!updated) throw new NotFoundException(`Promotion ${id} not found`);

    this.logger.log(
      `Restaurant activated promotion id=${id} restaurantId=${restaurantId}`,
    );
    return updated;
  }

  async pausePromotion(
    id: string,
    restaurantId: string,
    callerId: string,
  ): Promise<Promotion> {
    await this.assertRestaurantOwner(restaurantId, callerId);
    const existing = await this.promotionRepo.findByIdOrThrow(id);
    this.assertPromotionBelongsToRestaurant(existing, restaurantId);

    if (existing.status !== 'active') {
      throw new BadRequestException(
        `Cannot pause promotion in status '${existing.status}'`,
      );
    }

    const updated = await this.promotionRepo.update(id, { status: 'paused' });
    if (!updated) throw new NotFoundException(`Promotion ${id} not found`);

    this.logger.log(
      `Restaurant paused promotion id=${id} restaurantId=${restaurantId}`,
    );
    return updated;
  }

  /**
   * Soft-delete: transitions the promotion to 'cancelled'. The row is retained
   * because promotion_usages reference it for audit/analytics — mirrors the
   * admin cancel behaviour.
   */
  async cancelPromotion(
    id: string,
    restaurantId: string,
    callerId: string,
  ): Promise<Promotion> {
    await this.assertRestaurantOwner(restaurantId, callerId);
    const existing = await this.promotionRepo.findByIdOrThrow(id);
    this.assertPromotionBelongsToRestaurant(existing, restaurantId);

    if (existing.status === 'cancelled') {
      throw new BadRequestException('Promotion is already cancelled');
    }

    const updated = await this.promotionRepo.update(id, {
      status: 'cancelled',
    });
    if (!updated) throw new NotFoundException(`Promotion ${id} not found`);

    this.logger.log(
      `Restaurant cancelled promotion id=${id} restaurantId=${restaurantId}`,
    );
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Verifies the caller owns the given restaurant.
   * Throws ForbiddenException if not the owner; NotFoundException if restaurant is missing.
   */
  private async assertRestaurantOwner(
    restaurantId: string,
    callerId: string,
  ): Promise<void> {
    await this.restaurantAccess.assertOwner(restaurantId, callerId);
  }

  private assertPromotionBelongsToRestaurant(
    promotion: Promotion,
    restaurantId: string,
  ): void {
    if (promotion.restaurantId !== restaurantId) {
      throw new ForbiddenException('You do not own this promotion');
    }
  }

  private validateDiscountValue(type: string, value: number): void {
    if (type === 'percentage') {
      if (!Number.isInteger(value) || value < 1 || value > 100) {
        throw new BadRequestException(
          'discountValue for percentage type must be an integer between 1 and 100',
        );
      }
    } else {
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
