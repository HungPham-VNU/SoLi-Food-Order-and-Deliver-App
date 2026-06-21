import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LOCAL_OLLAMA_BASE_URL,
  OllamaAiProvider,
} from '@/lib/ai/ollama-ai.provider';

export interface AiSearchEmbeddingConfig {
  baseURL: string;
  model: string;
  version: string;
  dimensions: number;
  timeoutMs: number;
  workerEnabled: boolean;
  batchSize: number;
  rateLimitPerMinute: number;
}

@Injectable()
export class AiSearchEmbeddingService {
  constructor(
    @Inject(OllamaAiProvider)
    private readonly aiProvider: OllamaAiProvider,
    @Inject(ConfigService)
    private readonly config: ConfigService,
  ) {}

  getConfig(): AiSearchEmbeddingConfig {
    return {
      baseURL: this.readString(
        'AI_SEARCH_EMBEDDING_BASE_URL',
        LOCAL_OLLAMA_BASE_URL,
      ),
      model: this.readString('AI_SEARCH_EMBEDDING_MODEL', 'embeddinggemma'),
      version: this.readString('AI_SEARCH_EMBEDDING_VERSION', '1'),
      dimensions: this.readPositiveInt('AI_SEARCH_EMBEDDING_DIMENSIONS', 768),
      timeoutMs: this.readPositiveInt('AI_SEARCH_EMBEDDING_TIMEOUT_MS', 8000),
      workerEnabled: this.readBoolean(
        'AI_SEARCH_EMBEDDING_WORKER_ENABLED',
        false,
      ),
      batchSize: this.readPositiveInt('AI_SEARCH_EMBEDDING_BATCH_SIZE', 20),
      rateLimitPerMinute: this.readPositiveInt(
        'AI_SEARCH_EMBEDDING_RATE_LIMIT_PER_MINUTE',
        60,
      ),
    };
  }

  async embedSearchDocument(text: string): Promise<number[]> {
    const embeddingConfig = this.getConfig();
    const response = await this.aiProvider.embed({
      input: text,
      model: embeddingConfig.model,
      baseURL: embeddingConfig.baseURL,
      timeoutMs: embeddingConfig.timeoutMs,
      dimensions: embeddingConfig.dimensions,
      truncate: true,
    });
    const embedding = response.embeddings[0];

    if (!embedding || embedding.length !== embeddingConfig.dimensions) {
      throw new Error(
        `Embedding dimension mismatch: expected ${embeddingConfig.dimensions}, got ${embedding?.length ?? 0}.`,
      );
    }

    return embedding;
  }

  private readString(key: string, fallback: string): string {
    const value = this.config.get<string>(key)?.trim();
    return value && value.length > 0 ? value : fallback;
  }

  private readPositiveInt(key: string, fallback: number): number {
    const value = Number(this.config.get<number | string>(key));
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }

  private readBoolean(key: string, fallback: boolean): boolean {
    const value = this.config.get<boolean | string>(key);
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return ['1', 'true', 'yes'].includes(value.trim().toLowerCase());
    }
    return fallback;
  }
}
