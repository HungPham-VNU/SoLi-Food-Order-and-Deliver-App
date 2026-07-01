import type { AiSearchEmbeddingService } from '../indexing/ai-search-embedding.service';
import type { SearchService } from '../standard/search.service';
import { AiSearchIntentService } from './ai-search-intent.service';
import { AiSearchRankingService } from './ai-search-ranking.service';
import { AiSearchService } from './ai-search.service';
import type {
  AiSearchVerificationResult,
  AiSearchVerificationService,
} from './ai-search-verification.service';
import type { AiSearchRepository } from './ai-search.repository';
import type {
  AiSearchIntent,
  AiSearchItemCandidate,
  AiSearchItemResult,
  AiSearchRepositoryFilters,
  AiSearchRestaurantCandidate,
} from './ai-search.types';

const now = new Date('2026-01-01T00:00:00.000Z');

function makeItem(
  overrides: Partial<AiSearchItemCandidate>,
): AiSearchItemCandidate {
  return {
    id: 'item-1',
    name: 'Grilled Chicken Rice',
    description: 'Chicken and rice',
    price: 65_000,
    itemKind: 'food',
    imageUrl: null,
    tags: ['chicken', 'rice', 'grilled'],
    categoryName: 'Rice',
    score: 0,
    nutrition: {
      calories: 520,
      protein: 42,
      carbs: 60,
      fat: 10,
      verifiedByRestaurant: true,
    },
    retrievalBranches: ['nutrition'],
    restaurant: {
      id: 'restaurant-1',
      name: 'Healthy Bowl',
      address: 'District 1',
      cuisineType: 'Vietnamese',
      logoUrl: null,
      coverImageUrl: null,
      averageRating: 4.6,
      ratingSum: 46,
      reviewCount: 10,
      latitude: 10.76,
      longitude: 106.66,
      distanceKm: 1.2,
    },
    ...overrides,
  };
}

