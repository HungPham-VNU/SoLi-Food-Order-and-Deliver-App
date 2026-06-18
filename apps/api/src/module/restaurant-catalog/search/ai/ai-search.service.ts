import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { recordAiSearch } from '@/observability/domain-metrics';
import { SearchService } from '../standard/search.service';
import type { AiSearchRequestDto } from './ai-search.dto';
import { AiSearchIntentService } from './ai-search-intent.service';
import { AiSearchRepository } from './ai-search.repository';
import {
  AI_ITEM_SCORE,
  AI_SEARCH_DEFAULT_RADIUS_KM,
  AI_SEARCH_MIN_CONFIDENCE,
  type AiSearchAppliedFilter,
  type AiSearchFallbackReason,
  type AiSearchFollowUp,
  type AiSearchIntent,
  type AiSearchItemCandidate,
  type AiSearchItemResult,
  type AiSearchRepositoryFilters,
  type AiSearchResponse,
  type AiSearchRestaurantCandidate,
  type AiSearchRetrievalBranch,
} from './ai-search.types';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_BRANCH_ROWS = 150;

@Injectable()
export class AiSearchService {
  private readonly logger = new Logger(AiSearchService.name);

  constructor(
    private readonly repo: AiSearchRepository,
    private readonly intentService: AiSearchIntentService,
    private readonly standardSearch: SearchService,
  ) {}

