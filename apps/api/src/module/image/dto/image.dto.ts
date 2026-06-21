import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
export { CreateImageDto } from '@/shared/contracts/image.dto';

export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Pagination offset',
    example: 0,
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;

  @ApiPropertyOptional({
    description: 'Page size',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export class ImageResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'app-images/sample' })
  publicId!: string;

  @ApiProperty({
    example: 'https://res.cloudinary.com/demo/image/upload/v123/sample.jpg',
  })
  secureUrl!: string;

  @ApiProperty({ example: 1200 })
  width!: number;

  @ApiProperty({ example: 800 })
  height!: number;

  @ApiProperty({
    description: 'Record creation timestamp',
    type: String,
    format: 'date-time',
    example: '2026-05-09T08:30:00.000Z',
  })
  createdAt!: Date;
}

export class ImageListResponseDto {
  @ApiProperty({ type: [ImageResponseDto] })
  data!: ImageResponseDto[];

  @ApiProperty({ example: 42 })
  total!: number;
}
