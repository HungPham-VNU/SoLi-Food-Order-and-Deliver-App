import type { CalculateNutritionDto } from './dto/calculate-nutrition.dto';
import type { SaveMenuItemNutritionDto } from './dto/save-menu-item-nutrition.dto';
import type {
  NewNutritionAnalysisIngredient,
  NutritionAnalysisIngredient,
  MenuItemNutrition,
} from './domain/nutrition.schema';
import {
  getReviewIngredientMetadata,
  type ReviewIngredientMetadata,
} from './review/nutrition-review.policy';
import {
  INGREDIENT_CATEGORIES,
  NUTRITION_DISCLAIMER,
  NUTRITION_UNITS,
  PREPARATION_STATES,
  type ExtractedRecipe,
  type ExtractedRecipeIngredient,
  type IngredientCategory,
  type NutritionUnit,
  type PreparationState,
} from './types/nutrition.types';

interface CalculatedIngredientRowInput {
  inputName: string;
  quantity: number | null;
  unit: NutritionUnit;
  quantityGram: number | null;
  matchedFoodId: string | null;
  matchConfidence: number;
  requiresConfirmation: boolean;
  warnings: string[];
}

type ReviewIngredientResponseInput = Omit<
  ExtractedRecipeIngredient,
  'rawText'
> & {
  rawText?: string | null;
  canonicalNameEn?: string | null;
  canonicalNameConfidence?: number | null;
};

