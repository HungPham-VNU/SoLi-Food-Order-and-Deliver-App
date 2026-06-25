import { Module } from '@nestjs/common';
import { AiModule } from '@/lib/ai/ai.module';
import { DatabaseModule } from '@/drizzle/database.module';
import { MenuModule } from '@/menu/menu.module';
import { RestaurantModule } from '@/restaurant/restaurant.module';
import { AiSearchIndexModule } from '@/search/indexing/ai-search-index.module';
import { AuthModule } from '@/auth/auth.module';
import { NutritionRpcController } from '@/rpc/nutrition-rpc.controller';
import { NutritionService } from './nutrition.service';
import { AiRecipeExtractionService } from './ai/ai-recipe-extraction.service';
import { UnitConversionService } from './matching/unit-conversion.service';
import { IngredientCanonicalizerService } from './matching/ingredient-canonicalizer.service';
import { IngredientMatchingService } from './matching/ingredient-matching.service';
import { NutritionIngredientResolutionService } from './matching/nutrition-ingredient-resolution.service';
import { NutritionCalculatorService } from './calculator/nutrition-calculator.service';
import { NutritionRepository } from './repositories/nutrition.repository';

@Module({
  imports: [
    DatabaseModule,
    MenuModule,
    RestaurantModule,
    AiModule,
    AiSearchIndexModule,
    AuthModule,
  ],
  controllers: [NutritionRpcController],
  providers: [
    NutritionService,
    NutritionRepository,
    AiRecipeExtractionService,
    UnitConversionService,
    IngredientCanonicalizerService,
    IngredientMatchingService,
    NutritionIngredientResolutionService,
    NutritionCalculatorService,
  ],
  exports: [NutritionService, NutritionRepository],
})
export class NutritionModule {}
