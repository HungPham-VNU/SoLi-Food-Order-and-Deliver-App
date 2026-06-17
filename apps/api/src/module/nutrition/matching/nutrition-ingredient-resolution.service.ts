import { Injectable } from '@nestjs/common';
import type { ConfirmedIngredientDto } from '../dto/calculate-nutrition.dto';
import {
  NutritionRepository,
  type NutritionFoodSearchResult,
} from '../repositories/nutrition.repository';
import type { NutritionUnit } from '../types/nutrition.types';
import {
  hasPositiveQuantity,
  isOptionalMeasurementCategory,
} from '../review/nutrition-review.policy';
import {
  UnitConversionService,
  type UnitConversionResult,
} from './unit-conversion.service';
import {
  IngredientMatchingService,
  type IngredientMatchResult,
} from './ingredient-matching.service';
import {
  IngredientCanonicalizerService,
  type IngredientCanonicalizationResult,
} from './ingredient-canonicalizer.service';

const CANONICAL_NAME_CONFIRMATION_THRESHOLD = 0.8;

interface NutritionFoodMatchResolution {
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

export interface MatchedNutritionIngredient {
  inputName: string;
  quantity: number | null;
  unit: NutritionUnit;
  quantityGram: number | null;
  matchedFoodId: string | null;
  matchedName: string | null;
  matchConfidence: number;
  requiresConfirmation: boolean;
  excludedFromCalculation: boolean;
  candidates: IngredientMatchResult['candidates'];
  warnings: string[];
  food: NutritionFoodSearchResult | null;
}

@Injectable()
export class NutritionIngredientResolutionService {
  constructor(
    private readonly repo: NutritionRepository,
    private readonly unitConversion: UnitConversionService,
    private readonly ingredientMatching: IngredientMatchingService,
    private readonly ingredientCanonicalizer: IngredientCanonicalizerService,
  ) {}

  async resolveAll(
    ingredients: ConfirmedIngredientDto[],
    locale: string,
  ): Promise<MatchedNutritionIngredient[]> {
    return Promise.all(
      ingredients.map((ingredient) =>
        this.matchAndConvertIngredient(ingredient, locale),
      ),
    );
  }

  private async matchAndConvertIngredient(
    ingredient: ConfirmedIngredientDto,
    locale: string,
  ): Promise<MatchedNutritionIngredient> {
    if (this.shouldSkipOptionalIngredient(ingredient)) {
      return this.toSkippedMatchedIngredient(ingredient);
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
      warnings: this.buildMatchedIngredientWarnings(
        ingredient,
        resolution,
        conversion,
      ),
      food: resolution.matchedFood,
    };
  }

  private shouldSkipOptionalIngredient(
    ingredient: ConfirmedIngredientDto,
  ): boolean {
    const category = ingredient.category ?? 'main';
    return (
      isOptionalMeasurementCategory(category) &&
      !hasPositiveQuantity(ingredient.quantity)
    );
  }

  private toSkippedMatchedIngredient(
    ingredient: ConfirmedIngredientDto,
  ): MatchedNutritionIngredient {
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

  private buildMatchedIngredientWarnings(
    ingredient: ConfirmedIngredientDto,
    resolution: NutritionFoodMatchResolution,
    conversion: UnitConversionResult,
  ): string[] {
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

    return warnings;
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
