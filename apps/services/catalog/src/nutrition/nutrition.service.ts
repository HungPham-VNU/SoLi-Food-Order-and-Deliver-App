import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MenuService } from '@/menu/menu.service';
import { RestaurantService } from '@/restaurant/restaurant.service';
import type { MenuItem } from '@/menu/menu.schema';
import { AiRecipeExtractionService } from './ai/ai-recipe-extraction.service';
import { NutritionRepository } from './repositories/nutrition.repository';
import { UnitConversionService } from './matching/unit-conversion.service';
import { IngredientMatchingService } from './matching/ingredient-matching.service';
import {
  NutritionIngredientResolutionService,
  type MatchedNutritionIngredient,
} from './matching/nutrition-ingredient-resolution.service';
import {
  NutritionCalculatorService,
  type NutritionCalculationResult,
} from './calculator/nutrition-calculator.service';
import type { AnalyzeRecipeDto } from './dto/analyze-recipe.dto';
import type { CalculateNutritionDto } from './dto/calculate-nutrition.dto';
import type { SaveMenuItemNutritionDto } from './dto/save-menu-item-nutrition.dto';
import {
  NUTRITION_DISCLAIMER,
  type ExtractedRecipe,
  type NutritionAnalysisStatus,
} from './types/nutrition.types';
import type { NutritionAnalysisSession } from './domain/nutrition.schema';
import {
  buildConfirmedRecipe,
  parseExtractedRecipe,
  toAnalysisIngredientRow,
  toCalculatedAnalysisIngredientRow,
  toMenuItemNutritionResponse,
  toReviewIngredientResponse,
  toReviewIngredients,
  toSaveMenuItemNutritionValues,
} from './nutrition.mapper';
import { applyRecipeReviewRules } from './review/nutrition-review.policy';

const DEFAULT_NUTRITION_LOCALE = 'vi';

@Injectable()
export class NutritionService {
  constructor(
    private readonly menuService: MenuService,
    private readonly restaurantService: RestaurantService,
    private readonly aiExtraction: AiRecipeExtractionService,
    private readonly repo: NutritionRepository,
    private readonly unitConversion: UnitConversionService,
    private readonly ingredientMatching: IngredientMatchingService,
    private readonly ingredientResolution: NutritionIngredientResolutionService,
    private readonly calculator: NutritionCalculatorService,
  ) {}

  async analyzeRecipe(
    menuItemId: string,
    requesterId: string,
    isAdmin: boolean,
    dto: AnalyzeRecipeDto,
  ) {
    const menuItem = await this.assertMenuItemOwnership(
      menuItemId,
      requesterId,
      isAdmin,
    );
    const recipeText = this.sanitizeRecipeText(dto.recipeText);

    let extracted: ExtractedRecipe;
    try {
      extracted = await this.aiExtraction.extractRecipe(recipeText);
    } catch {
      return this.createFailedAnalysisResponse({
        menuItemId,
        restaurantId: menuItem.restaurantId,
        recipeText,
      });
    }

    const reviewed = applyRecipeReviewRules(extracted, {
      unitConversion: this.unitConversion,
      ingredientMatching: this.ingredientMatching,
    });
    const status: NutritionAnalysisStatus = reviewed.hasReviewIssues
      ? 'NEEDS_REVIEW'
      : 'ANALYZED';

    const session = await this.repo.createSession({
      menuItemId,
      restaurantId: menuItem.restaurantId,
      inputType: 'text',
      rawRecipeText: recipeText,
      aiExtractedJson: extracted,
      status,
    });

    await this.repo.insertIngredients(
      reviewed.ingredients.map((ingredient) =>
        toAnalysisIngredientRow(session.id, ingredient),
      ),
    );

    return {
      analysisSessionId: session.id,
      recipeName: extracted.recipeName,
      servings: extracted.servings,
      ingredients: reviewed.ingredients.map((ingredient) =>
        toReviewIngredientResponse(ingredient),
      ),
      warnings: reviewed.warnings,
      status,
    };
  }