  async search(request: AiSearchRequestDto): Promise<AiSearchResponse> {
    const startedAt = Date.now();
    const query = request.query.trim();
    const limit = Math.min(request.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = Math.max(request.offset ?? 0, 0);
    const radiusKm = request.radiusKm ?? AI_SEARCH_DEFAULT_RADIUS_KM;

    if (!query) {
      return this.fallbackToClassic(
        query,
        request,
        'AI_SEARCH_EMPTY_QUERY',
        startedAt,
      );
    }

    if ((request.lat === undefined) !== (request.lon === undefined)) {
      throw new BadRequestException(
        'lat and lon must both be provided together for AI search',
      );
    }

    try {
      const intent = this.intentService.parseIntent(query, { radiusKm });
      const minConfidence = resolveMinConfidence();

      if (intent.needsFallback || intent.confidence < minConfidence) {
        return this.fallbackToClassic(
          query,
          request,
          'LOW_CONFIDENCE',
          startedAt,
        );
      }

      const branches = this.buildRetrievalBranches(intent, request);
      const branchLimit = Math.min(
        MAX_BRANCH_ROWS,
        Math.max(limit * 4, DEFAULT_PAGE_SIZE),
      );
      const branchFilters = branches.map(
        (branch): AiSearchRepositoryFilters => ({
          intent,
          branch,
          lat: request.lat,
          lon: request.lon,
          radiusKm,
          limit: branchLimit,
        }),
      );

      const [itemBranches, restaurantBranches] = await Promise.all([
        Promise.all(
          branchFilters.map((filters) => this.repo.findItems(filters)),
        ),
        Promise.all(
          branchFilters
            .filter((filters) => this.shouldRetrieveRestaurants(filters))
            .map((filters) => this.repo.findRestaurants(filters)),
        ),
      ]);

      const rankedItems = this.rankItems(
        this.mergeItems(itemBranches.flat()),
        intent,
        request,
      );
      const rankedRestaurants = this.rankRestaurants(
        this.mergeRestaurants(restaurantBranches.flat()),
        intent,
      );

      const items = rankedItems.slice(offset, offset + limit);
      const restaurants = rankedRestaurants.slice(offset, offset + limit);
      const response: AiSearchResponse = {
        mode: 'ai',
        query,
        interpretation: this.buildInterpretation(intent, request),
        appliedFilters: this.buildAppliedFilters(intent, request, radiusKm),
        restaurants,
        items,
        total: {
          restaurants: rankedRestaurants.length,
          items: rankedItems.length,
        },
        followUps: this.buildFollowUps(intent, query, request),
        fallback: null,
      };

      this.recordSearch(response, startedAt);
      return response;
    } catch (error) {
      this.logger.warn(
        `AI search fell back after parse/retrieval error: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return this.fallbackToClassic(
        query,
        request,
        'AI_SEARCH_UNAVAILABLE',
        startedAt,
      );
    }
  }

  private async fallbackToClassic(
    query: string,
    request: AiSearchRequestDto,
    reason: AiSearchFallbackReason,
    startedAt: number,
  ): Promise<AiSearchResponse> {
    const classic = await this.standardSearch.search(
      query,
      undefined,
      undefined,
      undefined,
      request.lat,
      request.lon,
      request.radiusKm,
      request.offset,
      request.limit,
    );

    const response: AiSearchResponse = {
      mode: 'classic_fallback',
      query,
      interpretation: 'Showing regular search results.',
      appliedFilters: [],
      restaurants: classic.restaurants.map((restaurant) => ({
        ...restaurant,
        score: Number(restaurant.score ?? 0),
      })),
      items: classic.items.map((item) => ({
        ...item,
        score: Number(item.score ?? 0),
        matchReasons: [],
      })),
      total: classic.total,
      followUps: [],
      fallback: { reason },
    };

    this.recordSearch(response, startedAt);
    return response;
  }

  private buildRetrievalBranches(
    intent: AiSearchIntent,
    request: AiSearchRequestDto,
  ): AiSearchRetrievalBranch[] {
    const branches = new Set<AiSearchRetrievalBranch>();
    const hasTerms =
      intent.foodTerms.length > 0 ||
      intent.dietaryTags.length > 0 ||
      intent.cuisineTerms.length > 0;

    if (hasTerms) {
      branches.add('lexical');
      branches.add('tag');
    }
    if (intent.nutrition.proteinMinG !== undefined) branches.add('nutrition');
    if (intent.price.maxPriceVnd !== undefined) branches.add('price');
    if (intent.rating.minAverageRating !== undefined) branches.add('rating');
    if (request.lat !== undefined && request.lon !== undefined)
      branches.add('geo');

    if (branches.size === 0) branches.add('lexical');
    return Array.from(branches);
  }

  private shouldRetrieveRestaurants(
    filters: AiSearchRepositoryFilters,
  ): boolean {
    return (
      filters.branch === 'lexical' ||
      filters.branch === 'tag' ||
      filters.branch === 'rating' ||
      filters.branch === 'geo'
    );
  }

  private mergeItems(items: AiSearchItemCandidate[]): AiSearchItemCandidate[] {
    const merged = new Map<string, AiSearchItemCandidate>();

    for (const item of items) {
      const existing = merged.get(item.id);
      if (!existing) {
        merged.set(item.id, {
          ...item,
          retrievalBranches: [...item.retrievalBranches],
        });
        continue;
      }

      existing.retrievalBranches = Array.from(
        new Set([...existing.retrievalBranches, ...item.retrievalBranches]),
      );
    }

    return Array.from(merged.values());
  }

  private mergeRestaurants(
    restaurants: AiSearchRestaurantCandidate[],
  ): AiSearchRestaurantCandidate[] {
    const merged = new Map<string, AiSearchRestaurantCandidate>();

    for (const restaurant of restaurants) {
      if (!merged.has(restaurant.id)) merged.set(restaurant.id, restaurant);
    }

    return Array.from(merged.values());
  }

  private rankItems(
    items: AiSearchItemCandidate[],
    intent: AiSearchIntent,
    request: AiSearchRequestDto,
  ): AiSearchItemResult[] {
    return items
      .map((item) => {
        const score = this.scoreItem(item, intent, request);
        return {
          ...item,
          score,
          matchReasons: this.buildItemMatchReasons(item, intent),
        };
      })
      .sort((a, b) => this.compareItems(a, b, intent));
  }

  private rankRestaurants(
    restaurants: AiSearchRestaurantCandidate[],
    intent: AiSearchIntent,
  ): AiSearchRestaurantCandidate[] {
    return restaurants
      .map((restaurant) => ({
        ...restaurant,
        score: this.scoreRestaurant(restaurant, intent),
      }))
      .sort((a, b) => {
        if (intent.sort === 'distance') {
          return compareNullableNumbers(a.distanceKm, b.distanceKm);
        }
        if (intent.sort === 'rating') {
          return (
            Number(b.averageRating ?? 0) - Number(a.averageRating ?? 0) ||
            Number(b.reviewCount ?? 0) - Number(a.reviewCount ?? 0)
          );
        }
        return Number(b.score ?? 0) - Number(a.score ?? 0);
      });
  }

  private scoreItem(
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

  private scoreRestaurant(
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
        ) || b.score - a.score
      );
    }
    if (intent.sort === 'rating') {
      return (
        Number(b.restaurant.averageRating ?? 0) -
          Number(a.restaurant.averageRating ?? 0) ||
        Number(b.restaurant.reviewCount ?? 0) -
          Number(a.restaurant.reviewCount ?? 0) ||
        b.score - a.score
      );
    }
    return b.score - a.score;
  }

  private buildItemMatchReasons(
    item: AiSearchItemCandidate,
    intent: AiSearchIntent,
  ): string[] {
    const reasons: string[] = [];
    const protein = item.nutrition?.protein;

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

    reasons.push('Open now');
    return reasons.slice(0, 4);
  }

  private buildAppliedFilters(
    intent: AiSearchIntent,
    request: AiSearchRequestDto,
    radiusKm: number,
  ): AiSearchAppliedFilter[] {
    const filters: AiSearchAppliedFilter[] = [];

    if (intent.nutrition.proteinMinG !== undefined) {
      filters.push({
        key: 'proteinMinG',
        label: `Protein >= ${intent.nutrition.proteinMinG}g`,
        source: 'ai_inferred',
      });
    }
    if (intent.price.maxPriceVnd !== undefined) {
      filters.push({
        key: 'maxPriceVnd',
        label: `Price <= ${intent.price.maxPriceVnd} VND`,
        source: intent.price.budgetIntent ? 'system_default' : 'ai_inferred',
      });
    }
    if (intent.rating.minAverageRating !== undefined) {
      filters.push({
        key: 'minAverageRating',
        label: `Rating >= ${intent.rating.minAverageRating}`,
        source: 'ai_inferred',
      });
    }
    if (intent.rating.minReviewCount !== undefined) {
      filters.push({
        key: 'minReviewCount',
        label: `Review count >= ${intent.rating.minReviewCount}`,
        source: 'ai_inferred',
      });
    }
    if (request.lat !== undefined && request.lon !== undefined) {
      filters.push({
        key: 'radiusKm',
        label: `Within ${radiusKm} km`,
        source: 'request',
      });
    }

    return filters;
  }

  private buildInterpretation(
    intent: AiSearchIntent,
    request: AiSearchRequestDto,
  ): string {
    const nearby = request.lat !== undefined && request.lon !== undefined;

    if (intent.nutrition.highProtein && nearby) {
      return 'Showing nearby high-protein food options.';
    }
    if (intent.nutrition.highProtein) {
      return 'Showing high-protein food options.';
    }
    if (intent.rating.minAverageRating !== undefined && nearby) {
      return 'Showing nearby food from highly rated restaurants.';
    }
    if (intent.rating.minAverageRating !== undefined) {
      return 'Showing food from highly rated restaurants.';
    }
    if (intent.price.budgetIntent || intent.price.maxPriceVnd !== undefined) {
      return 'Showing budget-friendly food.';
    }
    if (nearby) {
      return 'Showing nearby food matches.';
    }
    return `Showing food matches for "${intent.rewrittenQuery}".`;
  }

  private buildFollowUps(
    intent: AiSearchIntent,
    query: string,
    request: AiSearchRequestDto,
  ): AiSearchFollowUp[] {
    const followUps: AiSearchFollowUp[] = [];

    if (intent.price.maxPriceVnd === undefined) {
      followUps.push({
        label: 'Cheaper',
        query: `${query} under 50000`,
      });
    }
    if (request.lat !== undefined && request.lon !== undefined) {
      followUps.push({
        label: 'Nearer',
        query: `${query} within 2 km`,
      });
    }
    if (intent.nutrition.proteinMinG === undefined) {
      followUps.push({
        label: 'Higher protein',
        query: `high protein ${query}`,
      });
    }
    if (intent.rating.minAverageRating === undefined) {
      followUps.push({
        label: 'Highly rated',
        query: `highly rated ${query}`,
      });
    }

    return followUps.slice(0, 4);
  }

  private recordSearch(response: AiSearchResponse, startedAt: number): void {
    recordAiSearch({
      mode: response.mode,
      fallbackReason: response.fallback?.reason,
      itemCount: response.total.items,
      restaurantCount: response.total.restaurants,
      latencyMs: Date.now() - startedAt,
    });
  }
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

function resolveMinConfidence(): number {
  const raw = Number(process.env.AI_SEARCH_MIN_CONFIDENCE);
  return Number.isFinite(raw) ? raw : AI_SEARCH_MIN_CONFIDENCE;
}
