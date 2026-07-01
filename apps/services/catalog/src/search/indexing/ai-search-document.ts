import { createHash } from 'node:crypto';

const SYNONYMS: Record<string, string[]> = {
  banh: ['bread', 'sandwich'],
  bo: ['beef'],
  bun: ['noodle'],
  ca: ['fish'],
  chay: ['vegetarian', 'vegan'],
  com: ['rice'],
  ga: ['chicken'],
  mi: ['noodle', 'sandwich'],
  pho: ['noodle', 'soup'],
  rau: ['vegetable'],
  thit: ['meat'],
  tom: ['shrimp', 'seafood'],
};

export interface SearchDocumentInput {
  primaryName: string;
  itemKind?: 'food' | 'beverage' | 'mixed' | null;
  description?: string | null;
  tags?: string[] | null;
  categoryName?: string | null;
  cuisineType?: string | null;
  restaurantName?: string | null;
  ingredients?: string[] | null;
  nutrition?: {
    calories?: number | null;
    protein?: number | null;
    carbs?: number | null;
    fat?: number | null;
    verifiedByRestaurant?: boolean | null;
  } | null;
}

export interface SearchDocumentResult {
  document: string;
  contentHash: string;
}

export function buildSearchDocument(
  input: SearchDocumentInput,
): SearchDocumentResult {
  const parts = [
    input.primaryName,
    input.itemKind ? `item type ${input.itemKind}` : null,
    input.description,
    input.restaurantName,
    input.cuisineType,
    input.categoryName,
    ...(input.tags ?? []),
    buildIngredientText(input.ingredients, input.nutrition),
    buildNutritionText(input.nutrition),
  ];
  const normalized = normalizeSearchText(parts.filter(Boolean).join(' '));
  const document = appendSynonyms(normalized);

  return {
    document,
    contentHash: createHash('sha256').update(document).digest('hex'),
  };
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function appendSynonyms(document: string): string {
  if (!document) return document;

  const tokens = new Set(document.split(/\s+/).filter(Boolean));
  for (const token of Array.from(tokens)) {
    for (const synonym of SYNONYMS[token] ?? []) {
      tokens.add(synonym);
    }
  }

  return Array.from(tokens).join(' ');
}

function buildIngredientText(
  ingredients: SearchDocumentInput['ingredients'],
  nutrition: SearchDocumentInput['nutrition'],
): string | null {
  if (!nutrition?.verifiedByRestaurant || !ingredients?.length) return null;

  const names = Array.from(
    new Set(
      ingredients
        .map((ingredient) => ingredient.trim())
        .filter((ingredient) => ingredient.length > 0),
    ),
  );

  return names.length > 0 ? `ingredients ${names.join(' ')}` : null;
}

function buildNutritionText(
  nutrition: SearchDocumentInput['nutrition'],
): string | null {
  if (!nutrition?.verifiedByRestaurant) return null;

  const parts: string[] = [];
  if (nutrition.protein !== null && nutrition.protein !== undefined) {
    parts.push(`${Math.round(nutrition.protein)}g protein high protein`);
  }
  if (nutrition.calories !== null && nutrition.calories !== undefined) {
    parts.push(`${Math.round(nutrition.calories)} calories`);
  }
  if (nutrition.carbs !== null && nutrition.carbs !== undefined) {
    parts.push(`${Math.round(nutrition.carbs)}g carbs`);
  }
  if (nutrition.fat !== null && nutrition.fat !== undefined) {
    parts.push(`${Math.round(nutrition.fat)}g fat`);
  }

  return parts.length > 0 ? parts.join(' ') : null;
}
