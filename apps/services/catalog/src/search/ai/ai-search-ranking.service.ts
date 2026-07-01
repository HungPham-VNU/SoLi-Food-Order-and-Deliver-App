import { Injectable } from '@nestjs/common';
import { recordAiSearchRanking } from '@/observability/domain-metrics';
import type { AiSearchRequestDto } from './ai-search.dto';
import {
  AI_ITEM_SCORE,
  AI_SEARCH_BRANCH_WEIGHTS,
  AI_SEARCH_DEFAULT_RANKING_WEIGHTS,
  AI_SEARCH_POPULARITY_MAX_SCORE,
  AI_SEARCH_STATS_STALE_AFTER_HOURS,
  type AiSearchIntent,
  type AiSearchItemCandidate,
  type AiSearchItemResult,
  type AiSearchPopularitySignals,
  type AiSearchRankingBreakdown,
  type AiSearchRankingWeightKey,
  type AiSearchRankingWeights,
  type AiSearchRestaurantCandidate,
  type AiSearchRetrievalBranch,
} from './ai-search.types';

const MAX_FACTUAL_SCORE = 100;
const DEFAULT_MAX_ITEMS_PER_RESTAURANT = 3;
const FRESHNESS_FULL_SCORE_DAYS = 14;
const FRESHNESS_ZERO_SCORE_DAYS = 90;

interface RankingContext {
  radiusKm: number;
  now?: Date;
}

interface RankingConfig {
  v2Enabled: boolean;
  diversityEnabled: boolean;
  maxItemsPerRestaurant: number;
  weights: AiSearchRankingWeights;
}

@Injectable()
export class AiSearchRankingService {
  rankItems(
    items: AiSearchItemCandidate[],
    intent: AiSearchIntent,
    request: AiSearchRequestDto,
    context: RankingContext,
  ): AiSearchItemResult[] {
    const startedAt = Date.now();
    const config = resolveRankingConfig();
    const ranked = config.v2Enabled
      ? this.rankItemsV2(items, intent, request, context, config)
      : this.rankItemsLegacy(items, intent, request);

    recordAiSearchRanking({
      target: 'items',
      mode: config.v2Enabled ? 'v2' : 'legacy',
      candidateCount: items.length,
      outputCount: ranked.length,
      diversitySuppressedCount:
        config.v2Enabled && intent.sort === 'relevance'
          ? Math.max(
              0,
              items.length - countFirstPassDiverseItems(ranked, config),
            )
          : 0,
      latencyMs: Date.now() - startedAt,
    });

    return ranked;
  }

  rankRestaurants(
    restaurants: AiSearchRestaurantCandidate[],
    intent: AiSearchIntent,
    context: RankingContext,
  ): AiSearchRestaurantCandidate[] {
    const startedAt = Date.now();
    const config = resolveRankingConfig();
    const ranked = config.v2Enabled
      ? this.rankRestaurantsV2(restaurants, intent, context, config)
      : this.rankRestaurantsLegacy(restaurants, intent);

    recordAiSearchRanking({
      target: 'restaurants',
      mode: config.v2Enabled ? 'v2' : 'legacy',
      candidateCount: restaurants.length,
      outputCount: ranked.length,
      diversitySuppressedCount: 0,
      latencyMs: Date.now() - startedAt,
    });

    return ranked;
  }

  private rankItemsLegacy(
    items: AiSearchItemCandidate[],
    intent: AiSearchIntent,
    request: AiSearchRequestDto,
  ): AiSearchItemResult[] {
    return items
      .map((item) => {
        const factualScore = this.scoreItemLegacy(item, intent, request);
        const score = toPublicScore(
          combineHybridScore(
            item.branchScores,
            normalizeFactualScore(factualScore),
          ),
        );
        return this.toPublicItemResult(
          item,
          score,
          this.buildItemMatchReasons(item, intent, {
            popularityScore: 0,
            freshnessScore: 0,
          }),
        );
      })
      .sort((a, b) => this.compareItems(a, b, intent));
  }

