import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  OmitType,
} from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsInt,
  IsISO8601,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  IsVNDAmount,
  IsVNDFee,
} from '@/shared/validators/vnd-amount.validator';
import type {
  PromotionType,
  PromotionScope,
  PromotionStatus,
  PromotionTrigger,
  StackingMode,
  Promotion,
} from '../domain/promotion.schema';

// ---------------------------------------------------------------------------
// Enum value arrays (used in @IsEnum and @ApiProperty)
// ---------------------------------------------------------------------------

const PROMOTION_TYPES: PromotionType[] = [
  'percentage',
  'fixed_amount',
  'free_delivery',
  'reduced_delivery',
  'buy_x_get_y',
  'free_item',
];

const PROMOTION_SCOPES: PromotionScope[] = ['platform', 'restaurant'];

const PROMOTION_TRIGGERS: PromotionTrigger[] = ['auto_apply', 'coupon_code'];

const STACKING_MODES: StackingMode[] = [
  'non_stackable',
  'stackable',
  'exclusive',
];

const PROMOTION_STATUSES: PromotionStatus[] = [
  'draft',
  'active',
  'paused',
  'cancelled',
  'expired',
];

// ---------------------------------------------------------------------------
// CreatePromotionDto — used by both Admin and Restaurant services
// ---------------------------------------------------------------------------

export class CreatePromotionDto {
  @ApiProperty({
    description: 'Display name for the promotion',
    minLength: 2,
    example: 'Summer Sale 15% Off',
  })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({
    description: 'Optional marketing copy shown to customers',
    example: 'Get 15% off all orders above 100,000 VND this summer!',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Discount computation strategy',
    enum: PROMOTION_TYPES,
    example: 'percentage',
  })
  @IsEnum(PROMOTION_TYPES)
  type!: PromotionType;

  @ApiProperty({
    description:
      'Promotion scope: platform = all restaurants, restaurant = one specific restaurant',
    enum: PROMOTION_SCOPES,
    example: 'platform',
  })
  @IsEnum(PROMOTION_SCOPES)
  scope!: PromotionScope;

  @ApiProperty({
    description:
      'How the promotion is applied: auto_apply = automatic, coupon_code = requires customer code entry',
    enum: PROMOTION_TRIGGERS,
    example: 'auto_apply',
  })
  @IsEnum(PROMOTION_TRIGGERS)
  trigger!: PromotionTrigger;

  @ApiPropertyOptional({
    description: 'Stacking behaviour when multiple promotions are active',
    enum: STACKING_MODES,
    default: 'non_stackable',
    example: 'non_stackable',
  })
  @IsOptional()
  @IsEnum(STACKING_MODES)
  stackingMode?: StackingMode;

  @ApiPropertyOptional({
    description:
      'Required when scope=restaurant. UUID of the restaurant this promotion applies to.',
    format: 'uuid',
    example: 'fe8b2648-2260-4bc5-9acd-d88972148c78',
  })
  @ValidateIf((o: CreatePromotionDto) => o.scope === 'restaurant')
  @IsUUID()
  restaurantId?: string;

  /**
   * For percentage type: integer 1–100 (e.g. 15 = 15% off).
   * For fixed_amount / free_delivery / reduced_delivery: VND integer (multiple of 1000).
   */
  @ApiProperty({
    description:
      'Discount value: for percentage type = integer 1–100; for all other types = VND amount (multiple of 1000).',
    example: 15,
  })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  discountValue!: number;

  @ApiPropertyOptional({
    description:
      'Minimum item subtotal (VND, multiple of 1000) required to apply this promotion. Null = no minimum.',
    example: 100000,
  })
  @IsOptional()
  @IsVNDFee()
  @Type(() => Number)
  minOrderAmount?: number;

  @ApiPropertyOptional({
    description:
      'Maximum discount cap for percentage-type promotions (VND, multiple of 1000). Ignored for other types.',
    example: 50000,
  })
  @IsOptional()
  @IsVNDAmount()
  @Type(() => Number)
  maxDiscountAmount?: number;

