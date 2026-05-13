import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsISO8601,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  Min,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import type { CouponCode, CouponStatus } from '../domain/promotion.schema';

const COUPON_STATUSES: CouponStatus[] = [
  'active',
  'exhausted',
  'expired',
  'revoked',
];

// ---------------------------------------------------------------------------
// CreateCouponCodesDto — POST /promotions/admin/:id/coupons
// ---------------------------------------------------------------------------

export class CreateCouponCodesDto {
  @ApiProperty({
    description:
      'List of coupon code strings to create. Codes are normalised to uppercase before insertion. Min 3, max 32 chars, alphanumeric with optional internal hyphens.',
    example: ['SUMMER15', 'winter20', 'VIP-2025'],
    type: [String],
  })
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? (value as unknown[]).map((c) =>
          typeof c === 'string' ? c.trim().toUpperCase() : c,
        )
      : value,
  )
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MinLength(3, { each: true })
  @MaxLength(32, { each: true })
  @Matches(/^[A-Z0-9][A-Z0-9-]*[A-Z0-9]$|^[A-Z0-9]{1,2}$/, {
    each: true,
    message:
      'Each code must be alphanumeric with optional internal hyphens (e.g. SUMMER15, VIP-2025)',
  })
  codes!: string[];

  @ApiPropertyOptional({
    description:
      'Maximum number of times each code can be used. Null = unlimited per code.',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  maxUsesPerCode?: number;

  @ApiPropertyOptional({
    description:
      'ISO 8601 expiry datetime for all codes in this batch. Null = inherit from the promotion endsAt.',
    example: '2025-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

// ---------------------------------------------------------------------------
// CouponCodeResponseDto — returned by list/create coupon endpoints
// ---------------------------------------------------------------------------

export class CouponCodeResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  promotionId!: string;

  @ApiProperty({ example: 'SUMMER15' })
  code!: string;

  @ApiProperty({ enum: COUPON_STATUSES })
  status!: CouponStatus;

  @ApiPropertyOptional({ example: 1, nullable: true })
  maxUses!: number | null;

  @ApiProperty({ example: 0 })
  currentUses!: number;

  @ApiPropertyOptional({ nullable: true })
  expiresAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromRow(row: CouponCode): CouponCodeResponseDto {
    const dto = new CouponCodeResponseDto();
    dto.id = row.id;
    dto.promotionId = row.promotionId;
    dto.code = row.code;
    dto.status = row.status;
    dto.maxUses = row.maxUses ?? null;
    dto.currentUses = row.currentUses;
    dto.expiresAt = row.expiresAt ?? null;
    dto.createdAt = row.createdAt;
    dto.updatedAt = row.updatedAt;
    return dto;
  }
}

export class CouponCodeListResponseDto {
  @ApiProperty({ type: [CouponCodeResponseDto] })
  items!: CouponCodeResponseDto[];

  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 0 })
  offset!: number;

  @ApiProperty({ example: 50 })
  limit!: number;
}
