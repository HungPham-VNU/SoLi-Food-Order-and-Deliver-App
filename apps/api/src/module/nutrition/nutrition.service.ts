import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MenuService } from '@/module/restaurant-catalog/menu/menu.service';
import { RestaurantService } from '@/module/restaurant-catalog/restaurant/restaurant.service';
import type { MenuItem } from '@/module/restaurant-catalog/menu/menu.schema';
import { AiRecipeExtractionService } from './ai/ai-recipe-extraction.service';
import {
  NutritionRepository,
  type NutritionFoodSearchResult,
} from './repositories/nutrition.repository';
import { UnitConversionService } from './matching/unit-conversion.service';
import {
  IngredientMatchingService,
  type IngredientMatchResult,
} from './matching/ingredient-matching.service';
import {
  IngredientCanonicalizerService,
  type IngredientCanonicalizationResult,
} from './matching/ingredient-canonicalizer.service';
import { NutritionCalculatorService } from './calculator/nutrition-calculator.service';
import type { AnalyzeRecipeDto } from './dto/analyze-recipe.dto';
import type {
  CalculateNutritionDto,
  ConfirmedIngredientDto,
} from './dto/calculate-nutrition.dto';
import type { SaveMenuItemNutritionDto } from './dto/save-menu-item-nutrition.dto';
import {
  INGREDIENT_CATEGORIES,
  NUTRITION_DISCLAIMER,
  NUTRITION_UNITS,
  PREPARATION_STATES,
  type ExtractedRecipe,
  type ExtractedRecipeIngredient,
  type IngredientCategory,
  type NutritionAnalysisStatus,
  type NutritionUnit,
  type PreparationState,
} from './types/nutrition.types';
import type {
  NewNutritionAnalysisIngredient,
  NutritionAnalysisIngredient,
  MenuItemNutrition,
} from './domain/nutrition.schema';

const NO_PREPARATION_CATEGORIES: ReadonlySet<IngredientCategory> = new Set([
  'seasoning',
  'sauce',
  'garnish',
  'herb_side',
]);

const OPTIONAL_MEASUREMENT_CATEGORIES: ReadonlySet<IngredientCategory> =
  new Set(['seasoning', 'sauce', 'garnish', 'herb_side']);
const DEFAULT_NUTRITION_LOCALE = 'vi';
const CANONICAL_NAME_CONFIRMATION_THRESHOLD = 0.8;

interface NutritionFoodMatchResolution {
  foods: NutritionFoodSearchResult[];
  match: IngredientMatchResult;
  matchedFood: NutritionFoodSearchResult | null;
  requiresConfirmation: boolean;
  warnings: string[];
  canonicalEnglishName: string | null;
  canonicalConfidence: number | null;
  matchSource:
    | 'localized'
    | 'canonical-cache'
    | 'canonical-provided'
    | 'canonical-input'
    | 'restaurant-confirmed';
}