  async calculateNutrition(
    menuItemId: string,
    requesterId: string,
    isAdmin: boolean,
    dto: CalculateNutritionDto,
  ) {
    await this.assertMenuItemOwnership(menuItemId, requesterId, isAdmin);
    const session = await this.assertAnalysisSessionBelongsToMenuItem(
      menuItemId,
      dto.analysisSessionId,
    );

    const locale = this.normalizeNutritionLocale(dto.locale);
    const matchedIngredients = await this.ingredientResolution.resolveAll(
      dto.ingredients,
      locale,
    );
    const calculation = this.calculateMatchedNutrition(
      dto.servings,
      matchedIngredients,
    );

    await this.persistCalculatedSession(session, dto, matchedIngredients);

    return this.toCalculateNutritionResponse(matchedIngredients, calculation);
  }

  async getLatestMenuItemNutritionAnalysis(
    menuItemId: string,
    requesterId: string,
    isAdmin: boolean,
  ) {
    await this.assertMenuItemOwnership(menuItemId, requesterId, isAdmin);
    const session =
      await this.repo.findLatestEditableAnalysisByMenuItemId(menuItemId);
    if (!session) return null;

    const ingredients = await this.repo.listIngredientsBySessionId(session.id);
    const extractedRecipe = parseExtractedRecipe(session.aiExtractedJson);

    return {
      analysisSessionId: session.id,
      recipeName: extractedRecipe?.recipeName ?? null,
      recipeText: session.rawRecipeText,
      servings: extractedRecipe?.servings ?? null,
      ingredients: toReviewIngredients(ingredients, extractedRecipe),
      warnings: extractedRecipe?.warnings ?? [],
      status: session.status,
    };
  }

  async startManualIngredientSession(
    menuItemId: string,
    requesterId: string,
    isAdmin: boolean,
  ) {
    const menuItem = await this.assertMenuItemOwnership(
      menuItemId,
      requesterId,
      isAdmin,
    );
    const session = await this.repo.createSession({
      menuItemId,
      restaurantId: menuItem.restaurantId,
      inputType: 'manual',
      rawRecipeText: '',
      aiExtractedJson: {
        recipeName: null,
        servings: 1,
        ingredients: [],
        warnings: [],
      },
      status: 'NEEDS_REVIEW',
    });

    return {
      analysisSessionId: session.id,
      recipeName: null,
      servings: 1,
      ingredients: [],
      warnings: [],
      status: session.status,
    };
  }

  async saveMenuItemNutrition(
    menuItemId: string,
    requesterId: string,
    isAdmin: boolean,
    dto: SaveMenuItemNutritionDto,
  ) {
    await this.assertMenuItemOwnership(menuItemId, requesterId, isAdmin);
    if (dto.verifiedByRestaurant !== true) {
      throw new BadRequestException(
        'Restaurant verification is required before saving nutrition.',
      );
    }

    const session = await this.assertAnalysisSessionBelongsToMenuItem(
      menuItemId,
      dto.analysisSessionId,
    );
    if (session.status !== 'CALCULATED') {
      throw new BadRequestException(
        'Nutrition must be calculated from confirmed ingredients before saving.',
      );
    }

    const extractedRecipe = parseExtractedRecipe(session.aiExtractedJson);
    const servings = extractedRecipe?.servings;
    if (!servings || servings <= 0) {
      throw new BadRequestException(
        'Calculated nutrition is missing a valid serving count.',
      );
    }

    const persistedIngredients = await this.repo.listIngredientsBySessionId(
      session.id,
    );
    const calculationInputs = await Promise.all(
      persistedIngredients.map(async (ingredient) => ({
        inputName: ingredient.correctedName ?? ingredient.extractedName,
        quantityGram: ingredient.quantityGram,
        food: ingredient.matchedNutritionFoodId
          ? await this.repo.findNutritionFoodById(
              ingredient.matchedNutritionFoodId,
            )
          : null,
      })),
    );
    if (
      !calculationInputs.some(
        (ingredient) =>
          ingredient.food !== null && ingredient.quantityGram !== null,
      )
    ) {
      throw new BadRequestException(
        'At least one measured, matched ingredient is required before saving nutrition.',
      );
    }
    const calculation = this.calculator.calculate(servings, calculationInputs);

    const savedNutrition = await this.repo.saveMenuItemNutrition(
      toSaveMenuItemNutritionValues(
        menuItemId,
        servings,
        calculation.nutrition.perServing,
        session.inputType === 'manual' ? 'MANUALLY_ENTERED' : 'AI_ESTIMATED',
      ),
      {
        analysisSessionId: session.id,
      },
    );

    return toMenuItemNutritionResponse(savedNutrition);
  }

