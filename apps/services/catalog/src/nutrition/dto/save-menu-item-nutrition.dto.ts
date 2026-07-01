import { IsBoolean, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SaveMenuItemNutritionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  analysisSessionId!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  verifiedByRestaurant!: boolean;
}

export class MenuItemNutritionResponseDto {
  @ApiProperty({ example: 2 })
  servings!: number;

  @ApiProperty({ example: 660 })
  calories!: number;

  @ApiProperty({ example: 55 })
  protein!: number;

  @ApiProperty({ example: 45 })
  carbs!: number;

  @ApiProperty({ example: 21 })
  fat!: number;

  @ApiPropertyOptional({ nullable: true })
  fiber!: number | null;

  @ApiPropertyOptional({ nullable: true })
  sugar!: number | null;

  @ApiPropertyOptional({ nullable: true })
  sodium!: number | null;

  @ApiProperty({
    enum: ['AI_ESTIMATED', 'MANUALLY_ENTERED', 'VERIFIED_BY_RESTAURANT'],
    example: 'AI_ESTIMATED',
  })
  source!: 'AI_ESTIMATED' | 'MANUALLY_ENTERED' | 'VERIFIED_BY_RESTAURANT';

  @ApiProperty({ example: true })
  verifiedByRestaurant!: boolean;

  @ApiProperty({
    example:
      'Nutrition values are estimates based on the provided recipe and ingredient database. Actual values may vary depending on ingredients, portion size, and cooking method.',
  })
  disclaimer!: string;
}
