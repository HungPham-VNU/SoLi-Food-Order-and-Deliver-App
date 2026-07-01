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
  type AiSearchItemKind,
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
  '  "itemKinds": ["food|beverage|mixed"],',
  '  "foodTerms": ["string"],',
  '  "cuisineTerms": ["string"],',
  '  "dietaryTags": ["string"],',
  '  "excludedTerms": ["string"],',
  '  "semanticConstraints": ["strict or nuanced constraint requiring evidence verification"],',
  '  "nutrition": {',
  '    "highProtein": "boolean | omitted",',
  '    "lowerCalorie": "boolean | omitted",',
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
  '  "sort": "relevance|distance|rating|price_asc|protein_desc|calories_asc",',
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

const DIETARY_TAG_ALIASES = new Map<string, string>([
  ['vegan', 'vegan'],
  ['vegetarian', 'vegetarian'],
  ['halal', 'halal'],
  ['gluten free', 'gluten-free'],
  ['dairy free', 'dairy-free'],
]);

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'ask',
  'best',
  'beverage',
  'beverages',
  'budget',
  'calorie',
  'calories',
  'cheap',
  'close',
  'dinner',
  'dish',
  'dishes',
  'drink',
  'drinks',
  'food',
  'foods',
  'for',
  'high',
  'higher',
  'highly',
  'in',
  'km',
  'lunch',
  'lose',
  'loss',
  'lost',
  'meal',
  'meals',
  'me',
  'near',
  'nearby',
  'nearest',
  'no',
  'now',
  'open',
  'option',
  'options',
  'please',
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
  'without',
  'weight',
]);