  private rankRestaurantsLegacy(
    restaurants: AiSearchRestaurantCandidate[],
    intent: AiSearchIntent,
  ): AiSearchRestaurantCandidate[] {
    return restaurants
      .map((restaurant) => {
        const factualScore = this.scoreRestaurantLegacy(restaurant, intent);
        return this.toPublicRestaurantResult(restaurant, {
          score: toPublicScore(
            combineHybridScore(
              restaurant.branchScores,
              normalizeFactualScore(factualScore),
            ),
          ),
        });
      })
      .sort((a, b) => this.compareRestaurants(a, b, intent));
  }

  private rankItemsV2(
    items: AiSearchItemCandidate[],
    intent: AiSearchIntent,
    request: AiSearchRequestDto,
    context: RankingContext,
    config: RankingConfig,
  ): AiSearchItemResult[] {
    const now = context.now ?? new Date();
    const ranked = items
      .map((item) => {
        const breakdown = this.scoreItemV2(
          item,
          intent,
          request,
          context.radiusKm,
          now,
          config.weights,
        );
        return this.toPublicItemResult(
          { ...item, rankingBreakdown: breakdown },
          toPublicScore(breakdown.finalScore),
          this.buildItemMatchReasons(item, intent, breakdown),
        );
      })
      .sort((a, b) => this.compareItems(a, b, intent));

    if (
      config.diversityEnabled &&
      intent.sort === 'relevance' &&
      config.maxItemsPerRestaurant > 0
    ) {
      return applyRestaurantDiversity(ranked, config.maxItemsPerRestaurant);
    }

    return ranked;
  }

  private rankRestaurantsV2(
    restaurants: AiSearchRestaurantCandidate[],
    intent: AiSearchIntent,
    context: RankingContext,
    config: RankingConfig,
  ): AiSearchRestaurantCandidate[] {
    const now = context.now ?? new Date();
    return restaurants
      .map((restaurant) => {
        const breakdown = this.scoreRestaurantV2(
          restaurant,
          intent,
          context.radiusKm,
          now,
          config.weights,
        );
        return this.toPublicRestaurantResult(restaurant, {
          score: toPublicScore(breakdown.finalScore),
        });
      })
      .sort((a, b) => this.compareRestaurants(a, b, intent));
  }

  private scoreItemV2(
    item: AiSearchItemCandidate,
    intent: AiSearchIntent,
    request: AiSearchRequestDto,
    radiusKm: number,
    now: Date,
    weights: AiSearchRankingWeights,
  ): AiSearchRankingBreakdown {
    const retrievalScore = combineHybridScore(
      item.branchScores,
      normalizeFactualScore(this.scoreItemLegacy(item, intent, request)),
    );
    const nutritionScore = scoreItemNutrition(item, intent);
    const priceScore = scorePrice(item.price, intent);
    const distanceScore = scoreDistance(item.restaurant.distanceKm, radiusKm);
    const ratingScore = scoreRating(
      item.restaurant.averageRating,
      item.restaurant.reviewCount,
    );
    const popularityScore = scorePopularity(item.popularity, now);
    const freshnessScore = scoreFreshness(item.updatedAt, item.createdAt, now);
    const availabilityScore = 1;
    const finalScore = clamp01(
      retrievalScore * weights.retrieval +
        nutritionScore * weights.nutrition +
        priceScore * weights.price +
        distanceScore * weights.distance +
        ratingScore * weights.rating +
        popularityScore * weights.popularity +
        freshnessScore * weights.freshness +
        availabilityScore * weights.availability,
    );

    return {
      retrievalScore,
      nutritionScore,
      priceScore,
      distanceScore,
      ratingScore,
      popularityScore,
      freshnessScore,
      availabilityScore,
      finalScore,
    };
  }

