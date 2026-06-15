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
import { NutritionRepository } from './repositories/nutrition.repository';
import { UnitConversionService } from './matching/unit-conversion.service';
import { IngredientMatchingService } from './matching/ingredient-matching.service';
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

@Injectable()
export class NutritionService {
  constructor(
    private readonly menuService: MenuService,
    private readonly restaurantService: RestaurantService,
    private readonly aiExtraction: AiRecipeExtractionService,
    private readonly repo: NutritionRepository,
    private readonly unitConversion: UnitConversionService,
    private readonly ingredientMatching: IngredientMatchingService,
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

    const matchedIngredients = await Promise.all(
      dto.ingredients.map((ingredient) =>
        this.matchAndConvertIngredient(ingredient),
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
    },
  ) {
    const metadata = this.getReviewIngredientMetadata(ingredient);

    return {
      rawText: ingredient.rawText ?? null,
      name: ingredient.name,
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

  private async matchAndConvertIngredient(ingredient: ConfirmedIngredientDto) {
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
    const foods = await this.repo.searchNutritionFoodsForIngredient({
      name: ingredient.name,
      preferredState,
    });
    const match = this.ingredientMatching.matchIngredient(
      {
        name: ingredient.name,
        preparation: ingredient.preparation ?? 'unknown',
      },
      foods,
    );
    const conversion = this.unitConversion.convertToGrams({
      ingredientName: ingredient.name,
      quantity: ingredient.quantity ?? null,
      unit: ingredient.unit,
    });

    const matchedFood =
      match.bestCandidate === null
        ? null
        : (foods.find(
            (food) => food.id === match.bestCandidate?.matchedFoodId,
          ) ?? null);
    const warnings = [...conversion.notes];

    if (!match.bestCandidate) {
      warnings.push(
        `No nutrition database match found for ${ingredient.name}.`,
      );
    } else if (match.requiresConfirmation) {
      warnings.push(
        `Nutrition match for ${ingredient.name} requires restaurant confirmation.`,
      );
    }

    return {
      inputName: ingredient.name,
      quantity: ingredient.quantity ?? null,
      unit: ingredient.unit,
      quantityGram: conversion.quantityGram,
      matchedFoodId: match.bestCandidate?.matchedFoodId ?? null,
      matchedName: match.bestCandidate?.matchedName ?? null,
      matchConfidence: match.bestCandidate?.matchConfidence ?? 0,
      requiresConfirmation:
        match.requiresConfirmation || conversion.requiresConfirmation,
      excludedFromCalculation: false,
      candidates: match.candidates,
      warnings,
      food: matchedFood,
    };
  }
}