export function toAnalysisIngredientRow(
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

export function toCalculatedAnalysisIngredientRow(
  analysisSessionId: string,
  ingredient: CalculatedIngredientRowInput,
): NewNutritionAnalysisIngredient {
  return {
    analysisSessionId,
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
  };
}

export function toSaveMenuItemNutritionValues(
  menuItemId: string,
  dto: SaveMenuItemNutritionDto,
) {
  return {
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
  };
}

export function toSavedAnalysisIngredientRows(
  analysisSessionId: string,
  dto: SaveMenuItemNutritionDto,
): NewNutritionAnalysisIngredient[] {
  return dto.ingredients.map((ingredient) => ({
    analysisSessionId,
    rawText: null,
    extractedName: ingredient.name,
    correctedName: ingredient.name,
    quantity: ingredient.quantityGram,
    unit: 'g',
    quantityGram: ingredient.quantityGram,
    matchedNutritionFoodId: ingredient.matchedFoodId ?? null,
    confidence: 1,
    requiresConfirmation: false,
    notes: [],
  }));
}

export function toMenuItemNutritionResponse(nutrition: MenuItemNutrition) {
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

export function buildConfirmedRecipe(
  aiExtractedJson: unknown,
  dto: CalculateNutritionDto,
): ExtractedRecipe {
  const existingRecipe = parseExtractedRecipe(aiExtractedJson);
  const existingIngredientsByName = indexIngredientsByName(
    existingRecipe?.ingredients ?? [],
  );

  return {
    recipeName: existingRecipe?.recipeName ?? null,
    servings: dto.servings,
    ingredients: dto.ingredients.map((ingredient) => {
      const existingIngredient = existingIngredientsByName.get(
        normalizeIngredientName(ingredient.name),
      );

      const confirmedIngredient = {
        rawText: existingIngredient?.rawText ?? ingredient.name,
        name: ingredient.name,
        canonicalNameEn:
          ingredient.canonicalNameEn ??
          existingIngredient?.canonicalNameEn ??
          null,
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
        ...getReviewIngredientMetadata(confirmedIngredient),
      };
    }),
    warnings: existingRecipe?.warnings ?? [],
  };
}

export function toReviewIngredients(
  rows: NutritionAnalysisIngredient[],
  extractedRecipe: ExtractedRecipe | null,
) {
  if (rows.length === 0) {
    return (
      extractedRecipe?.ingredients.map((ingredient) =>
        toReviewIngredientResponse(ingredient),
      ) ?? []
    );
  }

  const extractedIngredients = extractedRecipe?.ingredients ?? [];
  const extractedIngredientsByName =
    indexIngredientsByName(extractedIngredients);

  return rows.map((row, index) => {
    const name = row.correctedName ?? row.extractedName;
    let extractedIngredient = extractedIngredientsByName.get(
      normalizeIngredientName(name),
    );
    if (!extractedIngredient) {
      const byIndex = extractedIngredients[index];
      if (
        byIndex &&
        normalizeIngredientName(byIndex.name) === normalizeIngredientName(name)
      ) {
        extractedIngredient = byIndex;
      } else if (
        byIndex &&
        !extractedIngredientsByName.has(normalizeIngredientName(byIndex.name))
      ) {
        // Fallback to index if the name at this index hasn't been used yet
        extractedIngredient = byIndex;
      }
    }

    return toReviewIngredientResponse({
      rawText: row.rawText ?? extractedIngredient?.rawText ?? null,
      name,
      canonicalNameEn: extractedIngredient?.canonicalNameEn ?? null,
      canonicalNameConfidence:
        extractedIngredient?.canonicalNameConfidence ?? null,
      quantity: row.quantity,
      unit: toNutritionUnit(row.unit),
      preparation: toPreparationState(
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

export function toReviewIngredientResponse(
  ingredient: ReviewIngredientResponseInput,
) {
  const metadata: ReviewIngredientMetadata =
    getReviewIngredientMetadata(ingredient);

  return {
    rawText: ingredient.rawText ?? null,
    name: ingredient.name,
    canonicalNameEn: ingredient.canonicalNameEn ?? null,
    canonicalNameConfidence: ingredient.canonicalNameConfidence ?? null,
    quantity: metadata.measurementRequired ? ingredient.quantity : 0,
    unit: ingredient.unit,
    preparation: metadata.preparationApplicable ? ingredient.preparation : null,
    confidence: ingredient.confidence,
    requiresConfirmation: ingredient.requiresConfirmation ?? false,
    category: ingredient.category ?? 'main',
    measurementRequired: metadata.measurementRequired,
    preparationApplicable: metadata.preparationApplicable,
    notes: ingredient.notes ?? [],
  };
}

export function parseExtractedRecipe(value: unknown): ExtractedRecipe | null {
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
          typeof ingredient.quantity === 'number' ? ingredient.quantity : null,
        unit: toNutritionUnit(ingredient.unit),
        preparation: toPreparationState(ingredient.preparation),
        category: toIngredientCategory(ingredient.category),
        confidence:
          typeof ingredient.confidence === 'number' ? ingredient.confidence : 1,
        requiresConfirmation: ingredient.requiresConfirmation ?? false,
        notes: Array.isArray(ingredient.notes) ? ingredient.notes : [],
      }))
      .filter((ingredient) => ingredient.name.trim().length > 0),
    warnings: Array.isArray(recipe.warnings) ? recipe.warnings : [],
  };
}

function indexIngredientsByName(ingredients: ExtractedRecipeIngredient[]) {
  return new Map(
    ingredients.map((ingredient) => [
      normalizeIngredientName(ingredient.name),
      ingredient,
    ]),
  );
}

function toIngredientCategory(category: unknown): IngredientCategory {
  return typeof category === 'string' &&
    (INGREDIENT_CATEGORIES as readonly string[]).includes(category)
    ? (category as IngredientCategory)
    : 'main';
}

function normalizeIngredientName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .replace(/\s+/g, ' ');
}

function toNutritionUnit(unit: unknown): NutritionUnit {
  return typeof unit === 'string' &&
    (NUTRITION_UNITS as readonly string[]).includes(unit)
    ? (unit as NutritionUnit)
    : 'unknown';
}

function toPreparationState(preparation: unknown): PreparationState {
  return typeof preparation === 'string' &&
    (PREPARATION_STATES as readonly string[]).includes(preparation)
    ? (preparation as PreparationState)
    : 'unknown';
}
