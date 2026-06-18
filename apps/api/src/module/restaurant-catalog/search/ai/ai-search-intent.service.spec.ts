import type { ConfigService } from '@nestjs/config';
import type { OllamaAiProvider } from '@/module/ai/ollama-ai.provider';
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
    expect(intent.dietaryTags).toEqual(
      expect.arrayContaining(['spicy', 'noodle']),
    );
  });

  it('marks low-signal queries for fallback', () => {
    const intent = service.parseIntent('???');

    expect(intent.needsFallback).toBe(true);
    expect(intent.confidence).toBeLessThan(0.65);
  });

  it('uses the shared AI provider when AI search is enabled', async () => {
    const provider = {
      isConfigured: jest.fn(() => true),
      chat: jest.fn(async () => ({
        model: 'gpt-oss:120b',
        content: JSON.stringify({
          rewrittenQuery: 'high protein chicken nearby',
          language: 'en',
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
        }),
      })),
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
  });

  it('falls back to deterministic parsing when the provider fails', async () => {
    const provider = {
      isConfigured: jest.fn(() => true),
      chat: jest.fn(async () => {
        throw new Error('provider offline');
      }),
    } as unknown as OllamaAiProvider;
    const providerService = new AiSearchIntentService(
      provider,
      buildConfig({ AI_SEARCH_ENABLED: true }),
    );
    jest
      .spyOn((providerService as any).logger, 'warn')
      .mockImplementation(() => undefined);

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