function makeRestaurant(
  overrides: Partial<AiSearchRestaurantCandidate>,
): AiSearchRestaurantCandidate {
  return {
    id: 'restaurant-1',
    name: 'Healthy Bowl',
    description: 'Healthy rice bowls',
    address: 'District 1',
    phone: '+84-28-1234-5678',
    isOpen: true,
    latitude: 10.76,
    longitude: 106.66,
    cuisineType: 'Vietnamese',
    logoUrl: null,
    coverImageUrl: null,
    averageRating: 4.6,
    ratingSum: 46,
    reviewCount: 10,
    distanceKm: 1.2,
    score: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('AiSearchService', () => {
  const originalMinConfidence = process.env.AI_SEARCH_MIN_CONFIDENCE;

  beforeEach(() => {
    delete process.env.AI_SEARCH_MIN_CONFIDENCE;
  });

  afterEach(() => {
    if (originalMinConfidence === undefined) {
      delete process.env.AI_SEARCH_MIN_CONFIDENCE;
    } else {
      process.env.AI_SEARCH_MIN_CONFIDENCE = originalMinConfidence;
    }
  });

  function buildService(
    candidates: AiSearchItemCandidate[],
    embedding: number[] | null = null,
    ranking: AiSearchRankingService = new AiSearchRankingService(),
    verificationOverrides: Partial<{
      requiresVerification: (intent: AiSearchIntent) => boolean;
      getBatchSize: () => number;
      verifyCandidates: (
        query: string,
        intent: AiSearchIntent,
        items: AiSearchItemResult[],
      ) => Promise<AiSearchVerificationResult>;
    }> = {},
  ) {
    const repo = {
      findItems: jest.fn((filters: AiSearchRepositoryFilters) =>
        Promise.resolve(
          candidates
            .filter((item) => {
              const maxPrice = filters.intent.price.maxPriceVnd;
              const minPrice = filters.intent.price.minPriceVnd;
              const proteinMin = filters.intent.nutrition.proteinMinG;
              const caloriesMax = filters.intent.nutrition.caloriesMax;
              const fatMax = filters.intent.nutrition.fatMaxG;
              const itemKinds = filters.intent.itemKinds;
              const needsNutrition =
                Boolean(filters.intent.nutrition.lowerCalorie) ||
                proteinMin !== undefined ||
                filters.intent.nutrition.caloriesMax !== undefined ||
                filters.intent.nutrition.fatMaxG !== undefined ||
                filters.intent.nutrition.carbsMaxG !== undefined;
              return (
                (maxPrice === undefined || item.price <= maxPrice) &&
                (minPrice === undefined || item.price >= minPrice) &&
                (itemKinds.length === 0 || itemKinds.includes(item.itemKind)) &&
                (!needsNutrition ||
                  item.nutrition?.verifiedByRestaurant === true) &&
                (proteinMin === undefined ||
                  Number(item.nutrition?.protein ?? 0) >= proteinMin) &&
                (caloriesMax === undefined ||
                  Number(item.nutrition?.calories ?? 0) <= caloriesMax) &&
                (fatMax === undefined ||
                  Number(item.nutrition?.fat ?? 0) <= fatMax)
              );
            })
            .map((item) => ({
              ...item,
              retrievalBranches: [filters.branch],
            })),
        ),
      ),
      findRestaurants: jest.fn(() => Promise.resolve([makeRestaurant({})])),
    };
    const standardSearch = {
      search: jest.fn(() =>
        Promise.resolve({
          restaurants: [],
          items: [],
          total: { restaurants: 0, items: 0 },
        }),
      ),
    };
    const embeddings = {
      getConfig: jest.fn(() => ({
        model: 'embeddinggemma',
        version: '1',
        dimensions: 768,
        timeoutMs: 8000,
        workerEnabled: false,
        batchSize: 20,
        rateLimitPerMinute: 60,
      })),
      embedSearchDocument: jest.fn(() =>
        embedding
          ? Promise.resolve(embedding)
          : Promise.reject(new Error('embeddings unavailable')),
      ),
    };
    const verification = {
      requiresVerification: jest.fn(
        (intent: AiSearchIntent) =>
          intent.dietaryTags.length > 0 ||
          intent.excludedTerms.length > 0 ||
          (intent.semanticConstraints?.length ?? 0) > 0,
      ),
      getBatchSize: jest.fn(() => 40),
      verifyCandidates: jest.fn(
        (
          _query: string,
          _intent: AiSearchIntent,
          items: AiSearchItemResult[],
        ) =>
          Promise.resolve({
            status: 'success' as const,
            strict: false,
            acceptedItemIds: new Set(items.map((item) => item.id)),
            rejectedItemIds: new Set<string>(),
            unknownItemIds: new Set<string>(),
          }),
      ),
      ...verificationOverrides,
    };

    return {
      service: new AiSearchService(
        repo as unknown as AiSearchRepository,
        new AiSearchIntentService(),
        standardSearch as unknown as SearchService,
        embeddings as unknown as AiSearchEmbeddingService,
        ranking,
        verification as unknown as AiSearchVerificationService,
      ),
      repo,
      standardSearch,
      embeddings,
      ranking,
      verification,
    };
  }

  it('ranks higher-protein items first and returns factual reasons', async () => {
    const highProtein = makeItem({
      id: 'item-high',
      name: 'Grilled Chicken Rice',
      nutrition: {
        calories: 520,
        protein: 42,
        carbs: 60,
        fat: 10,
        verifiedByRestaurant: true,
      },
    });
    const lowerProtein = makeItem({
      id: 'item-low',
      name: 'Chicken Salad',
      nutrition: {
        calories: 320,
        protein: 28,
        carbs: 20,
        fat: 8,
        verifiedByRestaurant: true,
      },
    });
    const { service } = buildService([lowerProtein, highProtein]);

    const response = await service.search({ query: 'high protein food' });

    expect(response.mode).toBe('ai');
    expect(response.items.map((item) => item.id)).toEqual([
      'item-high',
      'item-low',
    ]);
    expect(response.items[0].matchReasons).toContain('42g protein');
  });

  it('keeps budget results under the inferred price cap', async () => {
    const cheap = makeItem({
      id: 'item-cheap',
      price: 35_000,
      nutrition: null,
    });
    const expensive = makeItem({
      id: 'item-expensive',
      price: 90_000,
      nutrition: null,
    });
    const { service } = buildService([expensive, cheap]);

    const response = await service.search({ query: 'budget food' });

    expect(response.items.map((item) => item.id)).toEqual(['item-cheap']);
    expect(response.items[0].matchReasons).toContain('Under 50000 VND');
  });

  it('browses menu items for generic food queries instead of falling back', async () => {
    const item = makeItem({ id: 'item-food', name: 'Chicken Rice' });
    const { service, standardSearch } = buildService([item]);

    const response = await service.search({ query: 'Food' });

    expect(response.mode).toBe('ai');
    expect(response.items.map((result) => result.id)).toEqual(['item-food']);
    expect(standardSearch.search).not.toHaveBeenCalled();
  });

  it('browses only beverages for a generic drink query', async () => {
    const food = makeItem({ id: 'food', itemKind: 'food' });
    const beverage = makeItem({
      id: 'beverage',
      itemKind: 'beverage',
      name: 'Iced Tea',
    });
    const { service } = buildService([food, beverage]);

    const response = await service.search({ query: 'drink' });

    expect(response.items.map((item) => item.id)).toEqual(['beverage']);
  });

  it('returns only verified food ordered by calories for weight-loss intent', async () => {
    const higherCalorieFood = makeItem({
      id: 'food-higher',
      nutrition: {
        calories: 520,
        protein: 30,
        carbs: 60,
        fat: 12,
        verifiedByRestaurant: true,
      },
    });
    const lowerCalorieFood = makeItem({
      id: 'food-lower',
      nutrition: {
        calories: 280,
        protein: 20,
        carbs: 35,
        fat: 7,
        verifiedByRestaurant: true,
      },
    });
    const beverage = makeItem({
      id: 'beverage',
      itemKind: 'beverage',
      nutrition: {
        calories: 80,
        protein: 0,
        carbs: 20,
        fat: 0,
        verifiedByRestaurant: true,
      },
    });
    const missingNutrition = makeItem({
      id: 'food-without-nutrition',
      nutrition: null,
    });
    const { service } = buildService([
      higherCalorieFood,
      beverage,
      missingNutrition,
      lowerCalorieFood,
    ]);

    const response = await service.search({ query: 'food for weight lost' });

    expect(response.items.map((item) => item.id)).toEqual(['food-lower']);
    expect(response.items[0].matchReasons).toContain('280 kcal per serving');
    expect(response.appliedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'itemKinds', label: 'Food only' }),
        expect.objectContaining({ key: 'lowerCalorie' }),
      ]),
    );
  });

  it('relaxes the default budget cap when budget high-protein results would otherwise be empty', async () => {
    const nearBudgetHighProtein = makeItem({
      id: 'item-near-budget-high-protein',
      price: 54_000,
      nutrition: {
        calories: 460,
        protein: 38,
        carbs: 52,
        fat: 9,
        verifiedByRestaurant: true,
      },
    });
    const expensiveHighProtein = makeItem({
      id: 'item-expensive-high-protein',
      price: 68_000,
      nutrition: {
        calories: 520,
        protein: 42,
        carbs: 60,
        fat: 10,
        verifiedByRestaurant: true,
      },
    });
    const { service, standardSearch } = buildService([
      expensiveHighProtein,
      nearBudgetHighProtein,
    ]);

    const response = await service.search({
      query: 'Budget high protein food',
    });

    expect(response.mode).toBe('ai');
    expect(response.items.map((item) => item.id)).toEqual([
      'item-near-budget-high-protein',
    ]);
    expect(response.appliedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'maxPriceVnd',
          label: 'Price <= 60000 VND',
        }),
      ]),
    );
    expect(standardSearch.search).not.toHaveBeenCalled();
  });

  it('falls back to classic search for a confident bare food name', async () => {
    const { service, standardSearch } = buildService([]);

    const response = await service.search({ query: 'pho' });

    expect(response.mode).toBe('classic_fallback');
    expect(response.fallback?.reason).toBe('EXACT_FOOD_NAME');
    expect(standardSearch.search).toHaveBeenCalledWith(
      'pho',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });

  it('keeps AI mode for food names with additional query intent', async () => {
    const item = makeItem({ id: 'item-pho', name: 'Pho Ga' });
    const { service, standardSearch } = buildService([item]);

    const response = await service.search({ query: 'high protein pho' });

    expect(response.mode).toBe('ai');
    expect(response.items.map((result) => result.id)).toEqual(['item-pho']);
    expect(standardSearch.search).not.toHaveBeenCalled();
  });

  it('keeps low-confidence non-food-name queries in AI mode without broad retrieval', async () => {
    const item = makeItem({ id: 'item-food', name: 'Chicken Rice' });
    const { service, repo, standardSearch } = buildService([item]);

    const response = await service.search({ query: '???' });

    expect(response.mode).toBe('ai');
    expect(response.total).toEqual({ restaurants: 0, items: 0 });
    expect(response.fallback).toBeNull();
    expect(repo.findItems).not.toHaveBeenCalled();
    expect(standardSearch.search).not.toHaveBeenCalled();
  });

  it('uses the confidence threshold before falling back for a bare food name', async () => {
    process.env.AI_SEARCH_MIN_CONFIDENCE = '0.95';
    const { service, standardSearch } = buildService([]);

    const response = await service.search({ query: 'bun bo' });

    expect(response.mode).toBe('ai');
    expect(response.fallback).toBeNull();
    expect(standardSearch.search).not.toHaveBeenCalled();
  });

  it('delegates merged candidate ordering to the ranking service', async () => {
    const ranking = new AiSearchRankingService();
    const rankItemsSpy = jest.spyOn(ranking, 'rankItems');
    const rankRestaurantsSpy = jest.spyOn(ranking, 'rankRestaurants');
    const { service } = buildService(
      [makeItem({ id: 'item-ranking', name: 'Chicken Rice' })],
      null,
      ranking,
    );

    await service.search({ query: 'high protein chicken rice' });

    expect(rankItemsSpy).toHaveBeenCalled();
    expect(rankRestaurantsSpy).toHaveBeenCalled();
  });

  it('adds the semantic branch when query embeddings are available', async () => {
    const item = makeItem({ id: 'item-semantic', name: 'Chicken Rice' });
    const queryEmbedding = Array.from({ length: 768 }, (_, index) =>
      index === 0 ? 1 : 0,
    );
    const { service, repo } = buildService([item], queryEmbedding);

    await service.search({ query: 'best chicken rice' });

    expect(repo.findItems).toHaveBeenCalledWith(
      expect.objectContaining({
        branch: 'semantic',
        queryEmbedding,
        embeddingModel: 'embeddinggemma',
        embeddingVersion: '1',
      }),
    );
  });

  it('verifies additional batches instead of admitting an unverified tail', async () => {
    const candidates = Array.from({ length: 60 }, (_, index) =>
      makeItem({
        id: `item-${index.toString().padStart(2, '0')}`,
        name: `Healthy Bowl ${index.toString().padStart(2, '0')}`,
      }),
    );
    let callCount = 0;
    const verifyCandidates = jest.fn(
      (
        _query: string,
        _intent: AiSearchIntent,
        items: AiSearchItemResult[],
      ) => {
        const accepted = callCount++ === 0 ? items.slice(0, 10) : items;
        return Promise.resolve({
          status: 'success' as const,
          strict: false,
          acceptedItemIds: new Set(accepted.map((item) => item.id)),
          rejectedItemIds: new Set<string>(),
          unknownItemIds: new Set<string>(),
        });
      },
    );
    const { service } = buildService(candidates, null, undefined, {
      verifyCandidates,
    });

    const response = await service.search({
      query: 'healthy food',
      limit: 20,
    });

    expect(verifyCandidates).toHaveBeenCalledTimes(2);
    expect(response.items).toHaveLength(20);
  });

  it('fails closed when strict semantic verification fails', async () => {
    const { service } = buildService(
      [makeItem({ id: 'possibly-non-vegan', tags: ['vegan'] })],
      null,
      undefined,
      {
        verifyCandidates: jest.fn(() =>
          Promise.resolve({
            status: 'failed' as const,
            strict: true,
            acceptedItemIds: new Set<string>(),
            rejectedItemIds: new Set(['possibly-non-vegan']),
            unknownItemIds: new Set(['possibly-non-vegan']),
          }),
        ),
      },
    );

    const response = await service.search({ query: 'vegan food' });

    expect(response.items).toEqual([]);
    expect(response.restaurants).toEqual([]);
  });
});
