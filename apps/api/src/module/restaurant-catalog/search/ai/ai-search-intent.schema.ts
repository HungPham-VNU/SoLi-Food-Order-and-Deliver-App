import { z } from 'zod';

export const aiSearchIntentSchema = z
  .object({
    rewrittenQuery: z.string().min(1).max(300),
    language: z.enum(['en', 'vi', 'unknown']),
    foodTerms: z.array(z.string().min(1).max(80)).max(20),
    cuisineTerms: z.array(z.string().min(1).max(80)).max(10),
    dietaryTags: z.array(z.string().min(1).max(80)).max(20),
    excludedTerms: z.array(z.string().min(1).max(80)).max(20),
    nutrition: z
      .object({
        highProtein: z.boolean().optional(),
        proteinMinG: z.number().min(0).max(300).optional(),
        caloriesMax: z.number().min(0).max(5000).optional(),
        fatMaxG: z.number().min(0).max(500).optional(),
        carbsMaxG: z.number().min(0).max(1000).optional(),
      })
      .strict(),
    price: z
      .object({
        maxPriceVnd: z.number().int().min(0).max(10_000_000).optional(),
        minPriceVnd: z.number().int().min(0).max(10_000_000).optional(),
        budgetIntent: z.boolean().optional(),
      })
      .strict(),
    rating: z
      .object({
        minAverageRating: z.number().min(0).max(5).optional(),
        minReviewCount: z.number().int().min(0).max(100_000).optional(),
      })
      .strict(),
    geo: z
      .object({
        nearbyIntent: z.boolean().optional(),
        radiusKm: z.number().min(0.1).max(100).optional(),
      })
      .strict(),
    sort: z.enum([
      'relevance',
      'distance',
      'rating',
      'price_asc',
      'protein_desc',
    ]),
    confidence: z.number().min(0).max(1),
    needsFallback: z.boolean(),
    foodNameOnly: z.boolean().optional().default(false),
  })
  .strict();

export type AiSearchIntentSchema = z.infer<typeof aiSearchIntentSchema>;