  @ApiPropertyOptional({
    description:
      'Total number of times this promotion can be used across all customers. Null = unlimited.',
    example: 1000,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  maxTotalUses?: number;

  @ApiPropertyOptional({
    description: 'Maximum uses per single customer. Null = unlimited.',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  maxUsesPerUser?: number;

  @ApiProperty({
    description: 'ISO 8601 datetime when the promotion becomes active.',
    example: '2025-01-01T00:00:00.000Z',
  })
  @IsISO8601()
  startsAt!: string;

  @ApiProperty({
    description: 'ISO 8601 datetime when the promotion expires.',
    example: '2025-12-31T23:59:59.000Z',
  })
  @IsISO8601()
  endsAt!: string;
}

// ---------------------------------------------------------------------------
// UpdatePromotionDto — all fields optional for admin/restaurant updates
// ---------------------------------------------------------------------------

export class UpdatePromotionDto extends PartialType(
  OmitType(CreatePromotionDto, ['type', 'scope', 'trigger'] as const),
) {}

// ---------------------------------------------------------------------------
// PromotionResponseDto — returned by all GET/POST/PATCH endpoints
// ---------------------------------------------------------------------------

export class PromotionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Summer Sale 15% Off' })
  name!: string;

  @ApiPropertyOptional({ example: 'Get 15% off all orders this summer!' })
  description!: string | null;

  @ApiProperty({ enum: PROMOTION_TYPES })
  type!: PromotionType;

  @ApiProperty({ enum: PROMOTION_SCOPES })
  scope!: PromotionScope;

  @ApiProperty({ enum: PROMOTION_STATUSES })
  status!: PromotionStatus;

  @ApiProperty({ enum: PROMOTION_TRIGGERS })
  trigger!: PromotionTrigger;

  @ApiProperty({ enum: STACKING_MODES })
  stackingMode!: StackingMode;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  restaurantId!: string | null;

  @ApiProperty({ example: 15 })
  discountValue!: number;

  @ApiPropertyOptional({ example: 100000, nullable: true })
  minOrderAmount!: number | null;

  @ApiPropertyOptional({ example: 50000, nullable: true })
  maxDiscountAmount!: number | null;

  @ApiPropertyOptional({ example: 1000, nullable: true })
  maxTotalUses!: number | null;

  @ApiProperty({ example: 0 })
  currentTotalUses!: number;

  @ApiPropertyOptional({ example: 1, nullable: true })
  maxUsesPerUser!: number | null;

  @ApiProperty()
  startsAt!: Date;

  @ApiProperty()
  endsAt!: Date;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromRow(row: Promotion): PromotionResponseDto {
    const dto = new PromotionResponseDto();
    dto.id = row.id;
    dto.name = row.name;
    dto.description = row.description ?? null;
    dto.type = row.type;
    dto.scope = row.scope;
    dto.status = row.status;
    dto.trigger = row.trigger;
    dto.stackingMode = row.stackingMode;
    dto.restaurantId = row.restaurantId ?? null;
    dto.discountValue = row.discountValue;
    dto.minOrderAmount = row.minOrderAmount ?? null;
    dto.maxDiscountAmount = row.maxDiscountAmount ?? null;
    dto.maxTotalUses = row.maxTotalUses ?? null;
    dto.currentTotalUses = row.currentTotalUses;
    dto.maxUsesPerUser = row.maxUsesPerUser ?? null;
    dto.startsAt = row.startsAt;
    dto.endsAt = row.endsAt;
    dto.createdAt = row.createdAt;
    dto.updatedAt = row.updatedAt;
    return dto;
  }
}

export class PromotionListResponseDto {
  @ApiProperty({ type: [PromotionResponseDto] })
  items!: PromotionResponseDto[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 0 })
  offset!: number;

  @ApiProperty({ example: 20 })
  limit!: number;
}

// ---------------------------------------------------------------------------
// PreviewDiscountDto — POST /promotions/preview
// ---------------------------------------------------------------------------

export class PreviewDiscountDto {
  @ApiProperty({
    format: 'uuid',
    example: 'fe8b2648-2260-4bc5-9acd-d88972148c78',
  })
  @IsUUID()
  restaurantId!: string;

  @ApiProperty({
    description: 'Total item subtotal in VND (integer)',
    example: 150000,
  })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  itemsSubtotal!: number;

  @ApiProperty({ description: 'Shipping fee in VND (integer)', example: 25000 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  shippingFee!: number;

  @ApiPropertyOptional({
    description: 'Coupon code to validate',
    example: 'SUMMER15',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  couponCode?: string;
}

export class PreviewDiscountResponseDto {
  @ApiProperty({ example: true })
  applicable!: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  promotionId!: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Coupon code ID when a coupon was validated',
  })
  couponCodeId!: string | null;

  @ApiProperty({ example: 22000 })
  discountAmount!: number;

  @ApiProperty({ example: 128000 })
  finalItemsSubtotal!: number;

  @ApiProperty({ example: 25000 })
  finalShippingFee!: number;

  @ApiPropertyOptional({
    example: 'No applicable auto-apply promotion',
    nullable: true,
  })
  reason!: string | undefined;
}

// ---------------------------------------------------------------------------
// ValidateCouponDto — POST /promotions/coupons/validate
// ---------------------------------------------------------------------------

export class ValidateCouponDto {
  @ApiProperty({ example: 'SUMMER15' })
  @IsString()
  @MinLength(1)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  code!: string;

  @ApiProperty({
    format: 'uuid',
    example: 'fe8b2648-2260-4bc5-9acd-d88972148c78',
  })
  @IsUUID()
  restaurantId!: string;

  @ApiProperty({ description: 'Item subtotal in VND', example: 150000 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  itemsSubtotal!: number;

  @ApiProperty({ description: 'Shipping fee in VND', example: 25000 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  shippingFee!: number;
}
