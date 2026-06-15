export const NUTRITION_DISCLAIMER =
  'Nutrition values are estimates based on the provided recipe and ingredient database. Actual values may vary depending on ingredients, portion size, and cooking method.';

export const NUTRITION_UNITS = [
  'g',
  'kg',
  'ml',
  'l',
  'tbsp',
  'tsp',
  'piece',
  'cup',
  'bowl',
  'bunch',
  'pinch',
  'unknown',
] as const;

export type NutritionUnit = (typeof NUTRITION_UNITS)[number];

export const SUPPORTED_CONVERSION_UNITS = [
  'g',
  'kg',
  'ml',
  'l',
  'tbsp',
  'tsp',
  'piece',
] as const;

export type SupportedConversionUnit =
  (typeof SUPPORTED_CONVERSION_UNITS)[number];

export const PREPARATION_STATES = [
  'raw',
  'cooked',
  'fried',
  'boiled',
  'grilled',
  'steamed',
  'unknown',
] as const;

export type PreparationState = (typeof PREPARATION_STATES)[number];

export const INGREDIENT_CATEGORIES = [
  'main',
  'seasoning',
  'sauce',
  'garnish',
  'herb_side',
] as const;

export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

export const NUTRITION_ANALYSIS_STATUSES = [
  'ANALYZED',
  'NEEDS_REVIEW',
  'CALCULATED',
  'SAVED',
  'FAILED',
] as const;

export type NutritionAnalysisStatus =
  (typeof NUTRITION_ANALYSIS_STATUSES)[number];

export interface ExtractedRecipeIngredient {
  rawText: string;
  name: string;
  canonicalNameEn?: string | null;
  canonicalNameConfidence?: number | null;
  quantity: number | null;
  unit: NutritionUnit;
  preparation: PreparationState;
  category: IngredientCategory;
  confidence: number;
  requiresConfirmation?: boolean;
  notes?: string[];
}

export interface ExtractedRecipe {
  recipeName: string | null;
  servings: number | null;
  ingredients: ExtractedRecipeIngredient[];
  warnings: string[];
}

export interface NutritionAmount {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
}

export interface NutritionTotals {
  total: NutritionAmount;
  perServing: NutritionAmount;
}
