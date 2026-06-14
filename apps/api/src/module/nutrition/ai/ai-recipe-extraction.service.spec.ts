import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { AiRecipeExtractionService } from './ai-recipe-extraction.service';

type OllamaConfigKey = 'OLLAMA_BASE_URL' | 'OLLAMA_MODEL' | 'OLLAMA_API_KEY';

function buildService(configValues: Partial<Record<OllamaConfigKey, string>>) {
  const config = {
    get: jest.fn((key: OllamaConfigKey) => configValues[key]),
  } as unknown as ConfigService;

  return new AiRecipeExtractionService(config);
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
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
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