  private scoreRestaurantV2(
    restaurant: AiSearchRestaurantCandidate,
    intent: AiSearchIntent,
    radiusKm: number,
    now: Date,
    weights: AiSearchRankingWeights,
  ): AiSearchRankingBreakdown {
    const retrievalScore = combineHybridScore(
      restaurant.branchScores,
      normalizeFactualScore(this.scoreRestaurantLegacy(restaurant, intent)),
    );
    const nutritionScore = 0;
    const priceScore = 0;
    const distanceScore = scoreDistance(restaurant.distanceKm, radiusKm);
    const ratingScore = scoreRating(
      restaurant.averageRating,
      restaurant.reviewCount,
    );
    const popularityScore = scorePopularity(restaurant.popularity, now);
    const freshnessScore = scoreFreshness(
      restaurant.updatedAt,
      restaurant.createdAt,
      now,
    );
    const availabilityScore = restaurant.isOpen ? 1 : 0;
    const finalScore = clamp01(
      retrievalScore * weights.retrieval +
        nutritionScore * weights.nutrition +
        priceScore * weights.price +
        distanceScore * weights.distance +
        ratingScore * weights.rating +
        popularityScore * weights.popularity +
        freshnessScore * weights.freshness +
        availabilityScore * weights.availability,
    );

    return {
      retrievalScore,
      nutritionScore,
      priceScore,
      distanceScore,
      ratingScore,
      popularityScore,
      freshnessScore,
      availabilityScore,
      finalScore,
    };
  }

  private scoreItemLegacy(
    item: AiSearchItemCandidate,
    intent: AiSearchIntent,
    request: AiSearchRequestDto,
  ): number {
    const terms = [
      ...intent.foodTerms,
      ...intent.dietaryTags,
      ...intent.cuisineTerms,
    ];
    const normalizedName = normalizeText(item.name);
    const normalizedCategory = normalizeText(item.categoryName ?? '');
    const normalizedCuisine = normalizeText(item.restaurant.cuisineType ?? '');
    const tags = new Set((item.tags ?? []).map((tag) => normalizeText(tag)));
    let score = 0;

    for (const term of terms) {
      if (normalizedName === term) score += AI_ITEM_SCORE.exactNameMatch;
      else if (normalizedName.includes(term))
        score += AI_ITEM_SCORE.partialNameMatch;
      if (tags.has(term)) score += AI_ITEM_SCORE.tagMatch;
      if (normalizedCategory.includes(term))
        score += AI_ITEM_SCORE.categoryMatch;
      if (normalizedCuisine.includes(term)) score += AI_ITEM_SCORE.cuisineMatch;
    }

    const protein = item.nutrition?.protein;
    if (
      intent.nutrition.proteinMinG !== undefined &&
      protein !== null &&
      protein !== undefined &&
      protein >= intent.nutrition.proteinMinG
    ) {
      score += AI_ITEM_SCORE.highProteinMatch + Math.min(10, protein / 5);
    }

    if (
      intent.price.maxPriceVnd !== undefined &&
      item.price <= intent.price.maxPriceVnd
    ) {
      score += AI_ITEM_SCORE.budgetMatch;
    }

    if (
      intent.rating.minAverageRating !== undefined &&
      Number(item.restaurant.averageRating ?? 0) >=
        intent.rating.minAverageRating &&
      Number(item.restaurant.reviewCount ?? 0) >=
        (intent.rating.minReviewCount ?? 0)
    ) {
      score += AI_ITEM_SCORE.highlyRatedMatch;
    }

    if (
      request.lat !== undefined &&
      request.lon !== undefined &&
      item.restaurant.distanceKm !== null &&
      item.restaurant.distanceKm !== undefined
    ) {
      score += AI_ITEM_SCORE.nearbyMatch;
      score += Math.max(0, 5 - item.restaurant.distanceKm);
    }

    if (Number(item.restaurant.reviewCount ?? 0) > 0) {
      score += AI_ITEM_SCORE.reviewConfidence;
    }

    score += AI_ITEM_SCORE.openNow;
    return Math.round(score);
  }

