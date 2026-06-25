import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * TestEmailDto
 *
 * Request body for the development-only email test endpoint.
 * POST /api/notifications/test/email
 *
 * TODO: Remove this DTO (and the associated endpoint) before going to production.
 * This exists solely to enable manual SMTP integration testing during development.
 */
export class TestEmailDto {
  @ApiProperty({
    description: 'Recipient email address',
    example: 'developer@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  to!: string;

  @ApiProperty({
    description: 'Email subject line',
    example: 'SoLi Food — SMTP integration test',
    maxLength: 200,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiProperty({
    description: 'Email body text',
    example: 'This is a test email from the SoLi Notification BC.',
    maxLength: 2000,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;
}

/**
 * TestEmailResponseDto
 *
 * Response from the test email endpoint.
 */
export class TestEmailResponseDto {
  @ApiProperty({ description: 'Whether the email was sent successfully' })
  success!: boolean;

  @ApiProperty({ description: 'Human-readable result message' })
  message!: string;
}
