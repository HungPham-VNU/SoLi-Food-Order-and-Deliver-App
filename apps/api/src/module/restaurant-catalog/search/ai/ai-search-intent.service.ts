import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OllamaAiProvider,
  type AiChatMessage,
} from '@/lib/ai/ollama-ai.provider';
import {
  AI_SEARCH_DEFAULT_BUDGET_MAX_VND,
  AI_SEARCH_DEFAULT_HIGH_PROTEIN_MIN_G,
  AI_SEARCH_DEFAULT_HIGH_RATING_MIN,
  AI_SEARCH_DEFAULT_MIN_REVIEW_COUNT,
  AI_SEARCH_DEFAULT_RADIUS_KM,
  AI_SEARCH_MIN_CONFIDENCE,
  type AiSearchIntent,
  type AiSearchSort,
} from './ai-search.types';
import { aiSearchIntentSchema } from './ai-search-intent.schema';
import { AI_SEARCH_SYSTEM_PROMPT } from './ai-search-prompt';

interface ParseIntentOptions {
  radiusKm?: number;
}

const AI_SEARCH_TIMEOUT_MS = 8_000;

const AI_SEARCH_RESPONSE_SCHEMA_PROMPT = [
  'Return exactly one JSON object with camelCase keys and no Markdown.',
  'Shape:',
  '{',
  '  "rewrittenQuery": "string",',
  '  "language": "en|vi|unknown",',
  '  "foodTerms": ["string"],',
  '  "cuisineTerms": ["string"],',
  '  "dietaryTags": ["string"],',
  '  "excludedTerms": ["string"],',
  '  "nutrition": {',
  '    "highProtein": "boolean | omitted",',
  '    "proteinMinG": "number | omitted",',
  '    "caloriesMax": "number | omitted",',
  '    "fatMaxG": "number | omitted",',
  '    "carbsMaxG": "number | omitted"',
  '  },',
  '  "price": {',
  '    "maxPriceVnd": "integer | omitted",',
  '    "minPriceVnd": "integer | omitted",',
  '    "budgetIntent": "boolean | omitted"',
  '  },',
  '  "rating": {',
  '    "minAverageRating": "number | omitted",',
  '    "minReviewCount": "integer | omitted"',
  '  },',
  '  "geo": {',
  '    "nearbyIntent": "boolean | omitted",',
  '    "radiusKm": "number | omitted"',
  '  },',
  '  "sort": "relevance|distance|rating|price_asc|protein_desc",',
  '  "confidence": "number from 0 to 1",',
  '  "needsFallback": "boolean",',
  '  "foodNameOnly": "boolean; true only when the full query is just a dish or food name"',
  '}',
].join('\n');

const CUISINE_TERMS = new Set([
  'vietnamese',
  'korean',
  'japanese',
  'thai',
  'chinese',
  'indian',
  'western',
]);

const TAG_TERMS = new Set([
  'spicy',
  'vegetarian',
  'vegan',
  'halal',
  'chicken',
  'beef',
  'pork',
  'seafood',
  'grilled',
  'soup',
  'noodle',
  'rice',
  'sandwich',
  'banh',
  'mi',
  'pho',
  'bun',
  'com',
]);

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'ask',
  'best',
  'budget',
  'cheap',
  'close',
  'dinner',
  'dish',
  'dishes',
  'food',
  'foods',
  'for',
  'high',
  'higher',
  'highly',
  'in',
  'km',
  'lunch',
  'meal',
  'meals',
  'me',
  'near',
  'nearby',
  'nearest',
  'now',
  'open',
  'option',
  'options',
  'protein',
  'rated',
  'rating',
  'restaurant',
  'restaurants',
  'the',
  'to',
  'top',
  'under',
  'vnd',
  'with',
  'within',
]);

const GENERIC_FOOD_TERMS = new Set(['dish', 'food', 'meal', 'option']);