  private scoreRestaurantLegacy(
    restaurant: AiSearchRestaurantCandidate,
    intent: AiSearchIntent,
  ): number {
    const terms = [
      ...intent.foodTerms,
      ...intent.dietaryTags,
      ...intent.cuisineTerms,
    ];
    const normalizedName = normalizeText(restaurant.name);
    const normalizedCuisine = normalizeText(restaurant.cuisineType ?? '');
    const normalizedDescription = normalizeText(restaurant.description ?? '');
    let score = 0;

    for (const term of terms) {
      if (normalizedName === term) score += AI_ITEM_SCORE.exactNameMatch;
      else if (normalizedName.includes(term))
        score += AI_ITEM_SCORE.partialNameMatch;
      if (normalizedCuisine.includes(term)) score += AI_ITEM_SCORE.cuisineMatch;
      if (normalizedDescription.includes(term)) score += 3;
    }

    if (
      intent.rating.minAverageRating !== undefined &&
      Number(restaurant.averageRating ?? 0) >= intent.rating.minAverageRating &&
      Number(restaurant.reviewCount ?? 0) >= (intent.rating.minReviewCount ?? 0)
    ) {
      score += AI_ITEM_SCORE.highlyRatedMatch;
    }

    if (restaurant.distanceKm !== null && restaurant.distanceKm !== undefined) {
      score += AI_ITEM_SCORE.nearbyMatch;
      score += Math.max(0, 5 - restaurant.distanceKm);
    }

    if (restaurant.isOpen) score += AI_ITEM_SCORE.openNow;
    if (Number(restaurant.reviewCount ?? 0) > 0) {
      score += AI_ITEM_SCORE.reviewConfidence;
    }

    return Math.round(score);
  }

  private compareItems(
    a: AiSearchItemResult,
    b: AiSearchItemResult,
    intent: AiSearchIntent,
  ): number {
    if (intent.sort === 'calories_asc') {
      return (
        compareNullableNumbers(a.nutrition?.calories, b.nutrition?.calories) ||
        b.score - a.score ||
        a.id.localeCompare(b.id)
      );
    }
    if (intent.sort === 'protein_desc') {
      return (
        Number(b.nutrition?.protein ?? -1) -
          Number(a.nutrition?.protein ?? -1) || b.score - a.score
      );
    }
    if (intent.sort === 'price_asc') {
      return a.price - b.price || b.score - a.score;
    }
    if (intent.sort === 'distance') {
      return (
        compareNullableNumbers(
          a.restaurant.distanceKm,
          b.restaurant.distanceKm,
        ) ||
        b.score - a.score ||
        a.id.localeCompare(b.id)
      );
    }
    if (intent.sort === 'rating') {
      return (
        Number(b.restaurant.averageRating ?? 0) -
          Number(a.restaurant.averageRating ?? 0) ||
        Number(b.restaurant.reviewCount ?? 0) -
          Number(a.restaurant.reviewCount ?? 0) ||
        b.score - a.score ||
        a.id.localeCompare(b.id)
      );
    }
    return (
      b.score - a.score ||
      Number(b.restaurant.averageRating ?? 0) -
        Number(a.restaurant.averageRating ?? 0) ||
      Number(b.restaurant.reviewCount ?? 0) -
        Number(a.restaurant.reviewCount ?? 0) ||
      compareNullableNumbers(
        a.restaurant.distanceKm,
        b.restaurant.distanceKm,
      ) ||
      a.id.localeCompare(b.id)
    );
  }

  private compareRestaurants(
    a: AiSearchRestaurantCandidate,
    b: AiSearchRestaurantCandidate,
    intent: AiSearchIntent,
  ): number {
    if (intent.sort === 'distance') {
      return (
        compareNullableNumbers(a.distanceKm, b.distanceKm) ||
        Number(b.score ?? 0) - Number(a.score ?? 0) ||
        a.id.localeCompare(b.id)
      );
    }
    if (intent.sort === 'rating') {
      return (
        Number(b.averageRating ?? 0) - Number(a.averageRating ?? 0) ||
        Number(b.reviewCount ?? 0) - Number(a.reviewCount ?? 0) ||
        Number(b.score ?? 0) - Number(a.score ?? 0) ||
        a.id.localeCompare(b.id)
      );
    }
    return (
      Number(b.score ?? 0) - Number(a.score ?? 0) ||
      Number(b.averageRating ?? 0) - Number(a.averageRating ?? 0) ||
      Number(b.reviewCount ?? 0) - Number(a.reviewCount ?? 0) ||
      compareNullableNumbers(a.distanceKm, b.distanceKm) ||
      a.id.localeCompare(b.id)
    );
  }

