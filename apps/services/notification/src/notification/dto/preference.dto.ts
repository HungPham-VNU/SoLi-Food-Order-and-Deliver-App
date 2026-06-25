import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  notificationTypeEnum,
  type NotificationType,
} from '../domain/notification.schema';

// ---------------------------------------------------------------------------
// Request DTO — PATCH /notifications/my/preferences
// ---------------------------------------------------------------------------

/**
 * Partial update of notification preferences for the current user.
 * All fields are optional — only provided fields are updated.
 *
 * Sending quietHoursStart: null or quietHoursEnd: null disables quiet hours.
 * Sending email: null clears the stored email address.
 */
export class UpdateNotificationPreferenceDto {
  @ApiPropertyOptional({
    description: 'Enable or disable push notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable or disable in-app notifications (inbox + WebSocket)',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable or disable email notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable or disable SMS notifications (future)',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @ApiPropertyOptional({
    description:
      'Hour (0–23) at which quiet hours begin. ' +
      'Set to null to disable quiet hours. ' +
      'Overnight ranges are supported (e.g. start=22, end=7).',
    example: 22,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf(
    (o: UpdateNotificationPreferenceDto) => o.quietHoursStart !== null,
  )
  @IsInt()
  @Min(0)
  @Max(23)
  @Type(() => Number)
  quietHoursStart?: number | null;

  @ApiPropertyOptional({
    description:
      'Hour (0–23) at which quiet hours end (exclusive). ' +
      'Set to null to disable quiet hours.',
    example: 7,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o: UpdateNotificationPreferenceDto) => o.quietHoursEnd !== null)
  @IsInt()
  @Min(0)
  @Max(23)
  @Type(() => Number)
  quietHoursEnd?: number | null;

  @ApiPropertyOptional({
    description:
      'Notification types to mute (still persisted to DB, delivery skipped)',
    enum: notificationTypeEnum.enumValues,
    isArray: true,
    example: ['order_preparing', 'order_picked_up'],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(notificationTypeEnum.enumValues, { each: true })
  mutedTypes?: NotificationType[];

  @ApiPropertyOptional({
    description:
      'Email address for email channel delivery. ' +
      'Set to null to clear the stored address. ' +
      'This address is used only for notifications — separate from the account email.',
    example: 'user@example.com',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o: UpdateNotificationPreferenceDto) => o.email !== null)
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional({
    description: 'IANA timezone string for quiet hours calculation',
    example: 'Asia/Ho_Chi_Minh',
  })
  @IsOptional()
  @IsString()
  timezone?: string;
}

// ---------------------------------------------------------------------------
// Response DTO — GET and PATCH /notifications/my/preferences
// ---------------------------------------------------------------------------

/**
 * Full notification preference state for a user.
 * Returned by both GET and PATCH preference endpoints.
 */
export class NotificationPreferenceResponseDto {
  @ApiProperty({ description: 'Push notifications enabled' })
  pushEnabled!: boolean;

  @ApiProperty({
    description: 'In-app notifications enabled (inbox + WebSocket)',
  })
  inAppEnabled!: boolean;

  @ApiProperty({ description: 'Email notifications enabled' })
  emailEnabled!: boolean;

  @ApiProperty({ description: 'SMS notifications enabled' })
  smsEnabled!: boolean;

  @ApiPropertyOptional({
    description: 'Quiet hours start (0–23, null = disabled)',
    nullable: true,
  })
  quietHoursStart!: number | null;

  @ApiPropertyOptional({
    description: 'Quiet hours end (0–23, null = disabled)',
    nullable: true,
  })
  quietHoursEnd!: number | null;

  @ApiProperty({
    description: 'Muted notification types',
    enum: notificationTypeEnum.enumValues,
    isArray: true,
  })
  mutedTypes!: string[];

  @ApiPropertyOptional({
    description: 'Email address for email channel delivery (null if not set)',
    nullable: true,
  })
  email!: string | null;

  @ApiProperty({ description: 'IANA timezone string for quiet hours' })
  timezone!: string;
}
