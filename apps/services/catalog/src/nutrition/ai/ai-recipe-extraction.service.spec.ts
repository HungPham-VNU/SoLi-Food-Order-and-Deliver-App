import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { OllamaAiProvider } from '@/lib/ai/ollama-ai.provider';
import { AiRecipeExtractionService } from './ai-recipe-extraction.service';

type OllamaConfigKey = 'OLLAMA_BASE_URL' | 'OLLAMA_MODEL' | 'OLLAMA_API_KEY';

function buildService(configValues: Partial<Record<OllamaConfigKey, string>>) {
  const config = {
    get: jest.fn((key: OllamaConfigKey) => configValues[key]),
  } as unknown as ConfigService;

  return new AiRecipeExtractionService(new OllamaAiProvider(config));
}

function mockOllamaResponse(content: unknown) {
  return new Response(
    JSON.stringify({
      message: {
        content: JSON.stringify(content),
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

describe('AiRecipeExtractionService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls direct Ollama Cloud and does not send unsupported structured-output format', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      mockOllamaResponse({
        recipeName: 'Com ga',
        servings: 2,
        ingredients: [
          {
            rawText: '500 g uc ga',
            name: 'uc ga',
            quantity: 500,
            unit: 'g',
            preparation: 'cooked',
            confidence: 0.9,
          },
        ],
        warnings: [],
      }),
    );
    const service = buildService({
      OLLAMA_BASE_URL: 'http://localhost:11434/v1',
      OLLAMA_MODEL: 'gemma4:31b-cloud',
      OLLAMA_API_KEY: 'test-key',
    });

    const result = await service.extractRecipe('Com ga\n- 500 g uc ga');

    expect(result.recipeName).toBe('Com ga');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://ollama.com/api/chat');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-key',
    });

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.model).toBe('gemma4:31b');
    expect(body.stream).toBe(false);
    expect(body.think).toBe(false);
    expect(body).not.toHaveProperty('format');
  });

  it('normalizes loose cloud JSON with review-safe defaults', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      mockOllamaResponse({
        recipe_name: 'Canh rau',
        servings: 1,
        ingredients: [
          {
            raw_text: 'rau muong',
            name: 'rau muong',
            preparation_state: 'boiled',
          },
        ],
      }),
    );
    const service = buildService({
      OLLAMA_MODEL: 'gpt-oss:20b',
      OLLAMA_API_KEY: 'test-key',
    });

    const result = await service.extractRecipe('Canh rau\n- rau muong');

    expect(result).toMatchObject({
      recipeName: 'Canh rau',
      servings: 1,
      warnings: [],
      ingredients: [
        {
          rawText: 'rau muong',
          name: 'rau muong',
          quantity: null,
          unit: 'unknown',
          preparation: 'boiled',
          confidence: 0.5,
        },
      ],
    });
  });

  it('normalizes common Vietnamese household units before schema validation', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      mockOllamaResponse({
        recipeName: 'Bún chả',
        servings: null,
        ingredients: [
          {
            rawText: '5 lạng ba chỉ',
            name: 'ba chỉ heo',
            quantity: 5,
            unit: 'lạng',
            preparation: 'grilled',
            confidence: 0.92,
          },
          {
            rawText: 'nửa cân thịt vai xay',
            name: 'thịt vai xay',
            quantity: 'nửa',
            unit: 'cân',
            preparation: 'raw',
            confidence: 0.88,
          },
          {
            rawText: '3 muỗng canh nước mắm',
            name: 'nước mắm',
            quantity: 3,
            unit: 'muỗng canh',
            preparation: 'unknown',
            confidence: 0.9,
          },
          {
            rawText: '1/4 bát dấm',
            name: 'dấm',
            quantity: '1/4',
            unit: 'bát',
            preparation: 'unknown',
            confidence: 0.82,
          },
          {
            rawText: 'hai vắt bún',
            name: 'bún',
            quantity: null,
            unit: null,
            preparation: 'cooked',
            confidence: 0.84,
          },
          {
            rawText: 'vài nhánh mùi tàu',
            name: 'mùi tàu',
            quantity: null,
            unit: null,
            preparation: 'raw',
            confidence: 0.81,
          },
        ],
        warnings: [],
      }),
    );
    const service = buildService({
      OLLAMA_MODEL: 'gpt-oss:20b',
      OLLAMA_API_KEY: 'test-key',
    });

    const result = await service.extractRecipe('Bún chả');

    expect(result.ingredients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rawText: '5 lạng ba chỉ',
          quantity: 500,
          unit: 'g',
        }),
        expect.objectContaining({
          rawText: 'nửa cân thịt vai xay',
          quantity: 0.5,
          unit: 'kg',
        }),
        expect.objectContaining({
          rawText: '3 muỗng canh nước mắm',
          quantity: 3,
          unit: 'tbsp',
        }),
        expect.objectContaining({
          rawText: '1/4 bát dấm',
          quantity: 0.25,
          unit: 'bowl',
        }),
        expect.objectContaining({
          rawText: 'hai vắt bún',
          quantity: 2,
          unit: 'piece',
        }),
      ]),
    );
    expect(result.ingredients[5]).toMatchObject({
      rawText: 'vài nhánh mùi tàu',
      quantity: 3,
      unit: 'piece',
      requiresConfirmation: true,
      notes: [expect.stringContaining('Approximate household quantity')],
    });
  });

  it('does not fabricate ingredients when the cloud response omits them', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      mockOllamaResponse({
        recipeName: 'Canh rau',
        servings: 1,
        warnings: [],
      }),
    );
    const service = buildService({
      OLLAMA_MODEL: 'gpt-oss:20b',
      OLLAMA_API_KEY: 'test-key',
    });

    const result = await service.extractRecipe('Canh rau');

    expect(result.ingredients).toEqual([]);
  });

  it('does not call Ollama Cloud when the API key is missing', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const service = buildService({
      OLLAMA_MODEL: 'gpt-oss:20b',
      OLLAMA_API_KEY: 'ollama',
    });

    await expect(service.extractRecipe('Com ga')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