  private buildItemMatchReasons(
    item: AiSearchItemCandidate,
    intent: AiSearchIntent,
    scores: Pick<
      AiSearchRankingBreakdown,
      'popularityScore' | 'freshnessScore'
    >,
  ): string[] {
    const reasons: string[] = [];
    const protein = item.nutrition?.protein;

    if (
      intent.nutrition.lowerCalorie &&
      item.nutrition?.calories !== null &&
      item.nutrition?.calories !== undefined
    ) {
      reasons.push(`${Math.round(item.nutrition.calories)} kcal per serving`);
    }

    if (
      intent.nutrition.proteinMinG !== undefined &&
      protein !== null &&
      protein !== undefined &&
      protein >= intent.nutrition.proteinMinG
    ) {
      reasons.push(`${Math.round(protein)}g protein`);
    }

    if (
      intent.price.maxPriceVnd !== undefined &&
      item.price <= intent.price.maxPriceVnd
    ) {
      reasons.push(`Under ${intent.price.maxPriceVnd} VND`);
    }

    const rating = Number(item.restaurant.averageRating ?? 0);
    if (rating > 0) {
      reasons.push(`${rating.toFixed(1)} rating`);
    }

    if (
      item.restaurant.distanceKm !== null &&
      item.restaurant.distanceKm !== undefined
    ) {
      reasons.push(`${item.restaurant.distanceKm.toFixed(1)} km away`);
    }

    if (scores.popularityScore > 0 && item.popularity?.deliveredOrderCount30d) {
      reasons.push('Popular this month');
    }

    if (scores.freshnessScore >= 1) {
      reasons.push('Recently updated');
    }

    reasons.push('Open now');
    return reasons.slice(0, 4);
  }

  private toPublicItemResult(
    item: AiSearchItemCandidate,
    score: number,
    matchReasons: string[],
  ): AiSearchItemResult {
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      itemKind: item.itemKind,
      imageUrl: item.imageUrl,
      tags: item.tags,
      categoryName: item.categoryName,
      restaurant: item.restaurant,
      nutrition: item.nutrition,
      score,
      matchReasons,
    };
  }

  private toPublicRestaurantResult(
    restaurant: AiSearchRestaurantCandidate,
    overrides: { score: number },
  ): AiSearchRestaurantCandidate {
    return {
      id: restaurant.id,
      name: restaurant.name,
      description: restaurant.description,
      address: restaurant.address,
      phone: restaurant.phone,
      isOpen: restaurant.isOpen,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
      cuisineType: restaurant.cuisineType,
      logoUrl: restaurant.logoUrl,
      coverImageUrl: restaurant.coverImageUrl,
      averageRating: restaurant.averageRating,
      ratingSum: restaurant.ratingSum,
      reviewCount: restaurant.reviewCount,
      distanceKm: restaurant.distanceKm,
      createdAt: restaurant.createdAt,
      updatedAt: restaurant.updatedAt,
      score: overrides.score,
    };
  }
}