const GENERIC_FOOD_TERMS = new Set([
  'beverage',
  'dish',
  'drink',
  'food',
  'meal',
  'option',
]);

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

    const highProtein =
      /\b(high protein|protein rich|protein|lean|post[ -]?workout)\b/.test(
        normalized,
      );
    const explicitCaloriesMax = extractExplicitCaloriesMax(normalized);
    const lowerCalorie =
      isLowerCalorieIntent(normalized) || explicitCaloriesMax !== undefined;
    const lowFat = /\b(low fat|lower fat|lean meal)\b/.test(normalized);
    const itemKinds = inferItemKinds(normalized);
    const budgetIntent =
      /\b(budget|cheap|cheapest|affordable|inexpensive|gia re)\b/.test(
        normalized,
      );
    const explicitRatingMin = extractExplicitRatingMin(normalized);
    const highlyRated =
      /\b(highly rated|best rated|top rated|rating|review|reviews|best|good reviews)\b/.test(
        normalized,
      ) || explicitRatingMin !== undefined;
    const nearbyIntent =
      /\b(nearby|near me|near|close|nearest|gan day|gan toi)\b/.test(
        normalized,
      );

    const explicitPriceRange = extractExplicitPriceRange(normalized);
    const explicitPriceMax =
      explicitPriceRange?.max ?? extractExplicitPriceMax(normalized);
    const explicitPriceMin = explicitPriceRange?.min;
    const explicitProteinMin = extractExplicitProteinMin(normalized);
    const excludedTerms = extractExcludedTerms(normalized);
    const foodTerms = extractFoodTerms(normalized).filter(
      (term) => !excludedTerms.includes(term),
    );
    const cuisineTerms = unique(
      foodTerms.filter((term) => CUISINE_TERMS.has(term)),
    );
    const dietaryTags = extractDietaryTags(normalized);
    const semanticConstraints = extractSemanticConstraints(normalized);
    const genericFoodIntent = isGenericFoodSearchQuery(normalized);
    const foodNameOnly = isFoodNameOnlySearchQuery(normalized);

    const hasPriceIntent = budgetIntent || explicitPriceMax !== undefined;
    const hasAnySignal =
      highProtein ||
      lowerCalorie ||
      itemKinds.length > 0 ||
      hasPriceIntent ||
      highlyRated ||
      nearbyIntent ||
      excludedTerms.length > 0 ||
      dietaryTags.length > 0 ||
      semanticConstraints.length > 0 ||
      foodTerms.length > 0 ||
      genericFoodIntent;
    const sort = pickSort({
      highProtein,
      lowerCalorie,
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
      itemKinds,
      foodTerms,
      cuisineTerms,
      dietaryTags,
      excludedTerms,
      semanticConstraints,
      nutrition: {
        ...(lowerCalorie ? { lowerCalorie: true } : {}),
        ...(explicitCaloriesMax !== undefined
          ? { caloriesMax: explicitCaloriesMax }
          : lowerCalorie
            ? { caloriesMax: 500 }
            : {}),
        ...(highProtein
          ? {
              highProtein: true,
              proteinMinG:
                explicitProteinMin ?? AI_SEARCH_DEFAULT_HIGH_PROTEIN_MIN_G,
            }
          : {}),
        ...(lowFat ? { fatMaxG: 15 } : {}),
      },
      price: {
        ...(hasPriceIntent
          ? {
              maxPriceVnd: explicitPriceMax ?? AI_SEARCH_DEFAULT_BUDGET_MAX_VND,
              budgetIntent,
            }
          : {}),
        ...(explicitPriceMin !== undefined
          ? { minPriceVnd: explicitPriceMin }
          : {}),
      },
      rating: {
        ...(highlyRated
          ? {
              minAverageRating:
                explicitRatingMin ?? AI_SEARCH_DEFAULT_HIGH_RATING_MIN,
              ...(explicitRatingMin === undefined
                ? { minReviewCount: AI_SEARCH_DEFAULT_MIN_REVIEW_COUNT }
                : {}),
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
    const normalizedQuery = normalizeText(trimmed);
    const inferredItemKinds = inferItemKinds(normalizedQuery);
    const providerItemKinds = readItemKinds(source.itemKinds);
    const lowerCalorie = Boolean(
      readOptionalBoolean(nutrition.lowerCalorie) ||
      isLowerCalorieIntent(normalizedQuery) ||
      extractExplicitCaloriesMax(normalizedQuery) !== undefined,
    );
    const budgetIntent = readOptionalBoolean(price.budgetIntent);
    const nearbyIntent = readOptionalBoolean(geo.nearbyIntent);
    const explicitSort = readSort(source.sort);
    const providerFoodTerms = readTermArray(source.foodTerms, 20);
    const excludedTerms = unique([
      ...readTermArray(source.excludedTerms, 20),
      ...extractExcludedTerms(normalizedQuery),
    ]);
    const dietaryTags = unique(
      [
        ...readTermArray(source.dietaryTags, 20),
        ...extractDietaryTags(normalizedQuery),
      ]
        .map(canonicalizeDietaryTag)
        .filter((tag): tag is string => Boolean(tag)),
    );
    const foodNameOnly =
      readOptionalBoolean(source.foodNameOnly) ??
      isFoodNameOnlySearchQuery(trimmed);

    const rawIntent: AiSearchIntent = {
      rewrittenQuery: readBoundedString(source.rewrittenQuery, trimmed, 300),
      language: readLanguage(
        source.language,
        detectLanguage(normalizeText(trimmed)),
      ),
      itemKinds:
        inferredItemKinds.length > 0
          ? inferredItemKinds
          : isAmbiguousCourseOnlyIntent(normalizedQuery)
            ? []
            : providerItemKinds,
      foodTerms: providerFoodTerms.filter(
        (term) => !excludedTerms.includes(term),
      ),
      cuisineTerms: readTermArray(source.cuisineTerms, 10),
      dietaryTags,
      excludedTerms,
      semanticConstraints: unique([
        ...readTermArray(source.semanticConstraints, 10),
        ...extractSemanticConstraints(normalizedQuery),
      ]),
      nutrition: {
        ...(highProtein !== undefined ? { highProtein } : {}),
        ...(lowerCalorie ? { lowerCalorie: true } : {}),
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

    const explicitCaloriesMax = extractExplicitCaloriesMax(normalizedQuery);
    if (explicitCaloriesMax !== undefined) {
      rawIntent.nutrition.caloriesMax = explicitCaloriesMax;
    } else if (rawIntent.nutrition.lowerCalorie) {
      rawIntent.nutrition.caloriesMax = Math.min(
        rawIntent.nutrition.caloriesMax ?? 500,
        500,
      );
    }

    if (
      rawIntent.nutrition.fatMaxG === undefined &&
      /\b(low fat|lower fat|lean meal)\b/.test(normalizedQuery)
    ) {
      rawIntent.nutrition.fatMaxG = 15;
    }

    const explicitProteinMin = extractExplicitProteinMin(normalizedQuery);
    if (explicitProteinMin !== undefined) {
      rawIntent.nutrition.proteinMinG = explicitProteinMin;
    }

    if (
      rawIntent.nutrition.highProtein &&
      rawIntent.nutrition.proteinMinG === undefined
    ) {
      rawIntent.nutrition.proteinMinG = AI_SEARCH_DEFAULT_HIGH_PROTEIN_MIN_G;
    }

    const explicitPriceRange = extractExplicitPriceRange(normalizedQuery);
    const explicitPriceMax = extractExplicitPriceMax(normalizedQuery);
    if (explicitPriceRange) {
      rawIntent.price.minPriceVnd = explicitPriceRange.min;
      rawIntent.price.maxPriceVnd = explicitPriceRange.max;
    } else if (explicitPriceMax !== undefined) {
      rawIntent.price.maxPriceVnd = explicitPriceMax;
    }

    if (
      rawIntent.price.budgetIntent &&
      rawIntent.price.maxPriceVnd === undefined
    ) {
      rawIntent.price.maxPriceVnd = AI_SEARCH_DEFAULT_BUDGET_MAX_VND;
    }

    const explicitRatingMin = extractExplicitRatingMin(normalizedQuery);
    const highlyRated =
      /\b(highly rated|best rated|top rated|rating|review|reviews|best|good reviews)\b/.test(
        normalizedQuery,
      );
    if (explicitRatingMin !== undefined) {
      rawIntent.rating.minAverageRating = explicitRatingMin;
    }
    if (highlyRated && explicitRatingMin === undefined) {
      rawIntent.rating.minAverageRating = Math.max(
        rawIntent.rating.minAverageRating ?? AI_SEARCH_DEFAULT_HIGH_RATING_MIN,
        AI_SEARCH_DEFAULT_HIGH_RATING_MIN,
      );
      rawIntent.rating.minReviewCount ??= AI_SEARCH_DEFAULT_MIN_REVIEW_COUNT;
    }

    if (rawIntent.geo.nearbyIntent && rawIntent.geo.radiusKm === undefined) {
      rawIntent.geo.radiusKm = options.radiusKm ?? AI_SEARCH_DEFAULT_RADIUS_KM;
    }

    if (!explicitSort) {
      rawIntent.sort = pickSort({
        highProtein: Boolean(rawIntent.nutrition.highProtein),
        lowerCalorie: Boolean(rawIntent.nutrition.lowerCalorie),
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

function readItemKinds(value: unknown): AiSearchItemKind[] {
  if (!Array.isArray(value)) return [];
  return unique(
    value.filter(
      (item): item is AiSearchItemKind =>
        item === 'food' || item === 'beverage' || item === 'mixed',
    ),
  );
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
    value === 'protein_desc' ||
    value === 'calories_asc'
    ? value
    : undefined;
}

function hasIntentSignal(intent: AiSearchIntent): boolean {
  return (
    intent.foodTerms.length > 0 ||
    intent.itemKinds.length > 0 ||
    intent.dietaryTags.length > 0 ||
    intent.excludedTerms.length > 0 ||
    (intent.semanticConstraints?.length ?? 0) > 0 ||
    intent.cuisineTerms.length > 0 ||
    intent.nutrition.proteinMinG !== undefined ||
    Boolean(intent.nutrition.lowerCalorie) ||
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
  lowerCalorie: boolean;
  hasPriceIntent: boolean;
  highlyRated: boolean;
  nearbyIntent: boolean;
}): AiSearchSort {
  if (flags.lowerCalorie) return 'calories_asc';
  if (flags.highProtein) return 'protein_desc';
  if (flags.nearbyIntent) return 'distance';
  if (flags.highlyRated) return 'rating';
  if (flags.hasPriceIntent) return 'price_asc';
  return 'relevance';
}

function extractDietaryTags(normalized: string): string[] {
  const canonicalText = normalized.replace(/-/g, ' ');
  const tags: string[] = [];

  for (const [alias, tag] of DIETARY_TAG_ALIASES) {
    const escapedAlias = escapeRegExp(alias);
    const positivePattern = new RegExp(`\\b${escapedAlias}\\b`);
    const negatedPattern = new RegExp(
      `\\b(?:no|without|exclude|avoid)\\s+${escapedAlias}\\b`,
    );
    if (
      positivePattern.test(canonicalText) &&
      !negatedPattern.test(canonicalText)
    ) {
      tags.push(tag);
    }
  }

  return unique(tags);
}

function canonicalizeDietaryTag(value: string): string | null {
  const normalized = value.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  return DIETARY_TAG_ALIASES.get(normalized) ?? null;
}

function extractExcludedTerms(normalized: string): string[] {
  const terms: string[] = [];
  const pattern =
    /\b(?:no|without|exclude|excluding|avoid|avoiding|free of)\s+(?:any\s+)?([a-z][a-z-]*(?:\s+[a-z][a-z-]*)?)/g;
  const trailingWords = new Set([
    'and',
    'dish',
    'dishes',
    'food',
    'meal',
    'or',
    'please',
  ]);

  for (const match of normalized.matchAll(pattern)) {
    const words = (match[1] ?? '').replace(/-/g, ' ').trim().split(/\s+/);
    while (words.length > 1 && trailingWords.has(words.at(-1) ?? '')) {
      words.pop();
    }
    const term = singularize(words.join(' '));
    if (term.length > 1) terms.push(term);
  }

  return unique(terms).slice(0, 20);
}

function extractSemanticConstraints(normalized: string): string[] {
  const requiresEvidence =
    /\b(no|without|exclude|excluding|avoid|avoiding|free|allergy|allergic|vegan|vegetarian|halal|healthy|balanced|filling|greasy|oily|low fat|low sugar|post[ -]?workout|weight loss|lose weight)\b/.test(
      normalized,
    );
  return requiresEvidence ? [normalized.trim().slice(0, 160)] : [];
}

function extractExplicitPriceRange(
  normalized: string,
): { min: number; max: number } | undefined {
  const match = normalized.match(
    /\b(?:from|between)\s*(\d[\d.,]*)\s*(k|nghin|ngan|vnd)?\s*(?:to|and|-)\s*(\d[\d.,]*)\s*(k|nghin|ngan|vnd)?\b/,
  );
  if (!match) return undefined;

  const first = parseVndAmount(match[1], match[2]);
  const second = parseVndAmount(match[3], match[4]);
  if (first === undefined || second === undefined) return undefined;
  return { min: Math.min(first, second), max: Math.max(first, second) };
}

function extractExplicitRatingMin(normalized: string): number | undefined {
  const patterns = [
    /\b(?:rated|rating(?: of)?)\s*(\d(?:\.\d)?)\s*(?:\+|or higher|or above|and above)?\b/,
    /\b(?:at least|minimum)\s*(\d(?:\.\d)?)\s*(?:stars?|rating)\b/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > 0 && value <= 5) return value;
  }
  return undefined;
}

function extractExplicitPriceMax(normalized: string): number | undefined {
  const patterns = [
    /\b(?:under|below|less than|max|maximum|duoi)\s*(\d[\d.,]*)\s*(k|nghin|ngan|vnd)?\b(?!\s*(?:calorie|calories|kcal)\b)/,
    /<=?\s*(\d[\d.,]*)\s*(k|nghin|ngan|vnd)?\b(?!\s*(?:calorie|calories|kcal)\b)/,
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

function extractExplicitCaloriesMax(normalized: string): number | undefined {
  const match = normalized.match(
    /\b(?:under|below|less than|max|maximum|duoi)\s*(\d{1,4})\s*(?:calorie|calories|kcal)\b/,
  );
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 && value <= 5000
    ? value
    : undefined;
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

function isLowerCalorieIntent(normalized: string): boolean {
  return /\b(weight loss|weight lost|lose weight|losing weight|low calorie|lower calorie|slimming|giam can)\b/.test(
    normalized,
  );
}

function inferItemKinds(normalized: string): AiSearchItemKind[] {
  const explicitFood = /\b(food|foods|dish|dishes|do an|mon an|thuc an)\b/.test(
    normalized,
  );
  const meal =
    /\b(meal|meals|breakfast|lunch|dinner|bua an|bua sang|bua trua|bua toi)\b/.test(
      normalized,
    );
  const beverage =
    /\b(drink|drinks|beverage|beverages|do uong|nuoc uong)\b/.test(normalized);

  if ((explicitFood || meal) && beverage) {
    return ['food', 'beverage', 'mixed'];
  }
  if (explicitFood) return ['food'];
  if (meal) return ['food', 'mixed'];
  if (beverage) return ['beverage'];
  return [];
}

function isAmbiguousCourseOnlyIntent(normalized: string): boolean {
  const meaningfulTerms = normalized
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 0 && !STOP_WORDS.has(term))
    .map(singularize)
    .filter((term) => !STOP_WORDS.has(term));

  return (
    meaningfulTerms.length > 0 &&
    meaningfulTerms.every((term) => term === 'dessert' || term === 'appetizer')
  );
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
  if (term === 'beverages') return 'beverage';
  if (term.endsWith('ss')) return term;
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

function unique<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