const FOOD_NAME_ONLY_TERMS = new Set([
  'banh',
  'beef',
  'bo',
  'boba',
  'bread',
  'bun',
  'burger',
  'ca',
  'cake',
  'cao',
  'cha',
  'chao',
  'chicken',
  'coffee',
  'com',
  'cuon',
  'curry',
  'dessert',
  'dumpling',
  'egg',
  'fish',
  'fried',
  'fry',
  'ga',
  'gio',
  'goi',
  'grilled',
  'heo',
  'hotpot',
  'hu',
  'hue',
  'kebab',
  'lau',
  'mi',
  'mien',
  'milk',
  'muc',
  'nem',
  'noodle',
  'oc',
  'pasta',
  'pho',
  'pizza',
  'pork',
  'ramen',
  'rice',
  'roast',
  'roasted',
  'roll',
  'salad',
  'sandwich',
  'seafood',
  'shrimp',
  'soup',
  'steak',
  'stir',
  'sushi',
  'taco',
  'tam',
  'tea',
  'thit',
  'tieu',
  'tofu',
  'tom',
  'vegetable',
  'vit',
  'xao',
  'xeo',
  'xoi',
]);

@Injectable()
export class AiSearchIntentService {
  private readonly logger = new Logger(AiSearchIntentService.name);

  constructor(
    @Optional() private readonly aiProvider?: OllamaAiProvider,
    @Optional() private readonly config?: ConfigService,
  ) {}

  parseIntent(query: string, options: ParseIntentOptions = {}): AiSearchIntent {
    const trimmed = query.trim().slice(0, 300);
    const normalized = normalizeText(trimmed);

    const highProtein = /\b(high protein|protein rich|protein|lean)\b/.test(
      normalized,
    );
    const budgetIntent =
      /\b(budget|cheap|affordable|inexpensive|gia re)\b/.test(normalized);
    const highlyRated =
      /\b(highly rated|best rated|top rated|rating|review|best)\b/.test(
        normalized,
      );
    const nearbyIntent =
      /\b(nearby|near me|near|close|nearest|gan day|gan toi)\b/.test(
        normalized,
      );

    const explicitPriceMax = extractExplicitPriceMax(normalized);
    const explicitProteinMin = extractExplicitProteinMin(normalized);
    const foodTerms = extractFoodTerms(normalized);
    const cuisineTerms = unique(
      foodTerms.filter((term) => CUISINE_TERMS.has(term)),
    );
    const dietaryTags = unique(foodTerms.filter((term) => TAG_TERMS.has(term)));
    const genericFoodIntent = isGenericFoodSearchQuery(normalized);
    const foodNameOnly = isFoodNameOnlySearchQuery(normalized);

    const hasPriceIntent = budgetIntent || explicitPriceMax !== undefined;
    const hasAnySignal =
      highProtein ||
      hasPriceIntent ||
      highlyRated ||
      nearbyIntent ||
      foodTerms.length > 0 ||
      genericFoodIntent;
    const sort = pickSort({
      highProtein,
      hasPriceIntent,
      highlyRated,
      nearbyIntent,
    });
    const confidence = hasAnySignal
      ? highProtein || hasPriceIntent || highlyRated || nearbyIntent
        ? 0.9
        : 0.72
      : 0.2;

    const rawIntent: AiSearchIntent = {
      rewrittenQuery: trimmed,
      language: detectLanguage(normalized),
      foodTerms,
      cuisineTerms,
      dietaryTags,
      excludedTerms: [],
      nutrition: {
        ...(highProtein
          ? {
              highProtein: true,
              proteinMinG:
                explicitProteinMin ?? AI_SEARCH_DEFAULT_HIGH_PROTEIN_MIN_G,
            }
          : {}),
      },
      price: {
        ...(hasPriceIntent
          ? {
              maxPriceVnd: explicitPriceMax ?? AI_SEARCH_DEFAULT_BUDGET_MAX_VND,
              budgetIntent,
            }
          : {}),
      },
      rating: {
        ...(highlyRated
          ? {
              minAverageRating: AI_SEARCH_DEFAULT_HIGH_RATING_MIN,
              minReviewCount: AI_SEARCH_DEFAULT_MIN_REVIEW_COUNT,
            }
          : {}),
      },
      geo: {
        ...(nearbyIntent
          ? {
              nearbyIntent: true,
              radiusKm: options.radiusKm ?? AI_SEARCH_DEFAULT_RADIUS_KM,
            }
          : {}),
      },
      sort,
      confidence,
      needsFallback: !hasAnySignal,
      foodNameOnly,
    };

    return aiSearchIntentSchema.parse(rawIntent);
  }

