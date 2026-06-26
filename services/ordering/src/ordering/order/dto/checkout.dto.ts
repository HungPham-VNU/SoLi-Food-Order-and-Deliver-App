import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsNumber,
  ValidateNested,
  Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import type { DeliveryAddress } from '../order.schema';

// ---------------------------------------------------------------------------
// Nested DTO
// ---------------------------------------------------------------------------

export class DeliveryAddressDto implements DeliveryAddress {
  @ApiPropertyOptional({ example: '123 Nguyen Hue Blvd' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  street?: string;

  @ApiPropertyOptional({ example: 'District 1' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  district?: string;

  @ApiPropertyOptional({ example: 'Ho Chi Minh City' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  city?: string;

  @ApiPropertyOptional({
    description:
      'GPS latitude of the delivery point (used for BR-3 radius check)',
    example: 10.7769,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  latitude?: number;

  @ApiPropertyOptional({
    description:
      'GPS longitude of the delivery point (used for BR-3 radius check)',
    example: 106.7009,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  longitude?: number;
}

// ---------------------------------------------------------------------------
// Request DTO
// ---------------------------------------------------------------------------

/**
 * Request body for POST /carts/my/checkout.
 *
 * The customer provides:
 *  - deliveryAddress  — where to deliver the order
 *  - paymentMethod    — 'cod' or 'vnpay'
 *  - note             — optional note for the restaurant
 *
 * Idempotency key is read from the X-Idempotency-Key header (not in this DTO).
 */
export class CheckoutDto {
  @ApiProperty({ type: DeliveryAddressDto })
  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  deliveryAddress!: DeliveryAddressDto;

  @ApiProperty({
    enum: ['cod', 'vnpay'],
    description:
      'Payment method. COD: cash on delivery. VNPay: online payment gateway.',
    example: 'cod',
  })
  @IsEnum(['cod', 'vnpay'], {
    message: 'paymentMethod must be either "cod" or "vnpay"',
  })
  paymentMethod!: 'cod' | 'vnpay';

  @ApiPropertyOptional({
    description: 'Optional note for the restaurant (e.g. "no onions please")',
    example: 'Extra spicy please',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({
    description:
      'Coupon code to apply at checkout (e.g. "WELCOME10"). ' +
      'Automatically normalised to uppercase — case-insensitive input accepted. ' +
      'When supplied, the Promotion BC validates and reserves the discount. ' +
      'Auto-apply promotions are evaluated regardless of this field.',
    example: 'WELCOME10',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  // Normalise to uppercase before validation so callers can pass 'welcome10'
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  // Coupon codes are uppercase letters and digits only — prevents injection
  @Matches(/^[A-Z0-9]{1,20}$/, {
    message: 'couponCode must be 1–20 letters or digits',
  })
  couponCode?: string;
}

// ---------------------------------------------------------------------------
// Response DTO
// ---------------------------------------------------------------------------

/**
 * Response shape for the checkout endpoint.
 * Returns the minimal order info the client needs immediately after placement.
 */
export class CheckoutResponseDto {
  @ApiProperty({ format: 'uuid' })
  orderId!: string;

  @ApiProperty({ example: 'pending' })
  status!: string;

  @ApiProperty({
    description:
      'Net payable amount = itemsTotal + shippingFee − discountAmount (integer VND)',
    example: 135000,
  })
  totalAmount!: number;

  @ApiProperty({
    description:
      'Delivery fee computed from the closest eligible delivery zone (integer VND)',
    example: 20000,
  })
  shippingFee!: number;

  @ApiProperty({
    description:
      'Promotion discount applied at checkout (integer VND). ' +
      '0 when no promotion was applied. ' +
      'Invariant: totalAmount = itemsTotal + shippingFee − discountAmount.',
    example: 15000,
  })
  discountAmount!: number;

  @ApiProperty({ enum: ['cod', 'vnpay'] })
  paymentMethod!: string;

  @ApiPropertyOptional({
    description: 'VNPay redirect URL — present only for vnpay orders',
    example: 'https://sandbox.vnpayment.vn/...',
  })
  paymentUrl?: string | null;

  @ApiPropertyOptional({
    description:
      'Estimated delivery time in minutes. Null when location data is unavailable.',
    example: 35,
  })
  estimatedDeliveryMinutes?: number | null;

  @ApiProperty({
    description: 'ISO 8601 timestamp',
    example: '2025-01-01T00:00:00.000Z',
  })
  createdAt!: string;
}
