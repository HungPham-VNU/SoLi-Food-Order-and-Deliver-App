import type { ConfigService } from '@nestjs/config';
import type { HuggingFaceAiProvider } from '@/lib/ai/hugging-face-ai.provider';
import type { OllamaAiProvider } from '@/lib/ai/ollama-ai.provider';
import { AiSearchEmbeddingService } from './ai-search-embedding.service';

describe('AiSearchEmbeddingService', () => {
  it('requests embeddings with the configured model, timeout, and dimensions', async () => {
    const embedding = Array.from({ length: 768 }, () => 0.1);
    const provider = buildProvider(embedding);
    const service = new AiSearchEmbeddingService(
      provider,
      provider as unknown as jest.Mocked<HuggingFaceAiProvider>,
      buildConfig({
        AI_SEARCH_EMBEDDING_MODEL: 'embeddinggemma',
        AI_SEARCH_EMBEDDING_BASE_URL: 'http://localhost:11434',
        AI_SEARCH_EMBEDDING_VERSION: '2',
        AI_SEARCH_EMBEDDING_DIMENSIONS: 768,
        AI_SEARCH_EMBEDDING_TIMEOUT_MS: 7000,
      }),
    );

    await expect(service.embedSearchDocument('chicken rice')).resolves.toEqual(
      embedding,
    );
    expect(provider.embed).toHaveBeenCalledWith({
      input: 'chicken rice',
      model: 'embeddinggemma',
      baseURL: 'http://localhost:11434',
      timeoutMs: 7000,
      dimensions: 768,
      truncate: true,
    });
  });

  it('rejects embeddings with the wrong dimension', async () => {
    const provider = buildProvider([0.1, 0.2]);
    const service = new AiSearchEmbeddingService(
      provider,
      provider as unknown as jest.Mocked<HuggingFaceAiProvider>,
      buildConfig({ AI_SEARCH_EMBEDDING_DIMENSIONS: 768 }),
    );

    await expect(service.embedSearchDocument('chicken rice')).rejects.toThrow(
      'Embedding dimension mismatch',
    );
  });

  it('propagates provider timeout failures', async () => {
    const provider = {
      embed: jest.fn(() =>
        Promise.reject(new Error('Ollama embed request timed out.')),
      ),
    } as unknown as jest.Mocked<OllamaAiProvider>;
    const service = new AiSearchEmbeddingService(
      provider,
      provider as unknown as jest.Mocked<HuggingFaceAiProvider>,
      buildConfig({}),
    );

    await expect(service.embedSearchDocument('chicken rice')).rejects.toThrow(
      'timed out',
    );
  });
});

function buildProvider(embedding: number[]): jest.Mocked<OllamaAiProvider> {
  return {
    embed: jest.fn(() =>
      Promise.resolve({
        embeddings: [embedding],
        model: 'embeddinggemma',
      }),
    ),
  } as unknown as jest.Mocked<OllamaAiProvider>;
}

function buildConfig(values: Record<string, unknown>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}