export function parseAiSearchRankingWeights(
  raw: string | undefined,
): AiSearchRankingWeights {
  const parsed: unknown =
    raw === undefined || raw.trim() === ''
      ? AI_SEARCH_DEFAULT_RANKING_WEIGHTS
      : JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('AI search ranking weights must be an object.');
  }
  const parsedWeights = parsed as Record<string, unknown>;
  const keys = Object.keys(
    AI_SEARCH_DEFAULT_RANKING_WEIGHTS,
  ) as AiSearchRankingWeightKey[];
  const weights = {} as AiSearchRankingWeights;
  let total = 0;

  for (const key of keys) {
    const value = Number(parsedWeights[key]);
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Invalid AI search ranking weight: ${key}`);
    }
    weights[key] = value;
    total += value;
  }

  if (total <= 0) {
    throw new Error('AI search ranking weights must have a positive total.');
  }

  for (const key of keys) {
    weights[key] = weights[key] / total;
  }

  return weights;
}

function resolveRankingConfig(): RankingConfig {
  return {
    v2Enabled: parseBoolean(process.env.AI_SEARCH_RANKING_V2_ENABLED, false),
    diversityEnabled: parseBoolean(
      process.env.AI_SEARCH_DIVERSITY_ENABLED,
      true,
    ),
    maxItemsPerRestaurant: parsePositiveInteger(
      process.env.AI_SEARCH_MAX_ITEMS_PER_RESTAURANT,
      DEFAULT_MAX_ITEMS_PER_RESTAURANT,
    ),
    weights: parseAiSearchRankingWeights(process.env.AI_SEARCH_RANKING_WEIGHTS),
  };
}

function scoreItemNutrition(
  item: AiSearchItemCandidate,
  intent: AiSearchIntent,
): number {
  const scores: number[] = [];

  if (intent.nutrition.lowerCalorie) {
    const calories = item.nutrition?.calories;
    scores.push(
      calories === null || calories === undefined
        ? 0
        : clamp01(1 - calories / 5000),
    );
  }

  if (intent.nutrition.proteinMinG !== undefined) {
    const protein = item.nutrition?.protein;
    scores.push(
      protein === null || protein === undefined
        ? 0
        : clamp01(protein / intent.nutrition.proteinMinG),
    );
  }
  if (intent.nutrition.caloriesMax !== undefined) {
    const calories = item.nutrition?.calories;
    scores.push(
      calories === null || calories === undefined || calories <= 0
        ? 0
        : clamp01(intent.nutrition.caloriesMax / calories),
    );
  }
  if (intent.nutrition.fatMaxG !== undefined) {
    const fat = item.nutrition?.fat;
    scores.push(
      fat === null || fat === undefined || fat <= 0
        ? 0
        : clamp01(intent.nutrition.fatMaxG / fat),
    );
  }
  if (intent.nutrition.carbsMaxG !== undefined) {
    const carbs = item.nutrition?.carbs;
    scores.push(
      carbs === null || carbs === undefined || carbs <= 0
        ? 0
        : clamp01(intent.nutrition.carbsMaxG / carbs),
    );
  }

  if (scores.length === 0) return 0;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function scorePrice(price: number, intent: AiSearchIntent): number {
  const maxPrice = intent.price.maxPriceVnd;
  if (maxPrice === undefined || maxPrice <= 0) return 0;
  return clamp01(1 - price / maxPrice);
}

function scoreDistance(
  distanceKm: number | null | undefined,
  radiusKm: number,
): number {
  if (distanceKm === null || distanceKm === undefined || radiusKm <= 0) {
    return 0;
  }
  return clamp01(1 - distanceKm / radiusKm);
}

function scoreRating(
  averageRating: number | null | undefined,
  reviewCount: number | null | undefined,
): number {
  const rating = Number(averageRating ?? 0);
  const count = Number(reviewCount ?? 0);
  if (rating <= 0 || count <= 0) return 0;
  const priorRating = 4;
  const priorWeight = 5;
  const bayesianRating =
    (rating * count + priorRating * priorWeight) / (count + priorWeight);
  const confidence = clamp01(Math.log1p(count) / Math.log1p(50));
  return clamp01((bayesianRating / 5) * (0.5 + confidence * 0.5));
}

export function scorePopularity(
  popularity: AiSearchPopularitySignals | null | undefined,
  now: Date,
): number {
  if (!popularity?.updatedAt || isStatsStale(popularity.updatedAt, now)) {
    return 0;
  }

  const score =
    0.7 * (Math.log1p(popularity.deliveredOrderCount30d) / Math.log1p(50)) +
    0.3 * (Math.log1p(popularity.deliveredOrderCount90d) / Math.log1p(150));

  return Math.min(AI_SEARCH_POPULARITY_MAX_SCORE, clamp01(score));
}

export function scoreFreshness(
  updatedAt: Date | null | undefined,
  createdAt: Date | null | undefined,
  now: Date,
): number {
  const freshest = maxDate(updatedAt, createdAt);
  if (!freshest) return 0;

  const ageDays = Math.max(
    0,
    (now.getTime() - freshest.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (ageDays <= FRESHNESS_FULL_SCORE_DAYS) return 1;
  if (ageDays >= FRESHNESS_ZERO_SCORE_DAYS) return 0;

  return clamp01(
    (FRESHNESS_ZERO_SCORE_DAYS - ageDays) /
      (FRESHNESS_ZERO_SCORE_DAYS - FRESHNESS_FULL_SCORE_DAYS),
  );
}

function isStatsStale(updatedAt: Date, now: Date): boolean {
  return (
    now.getTime() - updatedAt.getTime() >
    AI_SEARCH_STATS_STALE_AFTER_HOURS * 60 * 60 * 1000
  );
}

function applyRestaurantDiversity(
  items: AiSearchItemResult[],
  maxItemsPerRestaurant: number,
): AiSearchItemResult[] {
  const selected: AiSearchItemResult[] = [];
  const deferred: AiSearchItemResult[] = [];
  const counts = new Map<string, number>();

  for (const item of items) {
    const restaurantId = item.restaurant.id;
    const count = counts.get(restaurantId) ?? 0;
    if (count < maxItemsPerRestaurant) {
      selected.push(item);
      counts.set(restaurantId, count + 1);
    } else {
      deferred.push(item);
    }
  }

  return [...selected, ...deferred];
}

function countFirstPassDiverseItems(
  items: AiSearchItemResult[],
  config: RankingConfig,
): number {
  const counts = new Map<string, number>();
  let total = 0;

  for (const item of items) {
    const count = counts.get(item.restaurant.id) ?? 0;
    if (count >= config.maxItemsPerRestaurant) continue;
    counts.set(item.restaurant.id, count + 1);
    total += 1;
  }

  return total;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function compareNullableNumbers(
  a: number | null | undefined,
  b: number | null | undefined,
): number {
  const left = a ?? Number.POSITIVE_INFINITY;
  const right = b ?? Number.POSITIVE_INFINITY;
  return left - right;
}

function combineHybridScore(
  branchScores: Partial<Record<AiSearchRetrievalBranch, number>> | undefined,
  factualScore: number,
): number {
  const fulltextScore = Math.max(
    branchScores?.fulltext ?? 0,
    branchScores?.lexical ?? 0,
    branchScores?.tag ?? 0,
  );

  return clamp01(
    fulltextScore * AI_SEARCH_BRANCH_WEIGHTS.fulltext +
      (branchScores?.semantic ?? 0) * AI_SEARCH_BRANCH_WEIGHTS.semantic +
      (branchScores?.trigram ?? 0) * AI_SEARCH_BRANCH_WEIGHTS.trigram +
      factualScore * AI_SEARCH_BRANCH_WEIGHTS.factual,
  );
}

function normalizeFactualScore(score: number): number {
  return clamp01(score / MAX_FACTUAL_SCORE);
}

function toPublicScore(score: number): number {
  return Math.round(clamp01(score) * 100);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function parseBoolean(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined || value.trim() === '') return defaultValue;
  return ['1', 'true', 'yes'].includes(value.trim().toLowerCase());
}

function parsePositiveInteger(
  value: string | undefined,
  defaultValue: number,
): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function maxDate(
  left: Date | null | undefined,
  right: Date | null | undefined,
): Date | null {
  if (!left) return right ?? null;
  if (!right) return left;
  return left.getTime() >= right.getTime() ? left : right;
}
