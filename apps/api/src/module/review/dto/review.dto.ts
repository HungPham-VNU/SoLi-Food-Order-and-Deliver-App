import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { ReviewModerationStatus } from '../domain/review.schema';

// ---------------------------------------------------------------------------
// Allowed tag allowlist (BR-22.1)
// ---------------------------------------------------------------------------

/**
 * Pre-defined customer review tags. Restricts the `tags` field on
 * SubmitReviewDto to a known set so customers cannot inject arbitrary values.
 */
export const ALLOWED_REVIEW_TAGS = [
  // Positive tags
  'fast_delivery',
  'good_packaging',
  'fresh_food',
  'accurate_order',
  'friendly_service',
  // Negative tags
  'poor_packaging',
  'late_delivery',
  'wrong_order',
  'cold_food',
  'missing_items',
] as const;

export type ReviewTag = (typeof ALLOWED_REVIEW_TAGS)[number];

// ---------------------------------------------------------------------------
// SubmitReviewDto — POST /reviews body (BR-22.1, BR-22.2, QA-S-05)
// ---------------------------------------------------------------------------

export class SubmitReviewDto {
  @ApiProperty({
    description: 'Order being reviewed (must be delivered and owned by caller)',
    format: 'uuid',
  })
  @IsUUID()
  orderId!: string;

  @ApiProperty({ description: 'Star rating (1–5)', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  stars!: number;

  @ApiPropertyOptional({
    description: 'Free-form comment, max 1000 characters (trimmed)',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  comment?: string;

  @ApiPropertyOptional({
    description: 'Pre-defined tags from the allowlist (max 5)',
    type: [String],
    enum: ALLOWED_REVIEW_TAGS,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsIn(ALLOWED_REVIEW_TAGS, { each: true })
  tags?: string[];
}

// ---------------------------------------------------------------------------
// ReviewResponseDto — shape of POST /reviews 201 and GET /reviews/my/:id 200
// ---------------------------------------------------------------------------

export class ReviewResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  orderId!: string;

  @ApiProperty({ format: 'uuid' })
  customerId!: string;

  @ApiProperty({ format: 'uuid' })
  restaurantId!: string;

  @ApiProperty()
  stars!: number;

  @ApiPropertyOptional()
  comment?: string | null;

  @ApiPropertyOptional({ type: [String] })
  tags?: string[] | null;

  @ApiProperty({ enum: ['visible', 'flagged', 'hidden'] })
  moderationStatus!: ReviewModerationStatus;

  @ApiProperty()
  createdAt!: string;

  @ApiPropertyOptional({
    description: 'Confirmation message returned only on the 201 submit path',
  })
  message?: string;
}

// ---------------------------------------------------------------------------
// Public listing DTO — GET /reviews/restaurant/:id
// Customer identity is intentionally NOT exposed on public review listings.
// ---------------------------------------------------------------------------

export class PublicReviewItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  stars!: number;

  @ApiPropertyOptional()
  comment?: string | null;

  @ApiPropertyOptional({ type: [String] })
  tags?: string[] | null;

  @ApiProperty()
  createdAt!: string;
}

export class PublicReviewListResponseDto {
  @ApiProperty({ type: [PublicReviewItemDto] })
  data!: PublicReviewItemDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}
