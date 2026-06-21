import type { UnitConversionService } from '../matching/unit-conversion.service';
import type { IngredientMatchingService } from '../matching/ingredient-matching.service';
import type {
  ExtractedRecipe,
  ExtractedRecipeIngredient,
  IngredientCategory,
} from '../types/nutrition.types';

const NO_PREPARATION_CATEGORIES: ReadonlySet<IngredientCategory> = new Set([
  'seasoning',
  'sauce',
  'garnish',
  'herb_side',
]);

const OPTIONAL_MEASUREMENT_CATEGORIES: ReadonlySet<IngredientCategory> =
  new Set(['seasoning', 'sauce', 'garnish', 'herb_side']);

export interface ReviewIngredientMetadata {
  measurementRequired: boolean;
  preparationApplicable: boolean;
}

export type ReviewedRecipeIngredient = ExtractedRecipeIngredient &
  ReviewIngredientMetadata;

export interface RecipeReviewResult {
  ingredients: ReviewedRecipeIngredient[];
  warnings: string[];
  hasReviewIssues: boolean;
}

interface IngredientReviewResult {
  ingredient: ReviewedRecipeIngredient;
  warnings: string[];
  hasReviewIssues: boolean;
}

interface RecipeReviewDependencies {
  unitConversion: Pick<UnitConversionService, 'isSupported'>;
  ingredientMatching: Pick<
    IngredientMatchingService,
    'isGenericIngredientName'
  >;
}

export const hasPositiveQuantity = (quantity: number | null | undefined) =>
  typeof quantity === 'number' && quantity > 0;

export const isOptionalMeasurementCategory = (
  category: IngredientCategory,
): boolean => OPTIONAL_MEASUREMENT_CATEGORIES.has(category);

export function getReviewIngredientMetadata(
  ingredient: Pick<ExtractedRecipeIngredient, 'category' | 'quantity'>,
): ReviewIngredientMetadata {
  const category = ingredient.category ?? 'main';
  const preparationApplicable = !NO_PREPARATION_CATEGORIES.has(category);
  const measurementRequired =
    !OPTIONAL_MEASUREMENT_CATEGORIES.has(category) ||
    hasPositiveQuantity(ingredient.quantity);

  return {
    measurementRequired,
    preparationApplicable,
  };
}

export function applyRecipeReviewRules(
  recipe: ExtractedRecipe,
  dependencies: RecipeReviewDependencies,
): RecipeReviewResult {
  const servingWarnings =
    recipe.servings === null
      ? ['Servings are missing. Please enter the number of servings.']
      : [];
  const ingredientReviews = recipe.ingredients.map((ingredient) =>
    applyIngredientReviewRules(ingredient, dependencies),
  );

  return {
    ingredients: ingredientReviews.map((review) => review.ingredient),
    warnings: Array.from(
      new Set([
        ...recipe.warnings,
        ...servingWarnings,
        ...ingredientReviews.flatMap((review) => review.warnings),
      ]),
    ),
    hasReviewIssues:
      recipe.warnings.length > 0 ||
      servingWarnings.length > 0 ||
      ingredientReviews.some((review) => review.hasReviewIssues),
  };
}

function applyIngredientReviewRules(
  ingredient: ExtractedRecipeIngredient,
  dependencies: RecipeReviewDependencies,
): IngredientReviewResult {
  const metadata = getReviewIngredientMetadata(ingredient);
  const notes = [...(ingredient.notes ?? [])];
  const warnings = [...notes];
  let requiresConfirmation = ingredient.requiresConfirmation ?? false;

  const addNote = (note: string) => {
    notes.push(note);
    warnings.push(note);
    requiresConfirmation = true;
  };

  if (ingredient.quantity === null && metadata.measurementRequired) {
    addNote(`Quantity is missing for ${ingredient.name}.`);
  }

  if (ingredient.unit === 'unknown' && metadata.measurementRequired) {
    addNote(`Unit is missing for ${ingredient.name}.`);
  } else if (
    metadata.measurementRequired &&
    ingredient.unit !== 'unknown' &&
    !dependencies.unitConversion.isSupported(ingredient.unit)
  ) {
    addNote(`Unit ${ingredient.unit} is not supported for ${ingredient.name}.`);
  }

  if (ingredient.confidence < 0.8) {
    addNote(`Low confidence extraction for ${ingredient.name}.`);
  }

  if (
    metadata.measurementRequired &&
    dependencies.ingredientMatching.isGenericIngredientName(ingredient.name)
  ) {
    addNote(`Ingredient name "${ingredient.name}" is too generic.`);
  }

  return {
    ingredient: {
      ...ingredient,
      ...metadata,
      requiresConfirmation,
      notes,
    },
    warnings,
    hasReviewIssues: requiresConfirmation || warnings.length > 0,
  };
}
