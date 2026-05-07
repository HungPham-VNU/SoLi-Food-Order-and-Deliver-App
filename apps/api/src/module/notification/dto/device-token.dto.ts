import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { devicePlatformEnum, type DevicePlatform } from '../domain/device-token.schema';

// ---------------------------------------------------------------------------
// Request DTOs
// ---------------------------------------------------------------------------

/**
 * Request body for POST /notifications/my/push-tokens.
 * Registers (or refreshes) a push device token for the current user.
 */
export class RegisterPushTokenDto {
  @ApiProperty({
    description:
      'FCM registration token (max 500 characters). ' +
      'Registering the same token again refreshes its last_seen_at timestamp.',
    example: 'dGhpcyBpcyBhIHNhbXBsZSBGQ00gdG9rZW4...',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  token!: string;

  @ApiProperty({
    description: 'Device platform for this token',
    enum: devicePlatformEnum.enumValues,
    example: 'android',
  })
  @IsEnum(devicePlatformEnum.enumValues)
  platform!: DevicePlatform;
}

/**
 * Request body for DELETE /notifications/my/push-tokens.
 * Deactivates a specific push token for the current user.
 * Ownership is enforced at the DB level — only the authenticated user's
 * own tokens can be deactivated.
 */
export class RemovePushTokenDto {
  @ApiProperty({
    description: 'FCM registration token to remove',
    example: 'dGhpcyBpcyBhIHNhbXBsZSBGQ00gdG9rZW4...',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;
}

// ---------------------------------------------------------------------------
// Response DTOs
// ---------------------------------------------------------------------------

/**
 * Response for POST /notifications/my/push-tokens.
 */
export class RegisterPushTokenResponseDto {
  @ApiProperty({
    description:
      'Always true. The operation is idempotent: ' +
      're-registering an existing token refreshes its last_seen_at.',
  })
  registered!: boolean;
}

/**
 * Response for DELETE /notifications/my/push-tokens.
 */
export class RemovePushTokenResponseDto {
  @ApiProperty({
    description:
      'Always true. The operation is idempotent: ' +
      'removing a non-existent token is a no-op.',
  })
  removed!: boolean;
}
