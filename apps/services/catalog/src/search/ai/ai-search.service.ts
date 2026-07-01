import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  recordAiSearch,
  recordAiSearchBranch,
  recordAiSearchSemanticFallback,
} from '@/observability/domain-metrics';
import { AiSearchEmbeddingService } from '../indexing/ai-search-embedding.service';
import { normalizeSearchText } from '../indexing/ai-search-document';
import { SearchService } from '../standard/search.service';
import type { AiSearchRequestDto } from './ai-search.dto';
import {
  AiSearchIntentService,
  isGenericFoodSearchQuery,
} from './ai-search-intent.service';
import { AiSearchRankingService } from './ai-search-ranking.service';
import { AiSearchVerificationService } from './ai-search-verification.service';
import { AiSearchRepository } from './ai-search.repository';
import {
  AI_SEARCH_DEFAULT_RADIUS_KM,
  AI_SEARCH_MIN_CONFIDENCE,
  type AiSearchAppliedFilter,
  type AiSearchFallbackReason,
  type AiSearchFollowUp,
  type AiSearchIntent,
  type AiSearchItemKind,
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
const DEFAULT_BUDGET_RELAXATION_MULTIPLIER = 1.2;
const DEFAULT_BUDGET_RELAXATION_INCREMENT_VND = 10_000;

interface QueryEmbeddingState {
  embedding: number[];
  model: string;
  version: string;
}

interface BranchResult<T> {
  branch: AiSearchRetrievalBranch;
  rows: T[];
}

@Injectable()
export class AiSearchService {
  private readonly logger = new Logger(AiSearchService.name);

  constructor(
    private readonly repo: AiSearchRepository,
    private readonly intentService: AiSearchIntentService,
    private readonly standardSearch: SearchService,
    private readonly embeddings: AiSearchEmbeddingService,
    private readonly ranking: AiSearchRankingService,
    private readonly verification: AiSearchVerificationService,
  ) {}

  async search(request: AiSearchRequestDto): Promise<AiSearchResponse> {
    const startedAt = Date.now();
    const query = request.query.trim();
    const limit = Math.min(request.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = Math.max(request.offset ?? 0, 0);
    const radiusKm = request.radiusKm ?? AI_SEARCH_DEFAULT_RADIUS_KM;

    if (!query) {
      return this.emptyAiResponse(
        query,
        'Enter a food search to start.',
        startedAt,
      );
    }

    if ((request.lat === undefined) !== (request.lon === undefined)) {
      throw new BadRequestException(
        'lat and lon must both be provided together for AI search',
      );
    }

    try {
      const intent = await this.intentService.parseIntentWithProvider(query, {
        radiusKm,
      });
      const minConfidence = resolveMinConfidence();

      if (this.shouldFallbackToClassicFoodName(intent, minConfidence)) {
        return this.fallbackToClassic(
          query,
          request,
          'EXACT_FOOD_NAME',
          startedAt,
        );
      }

      if (this.isBelowConfidenceThreshold(intent, minConfidence)) {
        return this.emptyAiResponse(
          query,
          'No clear food matches found.',
          startedAt,
        );
      }

      const normalizedQuery = normalizeSearchText(
        intent.rewrittenQuery || query,
      );
      const genericFoodBrowse = this.isGenericFoodBrowseIntent(intent, query);
      const queryEmbedding = genericFoodBrowse
        ? null
        : await this.resolveQueryEmbedding(intent.rewrittenQuery || query);
      const branches = this.buildRetrievalBranches(intent, request, {
        genericFoodBrowse,
        hasSemantic: Boolean(queryEmbedding),
        normalizedQuery,
      });
      const branchLimit = Math.min(
        MAX_BRANCH_ROWS,
        Math.max(limit * 4, DEFAULT_PAGE_SIZE),
      );
      const branchFilters = this.buildRepositoryFilters({
        intent,
        branches,
        query,
        normalizedQuery,
        queryEmbedding,
        request,
        radiusKm,
        branchLimit,
      });

      const [initialItemBranches, restaurantBranches] = await Promise.all([
        Promise.all(
          branchFilters.map((filters) => this.findItemsForBranch(filters)),
        ),
        Promise.all(
          branchFilters
            .filter((filters) => this.shouldRetrieveRestaurants(filters))
            .map((filters) => this.findRestaurantsForBranch(filters)),
        ),
      ]);
      let itemBranches = initialItemBranches;
      let effectiveIntent = intent;

      if (this.shouldRelaxDefaultBudgetForItems(intent, query, itemBranches)) {
        const relaxedIntent = relaxDefaultBudgetIntent(intent);
        const relaxedBranches = this.buildRetrievalBranches(
          relaxedIntent,
          request,
          {
            genericFoodBrowse: false,
            hasSemantic: Boolean(queryEmbedding),
            normalizedQuery,
          },
        );
        const relaxedBranchFilters = this.buildRepositoryFilters({
          intent: relaxedIntent,
          branches: relaxedBranches,
          query,
          normalizedQuery,
          queryEmbedding,
          request,
          radiusKm,
          branchLimit,
        });
        const relaxedItemBranches = await Promise.all(
          relaxedBranchFilters.map((filters) =>
            this.findItemsForBranch(filters),
          ),
        );

        if (relaxedItemBranches.some((result) => result.rows.length > 0)) {
          effectiveIntent = relaxedIntent;
          itemBranches = relaxedItemBranches;
        }
      }

      this.recordSemanticFallback(branches, itemBranches, restaurantBranches);

      const rankedItems = this.ranking.rankItems(
        this.mergeItems(itemBranches.flatMap((result) => result.rows)),
        effectiveIntent,
        request,
        { radiusKm },
      );
      const rankedRestaurants = this.ranking.rankRestaurants(
        this.mergeRestaurants(
          restaurantBranches.flatMap((result) => result.rows),
        ),
        effectiveIntent,
        { radiusKm },
      );

      const requiresSemanticVerification =
        this.verification.requiresVerification(effectiveIntent);
      const verifiedItems = await this.verifyRankedItems(
        query,
        effectiveIntent,
        rankedItems,
        offset + limit,
        new Set(rankedRestaurants.map((restaurant) => restaurant.id)),
      );
      const verifiedRestaurantIds = new Set(
        verifiedItems.map((item) => item.restaurant.id),
      );
      const verifiedRestaurants = requiresSemanticVerification
        ? rankedRestaurants.filter((restaurant) =>
            verifiedRestaurantIds.has(restaurant.id),
          )
        : rankedRestaurants;

      const items = verifiedItems.slice(offset, offset + limit);
      const restaurants = verifiedRestaurants.slice(offset, offset + limit);
      const response: AiSearchResponse = {
        mode: 'ai',
        query,
        interpretation: this.buildInterpretation(effectiveIntent, request),
        appliedFilters: this.buildAppliedFilters(
          effectiveIntent,
          request,
          radiusKm,
        ),
        restaurants,
        items,
        total: {
          restaurants: verifiedRestaurants.length,
          items: verifiedItems.length,
        },
        followUps: this.buildFollowUps(effectiveIntent, query, request),
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
      return this.emptyAiResponse(
        query,
        'AI search is unavailable right now.',
        startedAt,
      );
    }
  }

  private async verifyRankedItems(
    query: string,
    intent: AiSearchIntent,
    rankedItems: AiSearchItemResult[],
    requiredResultCount: number,
    candidateRestaurantIds: Set<string>,
  ): Promise<AiSearchItemResult[]> {
    if (!this.verification.requiresVerification(intent)) return rankedItems;

    const verifiedItems: AiSearchItemResult[] = [];
    const verifiedRestaurantIds = new Set<string>();
    const requiredRestaurantCount = Math.min(
      requiredResultCount,
      candidateRestaurantIds.size,
    );
    const batchSize = this.verification.getBatchSize();

    for (let start = 0; start < rankedItems.length; start += batchSize) {
      const batch = rankedItems.slice(start, start + batchSize);
      const result = await this.verification.verifyCandidates(
        query,
        intent,
        batch,
      );

      if (result.status === 'skipped') return rankedItems;

      for (const item of batch) {
        if (!result.acceptedItemIds.has(item.id)) continue;
        verifiedItems.push(item);
        if (candidateRestaurantIds.has(item.restaurant.id)) {
          verifiedRestaurantIds.add(item.restaurant.id);
        }
      }

      if (result.status === 'failed') {
        if (result.strict) return [];
        return [...verifiedItems, ...rankedItems.slice(start + batch.length)];
      }

      if (
        verifiedItems.length >= requiredResultCount &&
        verifiedRestaurantIds.size >= requiredRestaurantCount
      ) {
        break;
      }
    }

    return verifiedItems;
  }

  private shouldFallbackToClassicFoodName(
    intent: AiSearchIntent,
    minConfidence: number,
  ): boolean {
    return (
      Boolean(intent.foodNameOnly) &&
      !this.isBelowConfidenceThreshold(intent, minConfidence)
    );
  }

  private isBelowConfidenceThreshold(
    intent: AiSearchIntent,
    minConfidence: number,
  ): boolean {
    return intent.needsFallback || intent.confidence < minConfidence;
  }

  private emptyAiResponse(
    query: string,
    interpretation: string,
    startedAt: number,
  ): AiSearchResponse {
    const response: AiSearchResponse = {
      mode: 'ai',
      query,
      interpretation,
      appliedFilters: [],
      restaurants: [],
      items: [],
      total: {
        restaurants: 0,
        items: 0,
      },
      followUps: [],
      fallback: null,
    };

    this.recordSearch(response, startedAt);
    return response;
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

  private buildRepositoryFilters(options: {
    intent: AiSearchIntent;
    branches: AiSearchRetrievalBranch[];
    query: string;
    normalizedQuery: string;
    queryEmbedding: QueryEmbeddingState | null;
    request: AiSearchRequestDto;
    radiusKm: number;
    branchLimit: number;
  }): AiSearchRepositoryFilters[] {
    return options.branches.map(
      (branch): AiSearchRepositoryFilters => ({
        intent: options.intent,
        branch,
        query: options.query,
        normalizedQuery: options.normalizedQuery,
        queryEmbedding: options.queryEmbedding?.embedding,
        embeddingModel: options.queryEmbedding?.model,
        embeddingVersion: options.queryEmbedding?.version,
        lat: options.request.lat,
        lon: options.request.lon,
        radiusKm: options.radiusKm,
        limit: options.branchLimit,
      }),
    );
  }

  private isGenericFoodBrowseIntent(
    intent: AiSearchIntent,
    query: string,
  ): boolean {
    return (
      isGenericFoodSearchQuery(query) &&
      intent.foodTerms.length === 0 &&
      intent.dietaryTags.length === 0 &&
      intent.cuisineTerms.length === 0 &&
      intent.nutrition.proteinMinG === undefined &&
      !intent.nutrition.lowerCalorie &&
      intent.nutrition.caloriesMax === undefined &&
      intent.nutrition.fatMaxG === undefined &&
      intent.nutrition.carbsMaxG === undefined &&
      intent.price.maxPriceVnd === undefined &&
      intent.price.minPriceVnd === undefined &&
      intent.rating.minAverageRating === undefined &&
      intent.rating.minReviewCount === undefined
    );
  }

  private shouldRelaxDefaultBudgetForItems(
    intent: AiSearchIntent,
    query: string,
    itemBranches: BranchResult<AiSearchItemCandidate>[],
  ): boolean {
    return (
      !itemBranches.some((result) => result.rows.length > 0) &&
      Boolean(intent.price.budgetIntent) &&
      intent.price.maxPriceVnd !== undefined &&
      intent.nutrition.proteinMinG !== undefined &&
      !hasExplicitPriceConstraint(query)
    );
  }

  private buildRetrievalBranches(
    intent: AiSearchIntent,
    request: AiSearchRequestDto,
    options: {
      genericFoodBrowse: boolean;
      hasSemantic: boolean;
      normalizedQuery: string;
    },
  ): AiSearchRetrievalBranch[] {
    const branches = new Set<AiSearchRetrievalBranch>();
    const hasTerms =
      intent.foodTerms.length > 0 ||
      intent.dietaryTags.length > 0 ||
      intent.cuisineTerms.length > 0;

    if (options.genericFoodBrowse) {
      branches.add('lexical');
    } else if (options.normalizedQuery.length > 0) {
      branches.add('fulltext');
      branches.add('trigram');
      if (options.hasSemantic) branches.add('semantic');
    }
    if (hasTerms) {
      branches.add('lexical');
      branches.add('tag');
    }
    if (
      intent.nutrition.lowerCalorie ||
      intent.nutrition.proteinMinG !== undefined ||
      intent.nutrition.caloriesMax !== undefined ||
      intent.nutrition.fatMaxG !== undefined ||
      intent.nutrition.carbsMaxG !== undefined
    ) {
      branches.add('nutrition');
    }
    if (intent.price.maxPriceVnd !== undefined) branches.add('price');
    if (intent.rating.minAverageRating !== undefined) branches.add('rating');
    if (request.lat !== undefined && request.lon !== undefined)
      branches.add('geo');

    if (branches.size === 0 && options.normalizedQuery.length > 0) {
      branches.add('fulltext');
      branches.add('trigram');
    }
    if (branches.size === 0) branches.add('lexical');
    return Array.from(branches);
  }

  private shouldRetrieveRestaurants(
    filters: AiSearchRepositoryFilters,
  ): boolean {
    return (
      filters.branch === 'lexical' ||
      filters.branch === 'fulltext' ||
      filters.branch === 'trigram' ||
      filters.branch === 'semantic' ||
      filters.branch === 'tag' ||
      filters.branch === 'nutrition' ||
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
      existing.branchScores = mergeBranchScores(
        existing.branchScores,
        item.branchScores,
      );
    }

    return Array.from(merged.values());
  }

  private mergeRestaurants(
    restaurants: AiSearchRestaurantCandidate[],
  ): AiSearchRestaurantCandidate[] {
    const merged = new Map<string, AiSearchRestaurantCandidate>();

    for (const restaurant of restaurants) {
      const existing = merged.get(restaurant.id);
      if (!existing) {
        merged.set(restaurant.id, {
          ...restaurant,
          retrievalBranches: [...(restaurant.retrievalBranches ?? [])],
        });
        continue;
      }

      existing.retrievalBranches = Array.from(
        new Set([
          ...(existing.retrievalBranches ?? []),
          ...(restaurant.retrievalBranches ?? []),
        ]),
      );
      existing.branchScores = mergeBranchScores(
        existing.branchScores,
        restaurant.branchScores,
      );
    }

    return Array.from(merged.values());
  }

  private buildAppliedFilters(
    intent: AiSearchIntent,
    request: AiSearchRequestDto,
    radiusKm: number,
  ): AiSearchAppliedFilter[] {
    const filters: AiSearchAppliedFilter[] = [];

    if (intent.itemKinds.length > 0) {
      filters.push({
        key: 'itemKinds',
        label:
          intent.itemKinds.length === 1
            ? `${formatItemKind(intent.itemKinds[0])} only`
            : intent.itemKinds.map(formatItemKind).join(' or '),
        source: 'ai_inferred',
      });
    }

    if (intent.dietaryTags.length > 0) {
      filters.push({
        key: 'dietaryTags',
        label: `Dietary tags: ${intent.dietaryTags.join(', ')}`,
        source: 'ai_inferred',
      });
    }

    if (intent.excludedTerms.length > 0) {
      filters.push({
        key: 'excludedTerms',
        label: `Excluding: ${intent.excludedTerms.join(', ')}`,
        source: 'ai_inferred',
      });
    }

    if (intent.nutrition.lowerCalorie) {
      filters.push({
        key: 'lowerCalorie',
        label: 'Verified nutrition, lowest calories first',
        source: 'ai_inferred',
      });
    }

    if (intent.nutrition.proteinMinG !== undefined) {
      filters.push({
        key: 'proteinMinG',
        label: `Protein >= ${intent.nutrition.proteinMinG}g`,
        source: 'ai_inferred',
      });
    }
    if (intent.nutrition.caloriesMax !== undefined) {
      filters.push({
        key: 'caloriesMax',
        label: `Calories <= ${intent.nutrition.caloriesMax} kcal`,
        source: 'ai_inferred',
      });
    }
    if (intent.nutrition.fatMaxG !== undefined) {
      filters.push({
        key: 'fatMaxG',
        label: `Fat <= ${intent.nutrition.fatMaxG}g`,
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
    if (intent.price.minPriceVnd !== undefined) {
      filters.push({
        key: 'minPriceVnd',
        label: `Price >= ${intent.price.minPriceVnd} VND`,
        source: 'ai_inferred',
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

    if (intent.nutrition.lowerCalorie) {
      const kind =
        intent.itemKinds.length === 1
          ? formatItemKind(intent.itemKinds[0]).toLowerCase()
          : 'items';
      return `Showing ${kind} with verified nutrition, ordered by calories per serving.`;
    }

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

  private async resolveQueryEmbedding(
    query: string,
  ): Promise<QueryEmbeddingState | null> {
    try {
      const config = this.embeddings.getConfig();
      const embedding = await this.embeddings.embedSearchDocument(query);
      return {
        embedding,
        model: config.model,
        version: config.version,
      };
    } catch (error) {
      recordAiSearchSemanticFallback('query_embedding_failed');
      this.logger.debug(
        `AI search semantic branch disabled: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private async findItemsForBranch(
    filters: AiSearchRepositoryFilters,
  ): Promise<BranchResult<AiSearchItemCandidate>> {
    const startedAt = Date.now();
    const rows = await this.repo.findItems(filters);
    recordAiSearchBranch({
      branch: filters.branch,
      target: 'items',
      hitCount: rows.length,
      latencyMs: Date.now() - startedAt,
    });
    return { branch: filters.branch, rows };
  }

  private async findRestaurantsForBranch(
    filters: AiSearchRepositoryFilters,
  ): Promise<BranchResult<AiSearchRestaurantCandidate>> {
    const startedAt = Date.now();
    const rows = await this.repo.findRestaurants(filters);
    recordAiSearchBranch({
      branch: filters.branch,
      target: 'restaurants',
      hitCount: rows.length,
      latencyMs: Date.now() - startedAt,
    });
    return { branch: filters.branch, rows };
  }

  private recordSemanticFallback(
    branches: AiSearchRetrievalBranch[],
    itemBranches: BranchResult<AiSearchItemCandidate>[],
    restaurantBranches: BranchResult<AiSearchRestaurantCandidate>[],
  ): void {
    if (!branches.includes('semantic')) return;

    const semanticHits = [...itemBranches, ...restaurantBranches]
      .filter((result) => result.branch === 'semantic')
      .reduce((total, result) => total + result.rows.length, 0);
    if (semanticHits === 0) {
      recordAiSearchSemanticFallback('no_fresh_results');
    }
  }
}

function relaxDefaultBudgetIntent(intent: AiSearchIntent): AiSearchIntent {
  const maxPriceVnd = intent.price.maxPriceVnd;
  if (maxPriceVnd === undefined) return intent;

  const relaxedMaxPriceVnd = roundUpToNearestThousand(
    Math.max(
      maxPriceVnd * DEFAULT_BUDGET_RELAXATION_MULTIPLIER,
      maxPriceVnd + DEFAULT_BUDGET_RELAXATION_INCREMENT_VND,
    ),
  );

  return {
    ...intent,
    price: {
      ...intent.price,
      maxPriceVnd: relaxedMaxPriceVnd,
    },
  };
}

function hasExplicitPriceConstraint(query: string): boolean {
  const normalized = query.toLowerCase();
  return (
    /\b(?:under|below|less than|max|maximum|duoi)\s*\d[\d.,]*\s*(k|nghin|ngan|vnd)?\b/.test(
      normalized,
    ) || /<=?\s*\d[\d.,]*\s*(k|nghin|ngan|vnd)?\b/.test(normalized)
  );
}

function roundUpToNearestThousand(value: number): number {
  return Math.ceil(value / 1000) * 1000;
}

function resolveMinConfidence(): number {
  const raw = Number(process.env.AI_SEARCH_MIN_CONFIDENCE);
  return Number.isFinite(raw) ? raw : AI_SEARCH_MIN_CONFIDENCE;
}

function mergeBranchScores(
  existing: Partial<Record<AiSearchRetrievalBranch, number>> | undefined,
  incoming: Partial<Record<AiSearchRetrievalBranch, number>> | undefined,
): Partial<Record<AiSearchRetrievalBranch, number>> {
  const merged = { ...(existing ?? {}) };

  for (const [branch, score] of Object.entries(incoming ?? {}) as [
    AiSearchRetrievalBranch,
    number,
  ][]) {
    merged[branch] = Math.max(merged[branch] ?? 0, score);
  }

  return merged;
}

function formatItemKind(kind: AiSearchItemKind): string {
  if (kind === 'food') return 'Food';
  if (kind === 'beverage') return 'Beverage';
  return 'Food + beverage';
}
