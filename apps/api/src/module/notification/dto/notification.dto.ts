import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  notificationTypeEnum,
  type NotificationType,
} from '../domain/notification.schema';

// ---------------------------------------------------------------------------
// Query DTO — used by GET /notifications/my
// ---------------------------------------------------------------------------

/**
 * Query parameters for the notification inbox endpoint.
 *
 * All fields are optional. When absent, defaults are applied:
 *   unreadOnly = false (include all)
 *   type = undefined  (include all types)
 *   limit = 20
 *   offset = 0
 */
export class NotificationInboxQueryDto {
  @ApiPropertyOptional({
    description: 'When true, only unread notifications are returned',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  unreadOnly?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by a specific notification type',
    enum: notificationTypeEnum.enumValues,
  })
  @IsOptional()
  @IsEnum(notificationTypeEnum.enumValues)
  type?: NotificationType;

  @ApiPropertyOptional({
    description: 'Maximum items to return (page size)',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Number of items to skip (offset-based pagination)',
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;
}

// ---------------------------------------------------------------------------
// Response DTOs
// ---------------------------------------------------------------------------

/**
 * A single notification row in the in-app inbox.
 */
export class NotificationItemDto {
  @ApiProperty({ description: 'Notification UUID', format: 'uuid' })
  id!: string;

  @ApiProperty({
    description: 'Notification type',
    enum: notificationTypeEnum.enumValues,
  })
  type!: NotificationType;

  @ApiProperty({ description: 'Notification title' })
  title!: string;

  @ApiProperty({ description: 'Notification body text' })
  body!: string;

  @ApiPropertyOptional({
    description: 'Structured metadata for deep linking (key-value string pairs)',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  data?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Associated order UUID (when notification relates to an order)',
    format: 'uuid',
  })
  orderId?: string;

  @ApiProperty({ description: 'Whether the user has read this notification' })
  isRead!: boolean;

  @ApiPropertyOptional({
    description: 'ISO8601 timestamp when this notification was read (null if unread)',
  })
  readAt?: string;

  @ApiProperty({ description: 'ISO8601 timestamp when the notification was created' })
  createdAt!: string;
}

/**
 * Paginated inbox response for GET /notifications/my.
 *
 * The `unreadCount` field reflects the total unread count for the user (not
 * just for this page), allowing the client to display a badge without a
 * separate request.
 */
export class NotificationInboxResponseDto {
  @ApiProperty({ type: [NotificationItemDto], description: 'Notification items on this page' })
  items!: NotificationItemDto[];

  @ApiProperty({
    description: 'Total number of notifications matching the applied filters (for pagination UI)',
  })
  total!: number;

  @ApiProperty({
    description: 'Total unread in-app notification count for the current user (badge value)',
  })
  unreadCount!: number;

  @ApiProperty({ description: 'Offset applied to this response' })
  offset!: number;

  @ApiProperty({ description: 'Page size applied to this response' })
  limit!: number;

  @ApiProperty({
    description: 'Whether additional items exist after this page (offset + items.length < total)',
  })
  hasMore!: boolean;
}

/**
 * Response for GET /notifications/my/unread-count.
 */
export class UnreadCountResponseDto {
  @ApiProperty({ description: 'Total unread in-app notifications for the current user' })
  count!: number;
}

/**
 * Response for PATCH /notifications/:id/read.
 */
export class MarkReadResponseDto {
  @ApiProperty({
    description:
      'True when the notification was found and marked as read. ' +
      'False when no notification with the given ID exists for the current user ' +
      '(either not found or already read — idempotent).',
  })
  success!: boolean;
}

/**
 * Response for PATCH /notifications/my/read-all.
 */
export class MarkAllReadResponseDto {
  @ApiProperty({
    description: 'Number of notifications that were updated from unread → read',
  })
  count!: number;
}
