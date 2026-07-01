import {
  AiSearchRankingService,
  parseAiSearchRankingWeights,
  scoreFreshness,
  scorePopularity,
} from './ai-search-ranking.service';
import type {
  AiSearchIntent,
  AiSearchItemCandidate,
  AiSearchSort,
} from './ai-search.types';

const now = new Date('2026-06-19T00:00:00.000Z');

function makeIntent(overrides: Partial<AiSearchIntent> = {}): AiSearchIntent {
  return {
    rewrittenQuery: 'chicken rice',
    language: 'en',
    itemKinds: [],
    foodTerms: ['chicken'],
    cuisineTerms: [],
    dietaryTags: [],
    excludedTerms: [],
    nutrition: {},
    price: {},
    rating: {},
    geo: {},
    sort: 'relevance',
    confidence: 1,
    needsFallback: false,
    ...overrides,
  };
}

function makeItem(
  id: string,
  overrides: Partial<AiSearchItemCandidate> = {},
): AiSearchItemCandidate {
  return {
    id,
    name: 'Grilled Chicken Rice',
    description: 'Chicken and rice',
    price: 60_000,
    itemKind: 'food',
    imageUrl: null,
    tags: ['chicken', 'rice'],
    categoryName: 'Rice',
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-10T00:00:00.000Z'),
    score: 0,
    nutrition: {
      calories: 520,
      protein: 42,
      carbs: 60,
      fat: 10,
      verifiedByRestaurant: true,
    },
    retrievalBranches: ['fulltext'],
    branchScores: { fulltext: 1 },
    restaurant: {
      id: 'restaurant-a',
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
      distanceKm: 1,
    },
    ...overrides,
  };
}

describe('AiSearchRankingService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.AI_SEARCH_RANKING_V2_ENABLED = 'true';
    process.env.AI_SEARCH_DIVERSITY_ENABLED = 'true';
    process.env.AI_SEARCH_MAX_ITEMS_PER_RESTAURANT = '2';
    process.env.AI_SEARCH_RANKING_WEIGHTS =
      '{"retrieval":0.35,"nutrition":0.15,"price":0.10,"distance":0.10,"rating":0.10,"popularity":0.10,"freshness":0.05,"availability":0.05}';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('normalizes configured ranking weights', () => {
    expect(
      parseAiSearchRankingWeights(
        '{"retrieval":7,"nutrition":3,"price":2,"distance":2,"rating":2,"popularity":2,"freshness":1,"availability":1}',
      ),
    ).toEqual({
      retrieval: 0.35,
      nutrition: 0.15,
      price: 0.1,
      distance: 0.1,
      rating: 0.1,
      popularity: 0.1,
      freshness: 0.05,
      availability: 0.05,
    });
  });

  it('caps log-scaled popularity and ignores stale stats', () => {
    expect(
      scorePopularity(
        {
          deliveredOrderCount30d: 10_000,
          deliveredOrderCount90d: 50_000,
          orderedQuantity30d: 10_000,
          orderedQuantity90d: 50_000,
          lastOrderedAt: now,
          updatedAt: now,
        },
        now,
      ),
    ).toBe(0.75);

    expect(
      scorePopularity(
        {
          deliveredOrderCount30d: 100,
          deliveredOrderCount90d: 100,
          orderedQuantity30d: 100,
          orderedQuantity90d: 100,
          lastOrderedAt: now,
          updatedAt: new Date('2026-06-15T23:59:59.000Z'),
        },
        now,
      ),
    ).toBe(0);
  });

  it('scores freshness from recent update timestamps with linear decay', () => {
    expect(
      scoreFreshness(
        new Date('2026-06-18T00:00:00.000Z'),
        new Date('2026-01-01T00:00:00.000Z'),
        now,
      ),
    ).toBe(1);
    expect(
      scoreFreshness(
        new Date('2026-03-01T00:00:00.000Z'),
        new Date('2026-01-01T00:00:00.000Z'),
        now,
      ),
    ).toBe(0);
  });

  it('applies restaurant diversity only for relevance sort', () => {
    const service = new AiSearchRankingService();
    const sameRestaurant = Array.from({ length: 4 }, (_, index) =>
      makeItem(`a-${index}`, {
        restaurant: {
          ...makeItem('base').restaurant,
          id: 'restaurant-a',
          averageRating: 4.9,
          reviewCount: 100,
        },
      }),
    );
    const otherRestaurant = makeItem('b-1', {
      branchScores: { fulltext: 0.2 },
      restaurant: {
        ...makeItem('base').restaurant,
        id: 'restaurant-b',
        averageRating: 3.8,
        reviewCount: 5,
      },
    });

    const ranked = service.rankItems(
      [...sameRestaurant, otherRestaurant],
      makeIntent(),
      { query: 'chicken rice' },
      { radiusKm: 5, now },
    );

    expect(ranked.slice(0, 3).map((item) => item.restaurant.id)).toEqual([
      'restaurant-a',
      'restaurant-a',
      'restaurant-b',
    ]);
  });

  it.each<AiSearchSort>(['price_asc', 'distance', 'rating', 'protein_desc'])(
    'does not apply diversity for explicit %s sort',
    (sort) => {
      const service = new AiSearchRankingService();
      const ranked = service.rankItems(
        [
          makeItem('a-1', { price: 10_000 }),
          makeItem('a-2', { price: 20_000 }),
          makeItem('a-3', { price: 30_000 }),
          makeItem('b-1', {
            price: 40_000,
            restaurant: { ...makeItem('base').restaurant, id: 'restaurant-b' },
          }),
        ],
        makeIntent({ sort }),
        { query: 'chicken rice' },
        { radiusKm: 5, now },
      );

      expect(ranked.slice(0, 3).map((item) => item.restaurant.id)).toEqual([
        'restaurant-a',
        'restaurant-a',
        'restaurant-a',
      ]);
    },
  );

  it('keeps ranking changes intentional with a fixed snapshot', () => {
    const service = new AiSearchRankingService();
    const ranked = service.rankItems(
      [
        makeItem('popular', {
          popularity: {
            deliveredOrderCount30d: 30,
            deliveredOrderCount90d: 80,
            orderedQuantity30d: 45,
            orderedQuantity90d: 120,
            lastOrderedAt: now,
            updatedAt: now,
          },
        }),
        makeItem('closer', {
          restaurant: {
            ...makeItem('base').restaurant,
            id: 'restaurant-b',
            distanceKm: 0.2,
          },
          popularity: null,
        }),
        makeItem('old', {
          restaurant: { ...makeItem('base').restaurant, id: 'restaurant-c' },
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          popularity: null,
        }),
      ],
      makeIntent({
        nutrition: { highProtein: true, proteinMinG: 25 },
        price: { maxPriceVnd: 70_000 },
        geo: { nearbyIntent: true },
      }),
      { query: 'high protein chicken nearby', lat: 10.76, lon: 106.66 },
      { radiusKm: 5, now },
    );

    expect(
      ranked.map((item) => ({
        id: item.id,
        score: item.score,
        reasons: item.matchReasons,
      })),
    ).toMatchSnapshot();
  });
});
