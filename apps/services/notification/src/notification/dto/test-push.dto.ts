import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * TestPushDto
 *
 * Request body for the development-only push notification test endpoint.
 * POST /api/notifications/test/push
 *
 * TODO: Remove this DTO (and the associated endpoint) before going to production.
 * This exists solely to enable manual FCM integration testing during development.
 */
export class TestPushDto {
  @ApiProperty({
    description:
      'FCM registration token obtained from the browser or mobile client',
    example: 'fqpk9P_...',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({
    description: 'Push notification title',
    example: 'Test Push',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiProperty({
    description: 'Push notification body text',
    example: 'Hello from Notification BC',
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  body!: string;
}

/**
 * TestPushResponseDto
 *
 * Response from the test push endpoint.
 */
export class TestPushResponseDto {
  @ApiProperty({
    description: 'Number of tokens that received the push notification',
  })
  successCount!: number;

  @ApiProperty({ description: 'Number of tokens that failed delivery' })
  failureCount!: number;

  @ApiProperty({
    description: 'Tokens that were identified as permanently invalid by FCM',
    type: [String],
  })
  invalidTokens!: string[];
}
