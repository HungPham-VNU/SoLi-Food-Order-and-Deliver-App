import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { OllamaAiProvider } from '@/lib/ai/ollama-ai.provider';
import { AiSearchIntentService } from './ai-search-intent.service';

describe('AiSearchIntentService', () => {
  let service: AiSearchIntentService;

  beforeEach(() => {
    service = new AiSearchIntentService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('parses high protein food with the default protein threshold', () => {
    const intent = service.parseIntent('high protein food');

    expect(intent.nutrition.highProtein).toBe(true);
    expect(intent.nutrition.proteinMinG).toBe(25);
    expect(intent.sort).toBe('protein_desc');
    expect(intent.foodNameOnly).toBe(false);
    expect(intent.itemKinds).toEqual(['food']);
    expect(intent.needsFallback).toBe(false);
  });

  it('parses highly rated nearby food with rating and geo defaults', () => {
    const intent = service.parseIntent('highly rated food nearby', {
      radiusKm: 5,
    });

    expect(intent.rating.minAverageRating).toBe(4.3);
    expect(intent.rating.minReviewCount).toBe(3);
    expect(intent.geo.nearbyIntent).toBe(true);
    expect(intent.geo.radiusKm).toBe(5);
  });

  it('parses budget food with the default VND cap', () => {
    const intent = service.parseIntent('budget food');

    expect(intent.price.budgetIntent).toBe(true);
    expect(intent.price.maxPriceVnd).toBe(50_000);
    expect(intent.sort).toBe('price_asc');
  });

  it('parses explicit under amounts and food terms', () => {
    const intent = service.parseIntent('spicy noodles under 50000');

    expect(intent.price.maxPriceVnd).toBe(50_000);
    expect(intent.foodTerms).toEqual(
      expect.arrayContaining(['spicy', 'noodle']),
    );
    expect(intent.dietaryTags).toEqual([]);
  });

  it('treats generic food queries as valid browse intent', () => {
    const intent = service.parseIntent('Food');

    expect(intent.needsFallback).toBe(false);
    expect(intent.confidence).toBeGreaterThanOrEqual(0.65);
    expect(intent.foodTerms).toEqual([]);
    expect(intent.foodNameOnly).toBe(false);
    expect(intent.itemKinds).toEqual(['food']);
  });

  it.each([
    'food for weight loss',
    'food for weight lost',
    'food to lose weight',
  ])('treats %s as food-only lower-calorie intent', (query) => {
    const intent = service.parseIntent(query);

    expect(intent.itemKinds).toEqual(['food']);
    expect(intent.nutrition.lowerCalorie).toBe(true);
    expect(intent.nutrition.caloriesMax).toBe(500);
    expect(intent.sort).toBe('calories_asc');
  });

  it('supports Vietnamese lower-calorie intent', () => {
    const intent = service.parseIntent('món ăn giảm cân');

    expect(intent.itemKinds).toEqual(['food']);
    expect(intent.nutrition.lowerCalorie).toBe(true);
  });

  it('distinguishes beverages and leaves dessert type-agnostic', () => {
    const drinkIntent = service.parseIntent('drink');
    expect(drinkIntent.itemKinds).toEqual(['beverage']);
    expect(drinkIntent.foodTerms).toEqual([]);
    expect(drinkIntent.needsFallback).toBe(false);
    expect(service.parseIntent('low calorie drink').itemKinds).toEqual([
      'beverage',
    ]);
    expect(service.parseIntent('dessert for weight loss').itemKinds).toEqual(
      [],
    );
  });

  it('parses calorie caps without treating them as prices', () => {
    const intent = service.parseIntent('food under 500 calories');

    expect(intent.nutrition.caloriesMax).toBe(500);
    expect(intent.nutrition.lowerCalorie).toBe(true);
    expect(intent.price.maxPriceVnd).toBeUndefined();
    expect(intent.sort).toBe('calories_asc');
  });

  it('separates exclusions from positive dietary tags', () => {
    const intent = service.parseIntent('no seafood please');
    const multiword = service.parseIntent('food without fish sauce');

    expect(intent.excludedTerms).toEqual(['seafood']);
    expect(intent.dietaryTags).not.toContain('seafood');
    expect(intent.foodTerms).not.toContain('seafood');
    expect(intent.semanticConstraints).toContain('no seafood please');
    expect(multiword.excludedTerms).toEqual(['fish sauce']);
  });

  it('parses explicit price ranges, rating thresholds, and low-fat defaults', () => {
    const range = service.parseIntent('food from 30000 to 60000');
    const rating = service.parseIntent('restaurants rated 4.5 or higher');
    const lowFat = service.parseIntent('low fat meal');

    expect(range.price).toEqual(
      expect.objectContaining({ minPriceVnd: 30_000, maxPriceVnd: 60_000 }),
    );
    expect(rating.rating.minAverageRating).toBe(4.5);
    expect(lowFat.nutrition.fatMaxG).toBe(15);
  });

  it('marks bare food names for standard search fallback', () => {
    expect(service.parseIntent('pho').foodNameOnly).toBe(true);
    expect(service.parseIntent('bun bo').foodNameOnly).toBe(true);
    expect(service.parseIntent('com tam').foodNameOnly).toBe(true);
  });

  it('keeps AI intent for food names with additional query terms', () => {
    expect(service.parseIntent('best pho nearby').foodNameOnly).toBe(false);
    expect(service.parseIntent('cheap bun bo').foodNameOnly).toBe(false);
    expect(service.parseIntent('high protein com').foodNameOnly).toBe(false);
  });

  it('marks low-signal queries for fallback', () => {
    const intent = service.parseIntent('???');

    expect(intent.needsFallback).toBe(true);
    expect(intent.confidence).toBeLessThan(0.65);
  });

  it('uses the shared AI provider when AI search is enabled', async () => {
    const provider = {
      isConfigured: jest.fn(() => true),
      chat: jest.fn(() =>
        Promise.resolve({
          model: 'gpt-oss:120b',
          content: JSON.stringify({
            rewrittenQuery: 'high protein chicken nearby',
            language: 'en',
            itemKinds: [],
            foodTerms: ['chicken'],
            cuisineTerms: [],
            dietaryTags: ['chicken'],
            excludedTerms: [],
            nutrition: { highProtein: true, proteinMinG: 35 },
            price: {},
            rating: {},
            geo: { nearbyIntent: true, radiusKm: 4 },
            sort: 'protein_desc',
            confidence: 0.92,
            needsFallback: false,
            foodNameOnly: false,
          }),
        }),
      ),
    } as unknown as OllamaAiProvider;
    const config = buildConfig({
      AI_SEARCH_ENABLED: true,
      AI_SEARCH_MODEL: 'gpt-oss:120b-cloud',
      AI_SEARCH_TIMEOUT_MS: 9000,
    });
    const providerService = new AiSearchIntentService(provider, config);

    const intent = await providerService.parseIntentWithProvider(
      'high protein chicken nearby',
      { radiusKm: 4 },
    );

    expect(provider.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-oss:120b-cloud',
        timeoutMs: 9000,
        temperature: 0,
      }),
    );
    expect(intent.nutrition.proteinMinG).toBe(35);
    expect(intent.geo.radiusKm).toBe(4);
    expect(intent.sort).toBe('protein_desc');
    expect(intent.foodNameOnly).toBe(false);
  });

  it('uses the provider food-name-only classification', async () => {
    const provider = {
      isConfigured: jest.fn(() => true),
      chat: jest.fn(() =>
        Promise.resolve({
          model: 'gpt-oss:120b',
          content: JSON.stringify({
            rewrittenQuery: 'pho',
            language: 'vi',
            itemKinds: [],
            foodTerms: ['pho'],
            cuisineTerms: [],
            dietaryTags: [],
            excludedTerms: [],
            nutrition: {},
            price: {},
            rating: {},
            geo: {},
            sort: 'relevance',
            confidence: 0.91,
            needsFallback: false,
            foodNameOnly: true,
          }),
        }),
      ),
    } as unknown as OllamaAiProvider;
    const providerService = new AiSearchIntentService(
      provider,
      buildConfig({ AI_SEARCH_ENABLED: true }),
    );

    const intent = await providerService.parseIntentWithProvider('pho');

    expect(intent.foodNameOnly).toBe(true);
    expect(intent.confidence).toBe(0.91);
  });

  it('does not let the provider force a type for an ambiguous dessert query', async () => {
    const provider = {
      isConfigured: jest.fn(() => true),
      chat: jest.fn(() =>
        Promise.resolve({
          model: 'gpt-oss:120b',
          content: JSON.stringify({
            rewrittenQuery: 'dessert for weight loss',
            language: 'en',
            itemKinds: ['beverage'],
            foodTerms: ['dessert'],
            cuisineTerms: [],
            dietaryTags: [],
            excludedTerms: [],
            nutrition: { lowerCalorie: true },
            price: {},
            rating: {},
            geo: {},
            sort: 'calories_asc',
            confidence: 0.9,
            needsFallback: false,
            foodNameOnly: false,
          }),
        }),
      ),
    } as unknown as OllamaAiProvider;
    const providerService = new AiSearchIntentService(
      provider,
      buildConfig({ AI_SEARCH_ENABLED: true }),
    );

    const intent = await providerService.parseIntentWithProvider(
      'dessert for weight loss',
    );

    expect(intent.itemKinds).toEqual([]);
    expect(intent.nutrition.lowerCalorie).toBe(true);
  });
  it('falls back to deterministic parsing when the provider fails', async () => {
    const provider = {
      isConfigured: jest.fn(() => true),
      chat: jest.fn(() => Promise.reject(new Error('provider offline'))),
    } as unknown as OllamaAiProvider;
    const providerService = new AiSearchIntentService(
      provider,
      buildConfig({ AI_SEARCH_ENABLED: true }),
    );
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const intent = await providerService.parseIntentWithProvider('budget food');

    expect(provider.chat).toHaveBeenCalledTimes(1);
    expect(intent.price.budgetIntent).toBe(true);
    expect(intent.price.maxPriceVnd).toBe(50_000);
  });
});

function buildConfig(values: Record<string, unknown>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}
