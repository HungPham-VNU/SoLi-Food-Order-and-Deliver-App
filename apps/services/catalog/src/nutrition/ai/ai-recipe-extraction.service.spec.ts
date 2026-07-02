/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { OllamaAiProvider } from '@/lib/ai/ollama-ai.provider';
import { AiRecipeExtractionService } from './ai-recipe-extraction.service';
import { streamObject } from 'ai';

jest.mock('ai', () => ({
  streamObject: jest.fn(),
}));

async function drainStream(stream: AsyncIterable<any>) {
  let last: any = {};
  for await (const chunk of stream) {
    last = chunk;
  }
  return last;
}

type OllamaConfigKey = 'OLLAMA_BASE_URL' | 'OLLAMA_MODEL' | 'OLLAMA_API_KEY';

function buildService(configValues: Partial<Record<OllamaConfigKey, string>>) {
  const config = {
    get: jest.fn((key: OllamaConfigKey) => configValues[key]),
  } as unknown as ConfigService;

  return new AiRecipeExtractionService(new OllamaAiProvider(config));
}

function mockStreamObject(content: unknown) {
  (streamObject as jest.Mock).mockReturnValue({
    partialObjectStream: (async function* () {
      await Promise.resolve();
      yield content;
    })(),
  });
}

describe('AiRecipeExtractionService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('calls streamObject and returns parsed stream', async () => {
    mockStreamObject({
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
    });
    const service = buildService({
      OLLAMA_BASE_URL: 'http://localhost:11434/v1',
      OLLAMA_MODEL: 'gemma4:31b-cloud',
      OLLAMA_API_KEY: 'test-key',
    });

    const result = await drainStream(
      service.extractRecipe('Com ga\n- 500 g uc ga'),
    );

    expect(result.recipeName).toBe('Com ga');
    expect(streamObject).toHaveBeenCalledTimes(1);
    const callArgs = (streamObject as jest.Mock).mock.calls[0][0];
    expect(callArgs.prompt).toBe('Com ga\n- 500 g uc ga');
    expect(callArgs.temperature).toBe(0);
  });

  it('normalizes loose cloud JSON with review-safe defaults', () => {
    const service = buildService({
      OLLAMA_BASE_URL: 'http://localhost:11434/v1',
      OLLAMA_MODEL: 'gemma4:31b-cloud',
      OLLAMA_API_KEY: 'test-key',
    });

    const result = service.normalizeRecipe({
      recipeName: 'Canh rau',
      servings: 1,
      ingredients: [
        {
          rawText: 'rau muong',
          name: 'rau muong',
          preparation: 'boiled',
        },
      ],
      warnings: [],
    } as any);

    expect(result).toMatchObject({
      recipeName: 'Canh rau',
      servings: 1,
      warnings: [],
    });
    expect(result.ingredients[0]).toMatchObject({
      rawText: 'rau muong',
      name: 'rau muong',
      quantity: null,
      unit: 'unknown',
      preparation: 'boiled',
      confidence: 0.5,
    });
  });

  it('normalizes common Vietnamese household units before schema validation', () => {
    const service = buildService({
      OLLAMA_BASE_URL: 'http://localhost:11434/v1',
      OLLAMA_MODEL: 'gemma4:31b-cloud',
      OLLAMA_API_KEY: 'test-key',
    });

    const result = service.normalizeRecipe({
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
    } as any);

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
  });

  it('does not fabricate ingredients when the cloud response omits them', () => {
    const service = buildService({
      OLLAMA_BASE_URL: 'http://localhost:11434/v1',
      OLLAMA_MODEL: 'gemma4:31b-cloud',
      OLLAMA_API_KEY: 'test-key',
    });

    const result = service.normalizeRecipe({
      recipeName: 'Canh rau',
      servings: 1,
      ingredients: [],
      warnings: [],
    });

    expect(result.ingredients).toEqual([]);
  });

  it('throws ServiceUnavailableException when streamObject throws', () => {
    (streamObject as jest.Mock).mockImplementation(() => {
      throw new Error('AI offline');
    });
    const service = buildService({
      OLLAMA_BASE_URL: 'http://localhost:11434/v1',
      OLLAMA_MODEL: 'gemma4:31b-cloud',
      OLLAMA_API_KEY: 'test-key',
    });

    expect(() => service.extractRecipe('Com ga')).toThrow(
      ServiceUnavailableException,
    );
  });
});
