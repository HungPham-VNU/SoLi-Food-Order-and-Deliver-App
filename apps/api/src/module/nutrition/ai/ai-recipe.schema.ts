import { z } from 'zod';
import { NUTRITION_UNITS, PREPARATION_STATES } from '../types/nutrition.types';

export const aiRecipeUnitSchema = z.enum(NUTRITION_UNITS);
export const aiRecipePreparationSchema = z.enum(PREPARATION_STATES);

export const extractedRecipeIngredientSchema = z.object({
  rawText: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().positive().nullable(),
  unit: aiRecipeUnitSchema.nullable().default('unknown'),
  preparation: aiRecipePreparationSchema.nullable().default('unknown'),
  confidence: z.number().min(0).max(1),
});

export const extractedRecipeSchema = z.object({
  recipeName: z.string().min(1).nullable(),
  servings: z.number().positive().nullable(),
  ingredients: z.array(extractedRecipeIngredientSchema).default([]),
  warnings: z.array(z.string()).default([]),
});

export type AiExtractedRecipe = z.infer<typeof extractedRecipeSchema>;
