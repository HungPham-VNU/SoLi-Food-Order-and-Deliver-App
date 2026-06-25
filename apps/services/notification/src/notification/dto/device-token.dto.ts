import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import {
  devicePlatformEnum,
  type DevicePlatform,
} from '../domain/device-token.schema';

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

// ---------------------------------------------------------------------------
// Response DTOs for GET /notifications/my/push-tokens
// ---------------------------------------------------------------------------

/**
 * Single device token entry returned by GET /notifications/my/push-tokens.
 * The token value itself is partially masked (last 8 chars only) for security
 * — callers only need to know the platform and active state, not the full token.
 */
export class PushTokenItemDto {
  @ApiProperty({ description: 'Token UUID (primary key)', format: 'uuid' })
  id!: string;

  @ApiProperty({
    description:
      'FCM registration token — masked to last 8 characters for security. ' +
      'The full token is only stored server-side.',
    example: '…xyz12345',
  })
  tokenSuffix!: string;

  @ApiProperty({
    description: 'Device platform',
    enum: devicePlatformEnum.enumValues,
  })
  platform!: DevicePlatform;

  @ApiProperty({ description: 'Whether this token is currently active' })
  isActive!: boolean;

  @ApiProperty({
    description: 'Last time this token was seen or refreshed',
    format: 'date-time',
  })
  lastSeenAt!: string;

  @ApiProperty({
    description: 'When this token was first registered',
    format: 'date-time',
  })
  createdAt!: string;
}

/**
 * Response for GET /notifications/my/push-tokens.
 */
export class PushTokenListResponseDto {
  @ApiProperty({ type: [PushTokenItemDto] })
  tokens!: PushTokenItemDto[];
}
