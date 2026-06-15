import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  INGREDIENT_CATEGORIES,
  NUTRITION_UNITS,
  PREPARATION_STATES,
  type IngredientCategory,
  type NutritionUnit,
  type PreparationState,
} from '../types/nutrition.types';

export class ConfirmedIngredientDto {
  @ApiProperty({ example: 'uc ga' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 500, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number | null;

  @ApiProperty({ enum: NUTRITION_UNITS, example: 'g' })
  @IsIn(NUTRITION_UNITS)
  unit!: NutritionUnit;

  @ApiPropertyOptional({ enum: PREPARATION_STATES, example: 'cooked' })
  @IsOptional()
  @IsIn(PREPARATION_STATES)
  preparation?: PreparationState | null;

  @ApiPropertyOptional({ enum: INGREDIENT_CATEGORIES, example: 'main' })
  @IsOptional()
  @IsIn(INGREDIENT_CATEGORIES)
  category?: IngredientCategory;
}

export class CalculateNutritionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  analysisSessionId!: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(1)
  servings!: number;

  @ApiProperty({ type: [ConfirmedIngredientDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmedIngredientDto)
  ingredients!: ConfirmedIngredientDto[];
}
