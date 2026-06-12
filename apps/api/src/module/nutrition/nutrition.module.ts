import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/drizzle/drizzle.module';
import { MenuModule } from '@/module/restaurant-catalog/menu/menu.module';
import { RestaurantModule } from '@/module/restaurant-catalog/restaurant/restaurant.module';
import { NutritionController } from './nutrition.controller';
import { NutritionService } from './nutrition.service';
import { AiRecipeExtractionService } from './ai/ai-recipe-extraction.service';
import { ollamaProvider } from './ai/ollama.provider';
import { UnitConversionService } from './matching/unit-conversion.service';
import { IngredientMatchingService } from './matching/ingredient-matching.service';
import { NutritionCalculatorService } from './calculator/nutrition-calculator.service';
import { NutritionRepository } from './repositories/nutrition.repository';

@Module({
  imports: [DatabaseModule, MenuModule, RestaurantModule],
  controllers: [NutritionController],
  providers: [
    NutritionService,
    NutritionRepository,
    AiRecipeExtractionService,
    UnitConversionService,
    IngredientMatchingService,
    NutritionCalculatorService,
    ollamaProvider,
  ],
  exports: [NutritionService, NutritionRepository],
})
export class NutritionModule {}

