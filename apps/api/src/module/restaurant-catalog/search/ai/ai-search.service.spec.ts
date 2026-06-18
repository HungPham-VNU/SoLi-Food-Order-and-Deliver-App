import { AiSearchIntentService } from './ai-search-intent.service';
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
  function buildService(candidates: AiSearchItemCandidate[]) {
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

    return {
      service: new AiSearchService(
        repo as any,
        new AiSearchIntentService(),
        standardSearch as any,
      ),
      repo,
      standardSearch,
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

  it('falls back to classic search for low-confidence intent', async () => {
    const { service, standardSearch } = buildService([]);

    const response = await service.search({ query: '???' });

    expect(response.mode).toBe('classic_fallback');
    expect(response.fallback?.reason).toBe('LOW_CONFIDENCE');
    expect(standardSearch.search).toHaveBeenCalledWith(
      '???',
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
});