  async parseIntentWithProvider(
    query: string,
    options: ParseIntentOptions = {},
  ): Promise<AiSearchIntent> {
    if (!this.shouldUseAiProvider()) {
      return this.parseIntent(query, options);
    }

    try {
      const response = await this.aiProvider!.chat({
        messages: this.buildProviderMessages(query, options),
        model: this.resolveAiSearchModel(),
        timeoutMs: this.resolveAiSearchTimeoutMs(),
        temperature: 0,
      });

      return this.parseProviderIntent(response.content, query, options);
    } catch (error) {
      this.logger.warn(
        `AI search intent provider fell back to deterministic parsing: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return this.parseIntent(query, options);
    }
  }

  private shouldUseAiProvider(): boolean {
    return (
      readBooleanConfig(this.config, 'AI_SEARCH_ENABLED', false) &&
      Boolean(this.aiProvider?.isConfigured())
    );
  }

  private resolveAiSearchModel(): string | undefined {
    const model = this.config?.get<string>('AI_SEARCH_MODEL')?.trim();
    return model && model.length > 0 ? model : undefined;
  }

  private resolveAiSearchTimeoutMs(): number {
    return readNumberConfig(
      this.config,
      'AI_SEARCH_TIMEOUT_MS',
      AI_SEARCH_TIMEOUT_MS,
    );
  }

  private buildProviderMessages(
    query: string,
    options: ParseIntentOptions,
  ): AiChatMessage[] {
    return [
      {
        role: 'system',
        content: `${AI_SEARCH_SYSTEM_PROMPT}\n\n${AI_SEARCH_RESPONSE_SCHEMA_PROMPT}`,
      },
      {
        role: 'user',
        content: JSON.stringify({
          query: query.trim().slice(0, 300),
          radiusKm: options.radiusKm ?? AI_SEARCH_DEFAULT_RADIUS_KM,
        }),
      },
    ];
  }

  private parseProviderIntent(
    content: string,
    query: string,
    options: ParseIntentOptions,
  ): AiSearchIntent {
    return this.normalizeProviderIntent(
      parseJsonObjectContent(content),
      query,
      options,
    );
  }

  private normalizeProviderIntent(
    parsed: unknown,
    query: string,
    options: ParseIntentOptions,
  ): AiSearchIntent {
    const trimmed = query.trim().slice(0, 300);
    const source = asRecord(parsed);
    const nutrition = asRecord(source.nutrition);
    const price = asRecord(source.price);
    const rating = asRecord(source.rating);
    const geo = asRecord(source.geo);
    const highProtein = readOptionalBoolean(nutrition.highProtein);
    const budgetIntent = readOptionalBoolean(price.budgetIntent);
    const nearbyIntent = readOptionalBoolean(geo.nearbyIntent);
    const explicitSort = readSort(source.sort);
    const foodNameOnly =
      readOptionalBoolean(source.foodNameOnly) ??
      isFoodNameOnlySearchQuery(trimmed);

    const rawIntent: AiSearchIntent = {
      rewrittenQuery: readBoundedString(source.rewrittenQuery, trimmed, 300),
      language: readLanguage(
        source.language,
        detectLanguage(normalizeText(trimmed)),
      ),
      foodTerms: readTermArray(source.foodTerms, 20),
      cuisineTerms: readTermArray(source.cuisineTerms, 10),
      dietaryTags: readTermArray(source.dietaryTags, 20),
      excludedTerms: readTermArray(source.excludedTerms, 20),
      nutrition: {
        ...(highProtein !== undefined ? { highProtein } : {}),
        ...readOptionalNumberProperty(nutrition.proteinMinG, 'proteinMinG', {
          min: 0,
          max: 300,
        }),
        ...readOptionalNumberProperty(nutrition.caloriesMax, 'caloriesMax', {
          min: 0,
          max: 5000,
        }),
        ...readOptionalNumberProperty(nutrition.fatMaxG, 'fatMaxG', {
          min: 0,
          max: 500,
        }),
        ...readOptionalNumberProperty(nutrition.carbsMaxG, 'carbsMaxG', {
          min: 0,
          max: 1000,
        }),
      },
      price: {
        ...readOptionalIntegerProperty(price.maxPriceVnd, 'maxPriceVnd', {
          min: 0,
          max: 10_000_000,
        }),
        ...readOptionalIntegerProperty(price.minPriceVnd, 'minPriceVnd', {
          min: 0,
          max: 10_000_000,
        }),
        ...(budgetIntent !== undefined ? { budgetIntent } : {}),
      },
      rating: {
        ...readOptionalNumberProperty(
          rating.minAverageRating,
          'minAverageRating',
          {
            min: 0,
            max: 5,
          },
        ),
        ...readOptionalIntegerProperty(
          rating.minReviewCount,
          'minReviewCount',
          {
            min: 0,
            max: 100_000,
          },
        ),
      },
      geo: {
        ...(nearbyIntent !== undefined ? { nearbyIntent } : {}),
        ...readOptionalNumberProperty(geo.radiusKm, 'radiusKm', {
          min: 0.1,
          max: 100,
        }),
      },
      sort: explicitSort ?? 'relevance',
      confidence:
        readOptionalNumber(source.confidence, { min: 0, max: 1 }) ??
        AI_SEARCH_MIN_CONFIDENCE,
      needsFallback: readOptionalBoolean(source.needsFallback) ?? false,
      foodNameOnly,
    };

    if (
      rawIntent.nutrition.highProtein &&
      rawIntent.nutrition.proteinMinG === undefined
    ) {
      rawIntent.nutrition.proteinMinG = AI_SEARCH_DEFAULT_HIGH_PROTEIN_MIN_G;
    }

    if (
      rawIntent.price.budgetIntent &&
      rawIntent.price.maxPriceVnd === undefined
    ) {
      rawIntent.price.maxPriceVnd = AI_SEARCH_DEFAULT_BUDGET_MAX_VND;
    }

    if (rawIntent.geo.nearbyIntent && rawIntent.geo.radiusKm === undefined) {
      rawIntent.geo.radiusKm = options.radiusKm ?? AI_SEARCH_DEFAULT_RADIUS_KM;
    }

    if (!explicitSort) {
      rawIntent.sort = pickSort({
        highProtein: Boolean(rawIntent.nutrition.highProtein),
        hasPriceIntent:
          Boolean(rawIntent.price.budgetIntent) ||
          rawIntent.price.maxPriceVnd !== undefined,
        highlyRated: rawIntent.rating.minAverageRating !== undefined,
        nearbyIntent: Boolean(rawIntent.geo.nearbyIntent),
      });
    }

    const genericFoodIntent = isGenericFoodSearchQuery(trimmed);
    if (
      !hasIntentSignal(rawIntent) &&
      !genericFoodIntent &&
      !rawIntent.foodNameOnly
    ) {
      rawIntent.needsFallback = true;
      rawIntent.confidence = Math.min(rawIntent.confidence, 0.2);
    }
    if (genericFoodIntent) {
      rawIntent.foodNameOnly = false;
      rawIntent.needsFallback = false;
      rawIntent.confidence = Math.max(rawIntent.confidence, 0.72);
    }
    if (rawIntent.foodNameOnly) {
      rawIntent.needsFallback = false;
    }

    return aiSearchIntentSchema.parse(rawIntent);
  }
}

function readBooleanConfig(
  config: ConfigService | undefined,
  key: string,
  fallback: boolean,
): boolean {
  const value = config?.get<boolean | string>(key);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['1', 'true', 'yes'].includes(value.trim().toLowerCase());
  }

  return fallback;
}

function readNumberConfig(
  config: ConfigService | undefined,
  key: string,
  fallback: number,
): number {
  const value = Number(config?.get<number | string>(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function parseJsonObjectContent(content: string): unknown {
  try {
    let cleaned = content.trim();
    const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      cleaned = jsonMatch[1];
    } else {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleaned = cleaned.slice(firstBrace, lastBrace + 1);
      }
    }

    return JSON.parse(cleaned.trim());
  } catch {
    throw new Error('AI search provider returned invalid JSON content.');
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readBoundedString(
  value: unknown,
  fallback: string,
  maxLength: number,
): string {
  const source = typeof value === 'string' && value.trim() ? value : fallback;
  return source.trim().slice(0, maxLength);
}

function readLanguage(
  value: unknown,
  fallback: AiSearchIntent['language'],
): AiSearchIntent['language'] {
  return value === 'en' || value === 'vi' || value === 'unknown'
    ? value
    : fallback;
}

function readTermArray(value: unknown, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];

  return unique(
    value
      .filter((item): item is string => typeof item === 'string')
      .map(normalizeIntentTerm)
      .filter((term): term is string => Boolean(term)),
  ).slice(0, maxLength);
}

function normalizeIntentTerm(value: string): string | null {
  const normalized = normalizeText(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized.length > 0 ? singularize(normalized) : null;
}

function readOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes'].includes(normalized)) return true;
    if (['0', 'false', 'no'].includes(normalized)) return false;
  }

  return undefined;
}

function readOptionalNumber(
  value: unknown,
  bounds: { min: number; max: number },
): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;

  const numberValue = Number(value);
  if (
    !Number.isFinite(numberValue) ||
    numberValue < bounds.min ||
    numberValue > bounds.max
  ) {
    return undefined;
  }

  return numberValue;
}

function readOptionalNumberProperty<TKey extends string>(
  value: unknown,
  key: TKey,
  bounds: { min: number; max: number },
): Partial<Record<TKey, number>> {
  const numberValue = readOptionalNumber(value, bounds);
  return numberValue === undefined
    ? {}
    : ({ [key]: numberValue } as Partial<Record<TKey, number>>);
}

function readOptionalIntegerProperty<TKey extends string>(
  value: unknown,
  key: TKey,
  bounds: { min: number; max: number },
): Partial<Record<TKey, number>> {
  const numberValue = readOptionalNumber(value, bounds);
  return numberValue === undefined
    ? {}
    : ({ [key]: Math.round(numberValue) } as Partial<Record<TKey, number>>);
}

function readSort(value: unknown): AiSearchSort | undefined {
  return value === 'relevance' ||
    value === 'distance' ||
    value === 'rating' ||
    value === 'price_asc' ||
    value === 'protein_desc'
    ? value
    : undefined;
}

function hasIntentSignal(intent: AiSearchIntent): boolean {
  return (
    intent.foodTerms.length > 0 ||
    intent.dietaryTags.length > 0 ||
    intent.cuisineTerms.length > 0 ||
    intent.nutrition.proteinMinG !== undefined ||
    intent.nutrition.caloriesMax !== undefined ||
    intent.nutrition.fatMaxG !== undefined ||
    intent.nutrition.carbsMaxG !== undefined ||
    intent.price.maxPriceVnd !== undefined ||
    intent.price.minPriceVnd !== undefined ||
    intent.rating.minAverageRating !== undefined ||
    Boolean(intent.geo.nearbyIntent)
  );
}

function pickSort(flags: {
  highProtein: boolean;
  hasPriceIntent: boolean;
  highlyRated: boolean;
  nearbyIntent: boolean;
}): AiSearchSort {
  if (flags.highProtein) return 'protein_desc';
  if (flags.nearbyIntent) return 'distance';
  if (flags.highlyRated) return 'rating';
  if (flags.hasPriceIntent) return 'price_asc';
  return 'relevance';
}

function extractExplicitPriceMax(normalized: string): number | undefined {
  const patterns = [
    /\b(?:under|below|less than|max|maximum|duoi)\s*(\d[\d.,]*)\s*(k|nghin|ngan|vnd)?\b/,
    /<=?\s*(\d[\d.,]*)\s*(k|nghin|ngan|vnd)?\b/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;

    const rawAmount = match[1];
    const suffix = match[2];
    const parsed = parseVndAmount(rawAmount, suffix);
    if (parsed !== undefined) return parsed;
  }

  return undefined;
}

function extractExplicitProteinMin(normalized: string): number | undefined {
  const match = normalized.match(
    /\b(?:protein|at least)\s*(\d{1,3})\s*(g|gram|grams)?\b/,
  );
  if (!match) return undefined;

  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function parseVndAmount(
  rawAmount: string | undefined,
  suffix: string | undefined,
): number | undefined {
  if (!rawAmount) return undefined;

  const numeric = Number(rawAmount.replace(/[.,]/g, ''));
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;

  if (suffix === 'k' || suffix === 'nghin' || suffix === 'ngan') {
    return Math.round(numeric * 1000);
  }

  return numeric < 1000 ? Math.round(numeric * 1000) : Math.round(numeric);
}

function extractFoodTerms(normalized: string): string[] {
  const sanitized = normalized
    .replace(/<=?\s*\d[\d.,]*\s*(k|nghin|ngan|vnd)?/g, ' ')
    .replace(
      /\b(?:under|below|less than|max|maximum|duoi)\s*\d[\d.,]*\s*(k|nghin|ngan|vnd)?\b/g,
      ' ',
    )
    .replace(/[^a-z0-9\s]/g, ' ');

  const terms = sanitized
    .split(/\s+/)
    .map((term) => singularize(term.trim()))
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term));

  return unique(terms).slice(0, 20);
}

export function isGenericFoodSearchQuery(query: string): boolean {
  const normalized = normalizeText(query)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return false;

  const terms = normalized
    .split(/\s+/)
    .map((term) => singularize(term.trim()))
    .filter(Boolean);
  if (terms.length === 0) return false;

  return (
    terms.some((term) => GENERIC_FOOD_TERMS.has(term)) &&
    terms.every((term) => STOP_WORDS.has(term) || GENERIC_FOOD_TERMS.has(term))
  );
}

export function isFoodNameOnlySearchQuery(query: string): boolean {
  const normalized = normalizeText(query)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized || isGenericFoodSearchQuery(normalized)) return false;

  const terms = normalized
    .split(/\s+/)
    .map((term) => singularize(term.trim()))
    .filter(Boolean);
  if (terms.length === 0 || terms.length > 6) return false;

  return terms.every(
    (term) => !STOP_WORDS.has(term) && FOOD_NAME_ONLY_TERMS.has(term),
  );
}

function singularize(term: string): string {
  if (term.endsWith('ies') && term.length > 4) {
    return `${term.slice(0, -3)}y`;
  }
  if (term.endsWith('les') && term.length > 4) {
    return term.slice(0, -1);
  }
  if (term.endsWith('es') && term.length > 4) {
    return term.slice(0, -2);
  }
  if (term.endsWith('s') && term.length > 3) {
    return term.slice(0, -1);
  }
  return term;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function detectLanguage(normalized: string): 'en' | 'vi' | 'unknown' {
  if (/\b(pho|banh|bun|com|mon|gia re|gan)\b/.test(normalized)) {
    return 'vi';
  }
  if (/[a-z]/.test(normalized)) return 'en';
  return 'unknown';
}
