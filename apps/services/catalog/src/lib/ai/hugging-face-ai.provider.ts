import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InferenceClient } from '@huggingface/inference';
import {
  AiEmbedRequest,
  AiEmbedResponse,
  AiProviderNotConfiguredError,
  AiProviderRequestError,
} from './ollama-ai.provider';

const DEFAULT_HUGGINGFACE_EMBEDDING_MODEL =
  'sentence-transformers/all-MiniLM-L6-v2';

export interface HuggingFaceRuntimeConfig {
  model: string;
  apiKey: string;
}

export const resolveHuggingFaceEmbeddingRuntimeConfig = (raw: {
  apiKey?: string;
  model?: string;
}): HuggingFaceRuntimeConfig => {
  return {
    apiKey: raw.apiKey ?? '',
    model:
      raw.model && raw.model.trim().length > 0
        ? raw.model.trim()
        : DEFAULT_HUGGINGFACE_EMBEDDING_MODEL,
  };
};

@Injectable()
export class HuggingFaceAiProvider {
  private hfInference: InferenceClient | null = null;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.getEmbeddingRuntimeConfig().apiKey);
  }

  getEmbeddingRuntimeConfig(
    request?: Partial<AiEmbedRequest>,
  ): HuggingFaceRuntimeConfig {
    return resolveHuggingFaceEmbeddingRuntimeConfig({
      apiKey: this.config.get<string>('HUGGINGFACE_API_KEY'),
      model:
        request?.model ?? this.config.get<string>('AI_SEARCH_EMBEDDING_MODEL'),
    });
  }

  private getClient(apiKey: string): InferenceClient {
    if (!this.hfInference) {
      this.hfInference = new InferenceClient(apiKey);
    }
    return this.hfInference;
  }

  async embed(request: AiEmbedRequest): Promise<AiEmbedResponse> {
    const runtimeConfig = this.getEmbeddingRuntimeConfig(request);

    if (!runtimeConfig.apiKey) {
      throw new AiProviderNotConfiguredError(
        'AI provider is not configured. Set HUGGINGFACE_API_KEY to use Hugging Face embeddings.',
      );
    }

    const client = this.getClient(runtimeConfig.apiKey);

    try {
      const inputs = Array.isArray(request.input)
        ? request.input
        : [request.input];

      const result = await client.featureExtraction({
        provider: 'hf-inference',
        model: runtimeConfig.model,
        inputs: inputs,
        parameters: {
          // Normalize is often used to make cosine similarity easier
          normalize: true,
        },
      });

      let embeddings: number[][] = [];
      if (Array.isArray(result) && result.length > 0) {
        // If the first element is a number, it was a single input
        if (typeof result[0] === 'number') {
          embeddings = [result as unknown as number[]];
        }
        // If the first element is an array, it was multiple inputs
        else if (Array.isArray(result[0])) {
          embeddings = result as unknown as number[][];
        }
      }

      if (embeddings.length === 0) {
        throw new AiProviderRequestError(
          'Hugging Face embed response did not include valid embeddings.',
        );
      }

      return {
        embeddings,
        model: runtimeConfig.model,
      };
    } catch (error) {
      if (
        error instanceof AiProviderRequestError ||
        error instanceof AiProviderNotConfiguredError
      ) {
        throw error;
      }

      throw new AiProviderRequestError(
        error instanceof Error
          ? error.message
          : 'Hugging Face embed request failed.',
        {
          cause: error,
        },
      );
    }
  }
}