@Injectable()
export class NutritionService {
  constructor(
    private readonly menuService: MenuService,
    private readonly restaurantService: RestaurantService,
    private readonly aiExtraction: AiRecipeExtractionService,
    private readonly repo: NutritionRepository,
    private readonly unitConversion: UnitConversionService,
    private readonly ingredientMatching: IngredientMatchingService,
    private readonly ingredientCanonicalizer: IngredientCanonicalizerService,
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
      const failedSession = await this.repo.createSession({
        menuItemId,
        restaurantId: menuItem.restaurantId,
        inputType: 'text',
        rawRecipeText: recipeText,
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

    const reviewed = this.applyReviewRules(extracted);
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
        this.toAnalysisIngredientRow(session.id, ingredient),
      ),
    );

    return {
      analysisSessionId: session.id,
      recipeName: extracted.recipeName,
      servings: extracted.servings,
      ingredients: reviewed.ingredients.map((ingredient) =>
        this.toReviewIngredientResponse(ingredient),
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
    const session = await this.repo.findSessionById(dto.analysisSessionId);
    if (!session) {
      throw new NotFoundException('Nutrition analysis session not found.');
    }
    if (session.menuItemId !== menuItemId) {
      throw new BadRequestException(
        'Analysis session does not belong to this menu item.',
      );
    }

    const locale = this.normalizeNutritionLocale(dto.locale);
    const matchedIngredients = await Promise.all(
      dto.ingredients.map((ingredient) =>
        this.matchAndConvertIngredient(ingredient, locale),
      ),
    );

    const calculation = this.calculator.calculate(
      dto.servings,
      matchedIngredients
        .filter((ingredient) => !ingredient.excludedFromCalculation)
        .map((ingredient) => ({
          inputName: ingredient.inputName,
          quantityGram: ingredient.quantityGram,
          food: ingredient.food,
        })),
    );

    const warnings = [
      ...matchedIngredients.flatMap((ingredient) => ingredient.warnings),
      ...calculation.warnings,
      NUTRITION_DISCLAIMER,
    ];

    await this.repo.replaceSessionIngredients(
      session.id,
      matchedIngredients.map((ingredient) => ({
        analysisSessionId: session.id,
        rawText: null,
        extractedName: ingredient.inputName,
        correctedName: ingredient.inputName,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        quantityGram: ingredient.quantityGram,
        matchedNutritionFoodId: ingredient.matchedFoodId,
        confidence: ingredient.matchConfidence,
        requiresConfirmation: ingredient.requiresConfirmation,
        notes: ingredient.warnings,
      })),
    );
    await this.repo.updateCalculatedSession(
      session.id,
      this.buildConfirmedRecipe(session.aiExtractedJson, dto),
    );

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
      warnings,
    };
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

    const [ingredients] = await Promise.all([
      this.repo.listIngredientsBySessionId(session.id),
    ]);
    const extractedRecipe = this.parseExtractedRecipe(session.aiExtractedJson);

    return {
      analysisSessionId: session.id,
      recipeName: extractedRecipe?.recipeName ?? null,
      recipeText: session.rawRecipeText,
      servings: extractedRecipe?.servings ?? null,
      ingredients: this.toReviewIngredients(ingredients, extractedRecipe),
      warnings: extractedRecipe?.warnings ?? [],
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

    const session = await this.repo.findSessionById(dto.analysisSessionId);
    if (!session) {
      throw new NotFoundException('Nutrition analysis session not found.');
    }
    if (session.menuItemId !== menuItemId) {
      throw new BadRequestException(
        'Analysis session does not belong to this menu item.',
      );
    }

    const savedNutrition = await this.repo.saveMenuItemNutrition({
      menuItemId,
      servings: dto.servings,
      calories: dto.nutrition.calories,
      protein: dto.nutrition.protein,
      carbs: dto.nutrition.carbs,
      fat: dto.nutrition.fat,
      fiber: dto.nutrition.fiber ?? null,
      sugar: dto.nutrition.sugar ?? null,
      sodium: dto.nutrition.sodium ?? null,
      verifiedByRestaurant: true,
    });
    await this.repo.updateSessionStatus(session.id, 'SAVED');

    return this.toMenuItemNutritionResponse(savedNutrition);
  }

  private toMenuItemNutritionResponse(nutrition: MenuItemNutrition) {
    return {
      servings: nutrition.servings,
      calories: nutrition.calories,
      protein: nutrition.protein,
      carbs: nutrition.carbs,
      fat: nutrition.fat,
      fiber: nutrition.fiber,
      sugar: nutrition.sugar,
      sodium: nutrition.sodium,
      source: nutrition.source,
      verifiedByRestaurant: nutrition.verifiedByRestaurant,
      disclaimer: NUTRITION_DISCLAIMER,
    };
  }

  private buildConfirmedRecipe(
    aiExtractedJson: unknown,
    dto: CalculateNutritionDto,
  ): ExtractedRecipe {
    const existingRecipe = this.parseExtractedRecipe(aiExtractedJson);
    const existingIngredientsByName = this.indexIngredientsByName(
      existingRecipe?.ingredients ?? [],
    );

    return {
      recipeName: existingRecipe?.recipeName ?? null,
      servings: dto.servings,
      ingredients: dto.ingredients.map((ingredient) => {
        const existingIngredient = existingIngredientsByName.get(
          this.normalizeIngredientName(ingredient.name),
        );

        const confirmedIngredient = {
          rawText: existingIngredient?.rawText ?? ingredient.name,
          name: ingredient.name,
          canonicalNameEn:
            ingredient.canonicalNameEn ?? existingIngredient?.canonicalNameEn ?? null,
          canonicalNameConfidence:
            ingredient.canonicalNameConfidence ??
            existingIngredient?.canonicalNameConfidence ??
            null,
          quantity: ingredient.quantity ?? null,
          unit: ingredient.unit,
          preparation: ingredient.preparation ?? 'unknown',
          category: ingredient.category ?? 'main',
          confidence: existingIngredient?.confidence ?? 1,
          requiresConfirmation: false,
          notes: [],
        };

        return {
          ...confirmedIngredient,
          ...this.getReviewIngredientMetadata(confirmedIngredient),
        };
      }),
      warnings: existingRecipe?.warnings ?? [],
    };
  }

  private toReviewIngredients(
    rows: NutritionAnalysisIngredient[],
    extractedRecipe: ExtractedRecipe | null,
  ) {
    if (rows.length === 0) {
      return (
        extractedRecipe?.ingredients.map((ingredient) =>
          this.toReviewIngredientResponse(ingredient),
        ) ?? []
      );
    }

    const extractedIngredients = extractedRecipe?.ingredients ?? [];
    const extractedIngredientsByName =
      this.indexIngredientsByName(extractedIngredients);

    return rows.map((row, index) => {
      const name = row.correctedName ?? row.extractedName;
      const extractedIngredient =
        extractedIngredients[index] ??
        extractedIngredientsByName.get(this.normalizeIngredientName(name));

      return this.toReviewIngredientResponse({
        rawText: row.rawText ?? extractedIngredient?.rawText ?? null,
        name,
        canonicalNameEn: extractedIngredient?.canonicalNameEn ?? null,
        canonicalNameConfidence:
          extractedIngredient?.canonicalNameConfidence ?? null,
        quantity: row.quantity,
        unit: this.toNutritionUnit(row.unit),
        preparation: this.toPreparationState(
          extractedIngredient?.preparation ?? 'unknown',
        ),
        category: extractedIngredient?.category ?? 'main',
        confidence: row.confidence ?? extractedIngredient?.confidence ?? 1,
        requiresConfirmation:
          row.requiresConfirmation ??
          extractedIngredient?.requiresConfirmation ??
          false,
        notes: row.notes ?? extractedIngredient?.notes ?? [],
      });
    });
  }

  private toReviewIngredientResponse(
    ingredient: Omit<ExtractedRecipeIngredient, 'rawText'> & {
      rawText?: string | null;
      canonicalNameEn?: string | null;
      canonicalNameConfidence?: number | null;
    },
  ) {
    const metadata = this.getReviewIngredientMetadata(ingredient);

    return {
      rawText: ingredient.rawText ?? null,
      name: ingredient.name,
      canonicalNameEn: ingredient.canonicalNameEn ?? null,
      canonicalNameConfidence: ingredient.canonicalNameConfidence ?? null,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      preparation: metadata.preparationApplicable
        ? ingredient.preparation
        : null,
      confidence: ingredient.confidence,
      requiresConfirmation: ingredient.requiresConfirmation ?? false,
      category: ingredient.category ?? 'main',
      measurementRequired: metadata.measurementRequired,
      preparationApplicable: metadata.preparationApplicable,
      notes: ingredient.notes ?? [],
    };
  }

  private getReviewIngredientMetadata(
    ingredient: Pick<ExtractedRecipeIngredient, 'category' | 'quantity'>,
  ) {
    const category = ingredient.category ?? 'main';
    const preparationApplicable = !NO_PREPARATION_CATEGORIES.has(category);
    const measurementRequired =
      !OPTIONAL_MEASUREMENT_CATEGORIES.has(category) ||
      ingredient.quantity !== null;

    return {
      measurementRequired,
      preparationApplicable,
    };
  }

  private parseExtractedRecipe(value: unknown): ExtractedRecipe | null {
    if (!value || typeof value !== 'object') return null;

    const recipe = value as Partial<ExtractedRecipe>;
    if (!Array.isArray(recipe.ingredients)) return null;
    const ingredients = recipe.ingredients as unknown[];

    return {
      recipeName:
        typeof recipe.recipeName === 'string' ? recipe.recipeName : null,
      servings:
        typeof recipe.servings === 'number' && recipe.servings > 0
          ? recipe.servings
          : null,
      ingredients: ingredients
        .filter(
          (ingredient): ingredient is Partial<ExtractedRecipeIngredient> =>
            !!ingredient && typeof ingredient === 'object',
        )
        .map((ingredient) => ({
          rawText:
            typeof ingredient.rawText === 'string'
              ? ingredient.rawText
              : (ingredient.name ?? ''),
          name: typeof ingredient.name === 'string' ? ingredient.name : '',
          canonicalNameEn:
            typeof ingredient.canonicalNameEn === 'string'
              ? ingredient.canonicalNameEn
              : null,
          canonicalNameConfidence:
            typeof ingredient.canonicalNameConfidence === 'number'
              ? ingredient.canonicalNameConfidence
              : null,
          quantity:
            typeof ingredient.quantity === 'number'
              ? ingredient.quantity
              : null,
          unit: this.toNutritionUnit(ingredient.unit),
          preparation: this.toPreparationState(ingredient.preparation),
          category: this.toIngredientCategory(ingredient.category),
          confidence:
            typeof ingredient.confidence === 'number'
              ? ingredient.confidence
              : 1,
          requiresConfirmation: ingredient.requiresConfirmation ?? false,
          notes: Array.isArray(ingredient.notes) ? ingredient.notes : [],
        }))
        .filter((ingredient) => ingredient.name.trim().length > 0),
      warnings: Array.isArray(recipe.warnings) ? recipe.warnings : [],
    };
  }

  private indexIngredientsByName(ingredients: ExtractedRecipeIngredient[]) {
    return new Map(
      ingredients.map((ingredient) => [
        this.normalizeIngredientName(ingredient.name),
        ingredient,
      ]),
    );
  }

  private toIngredientCategory(category: unknown): IngredientCategory {
    return typeof category === 'string' &&
      (INGREDIENT_CATEGORIES as readonly string[]).includes(category)
      ? (category as IngredientCategory)
      : 'main';
  }

  private normalizeIngredientName(name: string): string {
    return name
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim()
      .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
      .replace(/\s+/g, ' ');
  }

  private toNutritionUnit(unit: unknown): NutritionUnit {
    return typeof unit === 'string' &&
      (NUTRITION_UNITS as readonly string[]).includes(unit)
      ? (unit as NutritionUnit)
      : 'unknown';
  }

  private toPreparationState(preparation: unknown): PreparationState {
    return typeof preparation === 'string' &&
      (PREPARATION_STATES as readonly string[]).includes(preparation)
      ? (preparation as PreparationState)
      : 'unknown';
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

  private applyReviewRules(recipe: ExtractedRecipe) {
    const warnings = [...recipe.warnings];
    let hasReviewIssues = warnings.length > 0;

    if (recipe.servings === null) {
      warnings.push(
        'Servings are missing. Please enter the number of servings.',
      );
      hasReviewIssues = true;
    }

    const ingredients = recipe.ingredients.map((ingredient) => {
      const notes = [...(ingredient.notes ?? [])];
      let requiresConfirmation = ingredient.requiresConfirmation ?? false;
      const reviewMetadata = this.getReviewIngredientMetadata(ingredient);

      if (requiresConfirmation || notes.length > 0) {
        hasReviewIssues = true;
        warnings.push(...notes);
      }

      const addNote = (note: string) => {
        notes.push(note);
        warnings.push(note);
        requiresConfirmation = true;
        hasReviewIssues = true;
      };

      if (ingredient.quantity === null && reviewMetadata.measurementRequired) {
        addNote(`Quantity is missing for ${ingredient.name}.`);
      }

      if (ingredient.unit === 'unknown' && reviewMetadata.measurementRequired) {
        addNote(`Unit is missing for ${ingredient.name}.`);
      } else if (
        reviewMetadata.measurementRequired &&
        ingredient.unit !== 'unknown' &&
        !this.unitConversion.isSupported(ingredient.unit)
      ) {
        addNote(
          `Unit ${ingredient.unit} is not supported for ${ingredient.name}.`,
        );
      }

      if (ingredient.confidence < 0.8) {
        addNote(`Low confidence extraction for ${ingredient.name}.`);
      }

      if (
        reviewMetadata.measurementRequired &&
        this.ingredientMatching.isGenericIngredientName(ingredient.name)
      ) {
        addNote(`Ingredient name "${ingredient.name}" is too generic.`);
      }

      return {
        ...ingredient,
        ...reviewMetadata,
        requiresConfirmation,
        notes,
      };
    });

    return {
      ingredients,
      warnings: Array.from(new Set(warnings)),
      hasReviewIssues,
    };
  }

  private toAnalysisIngredientRow(
    analysisSessionId: string,
    ingredient: ExtractedRecipeIngredient,
  ): NewNutritionAnalysisIngredient {
    return {
      analysisSessionId,
      rawText: ingredient.rawText,
      extractedName: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      confidence: ingredient.confidence,
      requiresConfirmation: ingredient.requiresConfirmation ?? false,
      notes: ingredient.notes ?? [],
    };
  }

  private async matchAndConvertIngredient(
    ingredient: ConfirmedIngredientDto,
    locale: string,
  ) {
    const category = ingredient.category ?? 'main';
    if (
      OPTIONAL_MEASUREMENT_CATEGORIES.has(category) &&
      ingredient.quantity == null
    ) {
      return {
        inputName: ingredient.name,
        quantity: ingredient.quantity ?? null,
        unit: ingredient.unit,
        quantityGram: null,
        matchedFoodId: null,
        matchedName: null,
        matchConfidence: 0,
        requiresConfirmation: false,
        excludedFromCalculation: true,
        candidates: [],
        warnings: [],
        food: null,
      };
    }

    const preferredState = this.ingredientMatching.resolvePreferredState({
      name: ingredient.name,
      preparation: ingredient.preparation ?? 'unknown',
    });
    const resolution = await this.resolveNutritionFoodMatch(
      ingredient,
      locale,
      preferredState,
    );
    const conversion = this.unitConversion.convertToGrams({
      ingredientName: ingredient.name,
      quantity: ingredient.quantity ?? null,
      unit: ingredient.unit,
    });

    if (resolution.match.bestCandidate && !resolution.requiresConfirmation) {
      await this.rememberResolvedIngredientAlias(
        ingredient,
        locale,
        resolution,
      );
    }

    const warnings = [...conversion.notes, ...resolution.warnings];

    if (!resolution.match.bestCandidate) {
      warnings.push(
        `No nutrition database match found for ${ingredient.name}.`,
      );
    } else if (resolution.requiresConfirmation) {
      warnings.push(
        `Nutrition match for ${ingredient.name} requires restaurant confirmation.`,
      );
    }

    return {
      inputName: ingredient.name,
      quantity: ingredient.quantity ?? null,
      unit: ingredient.unit,
      quantityGram: conversion.quantityGram,
      matchedFoodId: resolution.match.bestCandidate?.matchedFoodId ?? null,
      matchedName: resolution.match.bestCandidate?.matchedName ?? null,
      matchConfidence: resolution.match.bestCandidate?.matchConfidence ?? 0,
      requiresConfirmation:
        resolution.requiresConfirmation || conversion.requiresConfirmation,
      excludedFromCalculation: false,
      candidates: resolution.match.candidates,
      warnings,
      food: resolution.matchedFood,
    };
  }

  private async resolveNutritionFoodMatch(
    ingredient: ConfirmedIngredientDto,
    locale: string,
    preferredState: NutritionFoodSearchResult['state'] | null,
  ): Promise<NutritionFoodMatchResolution> {
    if (ingredient.matchedNutritionFoodId) {
      return this.resolveRestaurantConfirmedFood(
        ingredient,
        locale,
        ingredient.matchedNutritionFoodId,
      );
    }

    const directFoods = await this.repo.searchNutritionFoodsForIngredient({
      name: ingredient.name,
      locale,
      preferredState,
    });
    let bestResolution = this.buildMatchResolution({
      foods: directFoods,
      match: this.ingredientMatching.matchIngredient(
        {
          name: ingredient.name,
          preparation: ingredient.preparation ?? 'unknown',
        },
        directFoods,
      ),
      matchSource: 'localized',
      canonicalEnglishName: null,
      canonicalConfidence: null,
    });

    if (
      bestResolution.match.bestCandidate &&
      !bestResolution.requiresConfirmation
    ) {
      return bestResolution;
    }

    const canonicalization = await this.ingredientCanonicalizer.canonicalize({
      name: ingredient.name,
      locale,
      canonicalNameEn: ingredient.canonicalNameEn,
      canonicalNameConfidence: ingredient.canonicalNameConfidence,
    });
    if (!canonicalization) return bestResolution;

    const canonicalResolution = await this.resolveCanonicalNutritionFoodMatch(
      ingredient,
      locale,
      preferredState,
      canonicalization,
    );
    if (this.shouldUseFallbackResolution(bestResolution, canonicalResolution)) {
      bestResolution = canonicalResolution;
    }

    return bestResolution;
  }

  private async resolveRestaurantConfirmedFood(
    ingredient: ConfirmedIngredientDto,
    locale: string,
    nutritionFoodId: string,
  ): Promise<NutritionFoodMatchResolution> {
    const food = await this.repo.findNutritionFoodById(nutritionFoodId, locale);
    if (!food) {
      return this.emptyMatchResolution({
        matchSource: 'restaurant-confirmed',
        warnings: [
          `Selected nutrition food was not found for ${ingredient.name}.`,
        ],
      });
    }

    const match = this.ingredientMatching.matchIngredient(
      {
        name: ingredient.canonicalNameEn ?? food.nameEn,
        preparation: ingredient.preparation ?? 'unknown',
      },
      [food],
    );

    return this.buildMatchResolution({
      foods: [food],
      match,
      matchSource: 'restaurant-confirmed',
      canonicalEnglishName: ingredient.canonicalNameEn ?? food.nameEn,
      canonicalConfidence: 1,
      forceConfirmed: true,
    });
  }

  private async resolveCanonicalNutritionFoodMatch(
    ingredient: ConfirmedIngredientDto,
    locale: string,
    preferredState: NutritionFoodSearchResult['state'] | null,
    canonicalization: IngredientCanonicalizationResult,
  ): Promise<NutritionFoodMatchResolution> {
    if (canonicalization.nutritionFoodId) {
      const cachedFood = await this.repo.findNutritionFoodById(
        canonicalization.nutritionFoodId,
        locale,
      );
      if (cachedFood) {
        return this.buildCanonicalMatchResolution(
          ingredient,
          canonicalization,
          [cachedFood],
        );
      }
    }

    const englishFoods = await this.repo.searchNutritionFoodsForIngredient({
      name: canonicalization.englishName,
      locale: 'en',
      preferredState,
    });

    return this.buildCanonicalMatchResolution(
      ingredient,
      canonicalization,
      englishFoods,
    );
  }

  private buildCanonicalMatchResolution(
    ingredient: ConfirmedIngredientDto,
    canonicalization: IngredientCanonicalizationResult,
    foods: NutritionFoodSearchResult[],
  ): NutritionFoodMatchResolution {
    return this.buildMatchResolution({
      foods,
      match: this.ingredientMatching.matchIngredient(
        {
          name: canonicalization.englishName,
          preparation: ingredient.preparation ?? 'unknown',
        },
        foods,
      ),
      matchSource:
        canonicalization.source === 'cache'
          ? 'canonical-cache'
          : canonicalization.source === 'input'
            ? 'canonical-input'
            : 'canonical-provided',
      canonicalEnglishName: canonicalization.englishName,
      canonicalConfidence: canonicalization.confidence,
    });
  }

  private buildMatchResolution(input: {
    foods: NutritionFoodSearchResult[];
    match: IngredientMatchResult;
    matchSource: NutritionFoodMatchResolution['matchSource'];
    canonicalEnglishName: string | null;
    canonicalConfidence: number | null;
    forceConfirmed?: boolean;
  }): NutritionFoodMatchResolution {
    const matchedFood =
      input.match.bestCandidate === null
        ? null
        : (input.foods.find(
            (food) => food.id === input.match.bestCandidate?.matchedFoodId,
          ) ?? null);
    const canonicalRequiresConfirmation =
      input.matchSource === 'canonical-provided' &&
      (input.canonicalConfidence ?? 0) < CANONICAL_NAME_CONFIRMATION_THRESHOLD;

    return {
      foods: input.foods,
      match: input.match,
      matchedFood,
      requiresConfirmation:
        input.forceConfirmed === true
          ? false
          : input.match.requiresConfirmation || canonicalRequiresConfirmation,
      warnings: [],
      canonicalEnglishName: input.canonicalEnglishName,
      canonicalConfidence: input.canonicalConfidence,
      matchSource: input.matchSource,
    };
  }

  private emptyMatchResolution(input: {
    matchSource: NutritionFoodMatchResolution['matchSource'];
    warnings: string[];
  }): NutritionFoodMatchResolution {
    return {
      foods: [],
      match: {
        bestCandidate: null,
        candidates: [],
        requiresConfirmation: true,
      },
      matchedFood: null,
      requiresConfirmation: true,
      warnings: input.warnings,
      canonicalEnglishName: null,
      canonicalConfidence: null,
      matchSource: input.matchSource,
    };
  }

  private shouldUseFallbackResolution(
    current: NutritionFoodMatchResolution,
    fallback: NutritionFoodMatchResolution,
  ): boolean {
    if (!fallback.match.bestCandidate) return false;
    if (!current.match.bestCandidate) return true;
    if (current.requiresConfirmation && !fallback.requiresConfirmation) {
      return true;
    }

    return (
      fallback.match.bestCandidate.matchConfidence >
      current.match.bestCandidate.matchConfidence + 0.05
    );
  }

  private async rememberResolvedIngredientAlias(
    ingredient: ConfirmedIngredientDto,
    locale: string,
    resolution: NutritionFoodMatchResolution,
  ): Promise<void> {
    const bestCandidate = resolution.match.bestCandidate;
    if (!bestCandidate || !resolution.matchedFood) return;

    await this.ingredientCanonicalizer.remember({
      name: ingredient.name,
      locale,
      englishName:
        resolution.canonicalEnglishName ?? resolution.matchedFood.nameEn,
      nutritionFoodId: bestCandidate.matchedFoodId,
      confidence: Math.min(
        bestCandidate.matchConfidence,
        resolution.canonicalConfidence ?? bestCandidate.matchConfidence,
      ),
      createdBy:
        resolution.matchSource === 'restaurant-confirmed'
          ? 'RESTAURANT_CONFIRMED'
          : resolution.matchSource === 'canonical-provided'
            ? 'AI_CANONICALIZED'
            : 'AUTO_CONFIDENT',
    });
  }
}
