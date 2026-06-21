import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsUrl, Min } from 'class-validator';

export class CreateImageDto {
  @ApiProperty({
    description: 'Cloudinary public ID',
    example: 'app-images/sample',
  })
  @IsString()
  publicId!: string;

  @ApiProperty({
    description: 'Secure Cloudinary delivery URL',
    example: 'https://res.cloudinary.com/demo/image/upload/v123/sample.jpg',
  })
  @IsUrl()
  secureUrl!: string;

  @ApiProperty({ description: 'Image width in pixels', example: 1200 })
  @IsInt()
  @Min(1)
  width!: number;

  @ApiProperty({ description: 'Image height in pixels', example: 800 })
  @IsInt()
  @Min(1)
  height!: number;
}
