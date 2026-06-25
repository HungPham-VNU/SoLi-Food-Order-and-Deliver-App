import { AiSearchIntentService } from './ai-search-intent.service';
import { AiSearchRankingService } from './ai-search-ranking.service';
import { AiSearchService } from './ai-search.service';
import type {
  AiSearchItemCandidate,
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
  ) {
    const repo = {
      findItems: jest.fn(async (filters: AiSearchRepositoryFilters) =>
        candidates
          .filter((item) => {
            const maxPrice = filters.intent.price.maxPriceVnd;
            const proteinMin = filters.intent.nutrition.proteinMinG;
            return (
              (maxPrice === undefined || item.price <= maxPrice) &&
              (proteinMin === undefined ||
                Number(item.nutrition?.protein ?? 0) >= proteinMin)
            );
          })
          .map((item) => ({
            ...item,
            retrievalBranches: [filters.branch],
          })),
      ),
      findRestaurants: jest.fn(async () => [makeRestaurant({})]),
    };
    const standardSearch = {
      search: jest.fn(async () => ({
        restaurants: [],
        items: [],
        total: { restaurants: 0, items: 0 },
      })),
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
      embedSearchDocument: jest.fn(async () => {
        if (!embedding) throw new Error('embeddings unavailable');
        return embedding;
      }),
    };

    return {
      service: new AiSearchService(
        repo as any,
        new AiSearchIntentService(),
        standardSearch as any,
        embeddings as any,
        ranking,
      ),
      repo,
      standardSearch,
      embeddings,
      ranking,
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
});
