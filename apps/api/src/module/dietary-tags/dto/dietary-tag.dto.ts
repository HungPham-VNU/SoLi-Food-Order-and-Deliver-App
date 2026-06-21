import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import type {
  DietaryTag,
  DietaryTagCategory,
} from '../domain/dietary-tag.schema';

export const DIETARY_TAG_CATEGORIES: DietaryTagCategory[] = [
  'dietary',
  'lifestyle',
];

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateDietaryTagDto {
  @ApiProperty({ example: 'Gluten-Free', minLength: 2, maxLength: 80 })
  @Transform(trimString)
  @IsString()
  @Length(2, 80)
  name!: string;

  @ApiProperty({
    example: 'gluten-free',
    minLength: 2,
    maxLength: 80,
    pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
  })
  @Transform(trimString)
  @IsString()
  @Length(2, 80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must contain lowercase letters, numbers, and hyphens only',
  })
  slug!: string;

  @ApiPropertyOptional({
    example: 'Contains no ingredients with gluten.',
    maxLength: 500,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ enum: DIETARY_TAG_CATEGORIES, example: 'dietary' })
  @IsEnum(DIETARY_TAG_CATEGORIES)
  category!: DietaryTagCategory;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateDietaryTagDto extends PartialType(CreateDietaryTagDto) {}

export class ListDietaryTagsQueryDto {
  @ApiPropertyOptional({ enum: DIETARY_TAG_CATEGORIES })
  @IsOptional()
  @IsEnum(DIETARY_TAG_CATEGORIES)
  category?: DietaryTagCategory;
}

export class DietaryTagResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Gluten-Free' })
  name!: string;

  @ApiProperty({ example: 'gluten-free' })
  slug!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty({ enum: DIETARY_TAG_CATEGORIES })
  category!: DietaryTagCategory;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromRow(row: DietaryTag): DietaryTagResponseDto {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description ?? null,
      category: row.category,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
