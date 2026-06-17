import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class AnalyzeRecipeDto {
  @ApiProperty({
    maxLength: 5000,
    example:
      'Com ga sot teriyaki\n- 500g uc ga\n- 300g com trang\nChia 2 phan',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  recipeText!: string;
}

