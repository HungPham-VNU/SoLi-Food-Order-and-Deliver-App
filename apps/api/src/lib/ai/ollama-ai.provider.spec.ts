import type { ConfigService } from '@nestjs/config';
import { OllamaAiProvider } from './ollama-ai.provider';

describe('OllamaAiProvider embeddings', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls the local Ollama embed endpoint without cloud authorization', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'embeddinggemma',
          embeddings: [[0.1, 0.2]],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    const provider = new OllamaAiProvider(
      buildConfig({
        AI_SEARCH_EMBEDDING_BASE_URL: 'http://localhost:11434',
      }),
    );

    await expect(
      provider.embed({
        input: 'chicken rice',
        model: 'embeddinggemma',
        dimensions: 2,
      }),
    ).resolves.toEqual({
      embeddings: [[0.1, 0.2]],
      model: 'embeddinggemma',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:11434/api/embed');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: 'embeddinggemma',
      input: 'chicken rice',
      dimensions: 2,
      truncate: true,
    });
  });
});

function buildConfig(values: Record<string, unknown>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}