  private async createFailedAnalysisResponse(input: {
    menuItemId: string;
    restaurantId: string;
    recipeText: string;
  }) {
    const failedSession = await this.repo.createSession({
      menuItemId: input.menuItemId,
      restaurantId: input.restaurantId,
      inputType: 'text',
      rawRecipeText: input.recipeText,
      aiExtractedJson: null,
      status: 'FAILED',
    });

    return {
      analysisSessionId: failedSession.id,
      recipeName: null,
      servings: null,
      ingredients: [],
      warnings: [
        'AI analysis service is currently unavailable. Please try again or enter ingredients manually.',
      ],
      status: 'FAILED' as const,
    };
  }

  private async assertAnalysisSessionBelongsToMenuItem(
    menuItemId: string,
    analysisSessionId: string,
  ): Promise<NutritionAnalysisSession> {
    const session = await this.repo.findSessionById(analysisSessionId);
    if (!session) {
      throw new NotFoundException('Nutrition analysis session not found.');
    }
    if (session.menuItemId !== menuItemId) {
      throw new BadRequestException(
        'Analysis session does not belong to this menu item.',
      );
    }

    return session;
  }

  private calculateMatchedNutrition(
    servings: number,
    matchedIngredients: MatchedNutritionIngredient[],
  ): NutritionCalculationResult {
    return this.calculator.calculate(
      servings,
      matchedIngredients
        .filter((ingredient) => !ingredient.excludedFromCalculation)
        .map((ingredient) => ({
          inputName: ingredient.inputName,
          quantityGram: ingredient.quantityGram,
          food: ingredient.food,
        })),
    );
  }

  private async persistCalculatedSession(
    session: NutritionAnalysisSession,
    dto: CalculateNutritionDto,
    matchedIngredients: MatchedNutritionIngredient[],
  ): Promise<void> {
    await this.repo.replaceSessionIngredients(
      session.id,
      matchedIngredients.map((ingredient) =>
        toCalculatedAnalysisIngredientRow(session.id, ingredient),
      ),
    );
    await this.repo.updateCalculatedSession(
      session.id,
      buildConfirmedRecipe(session.aiExtractedJson, dto),
    );
  }

  private toCalculateNutritionResponse(
    matchedIngredients: MatchedNutritionIngredient[],
    calculation: NutritionCalculationResult,
  ) {
    return {
      matchedIngredients: matchedIngredients.map((ingredient) => ({
        inputName: ingredient.inputName,
        matchedFoodId: ingredient.matchedFoodId,
        matchedName: ingredient.matchedName,
        quantityGram: ingredient.quantityGram,
        matchConfidence: ingredient.matchConfidence,
        requiresConfirmation: ingredient.requiresConfirmation,
        excludedFromCalculation: ingredient.excludedFromCalculation,
        candidates: ingredient.candidates,
        warnings: ingredient.warnings,
      })),
      nutrition: calculation.nutrition,
      warnings: [
        ...matchedIngredients.flatMap((ingredient) => ingredient.warnings),
        ...calculation.warnings,
        NUTRITION_DISCLAIMER,
      ],
    };
  }

  private async assertMenuItemOwnership(
    menuItemId: string,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<MenuItem> {
    const menuItem = await this.menuService.findOne(menuItemId);
    if (isAdmin) return menuItem;

    const restaurant = await this.restaurantService.findOne(
      menuItem.restaurantId,
    );
    if (restaurant.ownerId !== requesterId) {
      throw new ForbiddenException('You do not own this menu item.');
    }

    return menuItem;
  }

  private sanitizeRecipeText(recipeText: string): string {
    return recipeText.trim().replace(/\0/g, '').slice(0, 5000);
  }

  private normalizeNutritionLocale(locale: string | null | undefined): string {
    const normalized = (locale ?? DEFAULT_NUTRITION_LOCALE)
      .trim()
      .toLowerCase()
      .replace(/_/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 16);

    return normalized || DEFAULT_NUTRITION_LOCALE;
  }
}
