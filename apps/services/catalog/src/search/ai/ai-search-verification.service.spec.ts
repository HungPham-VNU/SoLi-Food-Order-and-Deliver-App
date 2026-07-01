import type { ConfigService } from '@nestjs/config';
import type { OllamaAiProvider } from '@/lib/ai/ollama-ai.provider';
import { AiSearchVerificationService } from './ai-search-verification.service';
import type { AiSearchIntent, AiSearchItemResult } from './ai-search.types';

const baseIntent: AiSearchIntent = {
  rewrittenQuery: 'healthy food',
  language: 'en',
  itemKinds: ['food'],
  foodTerms: [],
  cuisineTerms: [],
  dietaryTags: [],
  excludedTerms: [],
  semanticConstraints: ['healthy food'],
  nutrition: {},
  price: {},
  rating: {},
  geo: {},
  sort: 'relevance',
  confidence: 0.9,
  needsFallback: false,
};

function makeItem(id: string): AiSearchItemResult {
  return {
    id,
    name: `Item ${id}`,
    description: 'A menu item',
    price: 50_000,
    itemKind: 'food',
    imageUrl: null,
    tags: [],
    categoryName: 'Mains',
    restaurant: {
      id: 'restaurant-1',
      name: 'Restaurant',
      address: 'District 1',
      averageRating: 4.5,
      ratingSum: 45,
      reviewCount: 10,
    },
    score: 50,
    matchReasons: [],
    nutrition: null,
  };
}

function buildService(content: string) {
  const provider = {
    isConfigured: jest.fn(() => true),
    chat: jest.fn(() => Promise.resolve({ model: 'test-model', content })),
  } as unknown as jest.Mocked<OllamaAiProvider>;
  const values: Record<string, unknown> = {
    AI_SEARCH_ENABLED: true,
    AI_SEARCH_VERIFICATION_ENABLED: true,
    AI_SEARCH_VERIFICATION_TIMEOUT_MS: 4000,
    AI_SEARCH_VERIFICATION_BATCH_SIZE: 25,
  };
  const config = {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;

  return {
    provider,
    service: new AiSearchVerificationService(provider, config),
  };
}

describe('AiSearchVerificationService', () => {
  it('accepts pass and soft unknown decisions but rejects failures', async () => {
    const { service } = buildService(
      JSON.stringify({
        items: [
          {
            id: 'pass',
            verdict: 'pass',
            violations: [],
            unknownConstraints: [],
          },
          {
            id: 'fail',
            verdict: 'fail',
            violations: ['too greasy'],
            unknownConstraints: [],
          },
          {
            id: 'unknown',
            verdict: 'unknown',
            violations: [],
            unknownConstraints: ['preparation method'],
          },
        ],
      }),
    );

    const result = await service.verifyCandidates('healthy food', baseIntent, [
      makeItem('pass'),
      makeItem('fail'),
      makeItem('unknown'),
    ]);

    expect(result.status).toBe('success');
    expect(result.acceptedItemIds).toEqual(new Set(['pass', 'unknown']));
    expect(result.rejectedItemIds).toEqual(new Set(['fail']));
  });

  it('rejects unknown or omitted candidates for strict constraints', async () => {
    const { service } = buildService(
      JSON.stringify({
        items: [
          {
            id: 'known-vegan',
            verdict: 'pass',
            violations: [],
            unknownConstraints: [],
          },
        ],
      }),
    );
    const intent: AiSearchIntent = {
      ...baseIntent,
      dietaryTags: ['vegan'],
      semanticConstraints: ['vegan food'],
    };

    const result = await service.verifyCandidates('vegan food', intent, [
      makeItem('known-vegan'),
      makeItem('missing-decision'),
    ]);

    expect(result.strict).toBe(true);
    expect(result.acceptedItemIds).toEqual(new Set(['known-vegan']));
    expect(result.rejectedItemIds).toEqual(new Set(['missing-decision']));
    expect(result.unknownItemIds).toEqual(new Set(['missing-decision']));
  });

  it('fails closed for strict constraints when the response is invalid', async () => {
    const { service } = buildService('not-json');
    const intent: AiSearchIntent = {
      ...baseIntent,
      excludedTerms: ['peanut'],
      semanticConstraints: ['without peanut'],
    };

    const result = await service.verifyCandidates(
      'food without peanuts',
      intent,
      [makeItem('item-1')],
    );

    expect(result.status).toBe('failed');
    expect(result.acceptedItemIds).toEqual(new Set());
    expect(result.rejectedItemIds).toEqual(new Set(['item-1']));
  });

  it('skips the provider when there is no semantic verification constraint', async () => {
    const { service, provider } = buildService('{}');
    const intent: AiSearchIntent = {
      ...baseIntent,
      semanticConstraints: [],
    };

    const result = await service.verifyCandidates('pho', intent, [
      makeItem('item-1'),
    ]);

    expect(result.status).toBe('skipped');
    expect(result.acceptedItemIds).toEqual(new Set(['item-1']));
    expect(provider.chat).not.toHaveBeenCalled();
  });

  it('uses bounded verification configuration', () => {
    const { service } = buildService('{}');
    expect(service.getBatchSize()).toBe(25);
  });
});
