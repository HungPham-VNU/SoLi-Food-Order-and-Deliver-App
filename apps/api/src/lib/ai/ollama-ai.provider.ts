import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const OLLAMA_CLOUD_API_BASE_URL = 'https://ollama.com/api';
export const LOCAL_OLLAMA_BASE_URL = 'http://localhost:11434';
export const LOCAL_OLLAMA_API_BASE_URL = `${LOCAL_OLLAMA_BASE_URL}/api`;

const DEFAULT_OLLAMA_MODEL = 'gpt-oss:20b';
const DEFAULT_OLLAMA_EMBEDDING_MODEL = 'embeddinggemma';
const LOCAL_OLLAMA_PLACEHOLDER_API_KEY = 'ollama';
const CLOUD_MODEL_SUFFIX = '-cloud';
const DEFAULT_AI_TIMEOUT_MS = 30_000;

export type OllamaEndpoint = {
  mode: 'native';
  baseURL: string;
  isDirectCloud: boolean;
};

export interface OllamaRuntimeConfig {
  endpoint: OllamaEndpoint;
  model: string;
  apiKey: string;
}

export type AiChatRole = 'system' | 'user' | 'assistant';

export interface AiChatMessage {
  role: AiChatRole;
  content: string;
}

export interface AiChatRequest {
  messages: AiChatMessage[];
  model?: string;
  timeoutMs?: number;
  temperature?: number;
}

export interface AiChatResponse {
  content: string;
  model: string;
}

export interface AiEmbedRequest {
  input: string | string[];
  model?: string;
  baseURL?: string;
  timeoutMs?: number;
  dimensions?: number;
  truncate?: boolean;
}

export interface AiEmbedResponse {
  embeddings: number[][];
  model: string;
}

interface RawOllamaConfig {
  baseURL?: string;
  model?: string;
  apiKey?: string;
}

interface OllamaChatResponse {
  message?: {
    content?: string;
  };
  error?: string;
}

interface OllamaEmbedResponse {
  model?: string;
  embeddings?: unknown;
  error?: string;
}

export class AiProviderNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiProviderNotConfiguredError';
  }
}

export class AiProviderRequestError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AiProviderRequestError';
  }
}

const trimOrDefault = (value: string | undefined, fallback: string) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
};

const trimOrEmpty = (value: string | undefined) => value?.trim() ?? '';

const normalizeCloudModelName = (model: string) =>
  model.endsWith(CLOUD_MODEL_SUFFIX)
    ? model.slice(0, -CLOUD_MODEL_SUFFIX.length)
    : model;

const normalizeCloudApiKey = (apiKey: string | undefined) => {
  const trimmed = trimOrEmpty(apiKey);
  return trimmed === LOCAL_OLLAMA_PLACEHOLDER_API_KEY ? '' : trimmed;
};

const normalizeLocalOllamaApiBaseURL = (baseURL: string | undefined) => {
  const trimmed = trimOrDefault(baseURL, LOCAL_OLLAMA_BASE_URL).replace(
    /\/+$/,
    '',
  );

  if (trimmed.endsWith('/api')) {
    return trimmed;
  }

  if (trimmed.endsWith('/v1')) {
    return `${trimmed.slice(0, -'/v1'.length)}/api`;
  }

  return `${trimmed}/api`;
};

export const resolveOllamaRuntimeConfig = (
  raw: RawOllamaConfig,
): OllamaRuntimeConfig => {
  return {
    endpoint: {
      mode: 'native',
      baseURL: OLLAMA_CLOUD_API_BASE_URL,
      isDirectCloud: true,
    },
    model: normalizeCloudModelName(
      trimOrDefault(raw.model, DEFAULT_OLLAMA_MODEL),
    ),
    apiKey: normalizeCloudApiKey(raw.apiKey),
  };
};

export const resolveOllamaEmbeddingRuntimeConfig = (
  raw: RawOllamaConfig,
): OllamaRuntimeConfig => {
  return {
    endpoint: {
      mode: 'native',
      baseURL: normalizeLocalOllamaApiBaseURL(raw.baseURL),
      isDirectCloud: false,
    },
    model: trimOrDefault(raw.model, DEFAULT_OLLAMA_EMBEDDING_MODEL),
    apiKey: '',
  };
};

@Injectable()
export class OllamaAiProvider {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.getRuntimeConfig().apiKey);
  }

  getRuntimeConfig(modelOverride?: string): OllamaRuntimeConfig {
    return resolveOllamaRuntimeConfig({
      baseURL: this.config.get<string>('OLLAMA_BASE_URL'),
      apiKey: this.config.get<string>('OLLAMA_API_KEY'),
      model: modelOverride ?? this.config.get<string>('OLLAMA_MODEL'),
    });
  }

  getEmbeddingRuntimeConfig(request: AiEmbedRequest): OllamaRuntimeConfig {
    return resolveOllamaEmbeddingRuntimeConfig({
      baseURL:
        request.baseURL ??
        this.config.get<string>('AI_SEARCH_EMBEDDING_BASE_URL'),
      model:
        request.model ?? this.config.get<string>('AI_SEARCH_EMBEDDING_MODEL'),
    });
  }

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    const runtimeConfig = this.getRuntimeConfig(request.model);

    if (!runtimeConfig.apiKey) {
      throw new AiProviderNotConfiguredError(
        'AI provider is not configured. Set OLLAMA_API_KEY for Ollama Cloud.',
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      request.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS,
    );

    try {
      const response = await fetch(`${runtimeConfig.endpoint.baseURL}/chat`, {
        method: 'POST',
        headers: this.ollamaHeaders(runtimeConfig),
        body: JSON.stringify({
          model: runtimeConfig.model,
          messages: request.messages,
          stream: false,
          think: false,
          options: {
            temperature: request.temperature ?? 0,
          },
        }),
        signal: controller.signal,
      });
      const responseBody = await this.readOllamaResponse(response);

      if (!response.ok) {
        throw new AiProviderRequestError(
          `Ollama Cloud API request failed (${response.status}): ${this.ollamaErrorMessage(
            responseBody,
            response.statusText,
          )}`,
        );
      }

      const content = responseBody.message?.content;
      if (!content) {
        throw new AiProviderRequestError(
          'Ollama Cloud API response did not include content.',
        );
      }

      return {
        content,
        model: runtimeConfig.model,
      };
    } catch (error) {
      if (error instanceof AiProviderRequestError) {
        throw error;
      }

      if (controller.signal.aborted) {
        throw new AiProviderRequestError(
          'Ollama Cloud API request timed out.',
          {
            cause: error,
          },
        );
      }

      throw new AiProviderRequestError(
        error instanceof Error
          ? error.message
          : 'Ollama Cloud API request failed.',
        {
          cause: error,
        },
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async embed(request: AiEmbedRequest): Promise<AiEmbedResponse> {
    const runtimeConfig = this.getEmbeddingRuntimeConfig(request);

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      request.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS,
    );

    try {
      const response = await fetch(`${runtimeConfig.endpoint.baseURL}/embed`, {
        method: 'POST',
        headers: this.ollamaHeaders(runtimeConfig),
        body: JSON.stringify({
          model: runtimeConfig.model,
          input: request.input,
          truncate: request.truncate ?? true,
          ...(request.dimensions ? { dimensions: request.dimensions } : {}),
        }),
        signal: controller.signal,
      });
      const responseBody = await this.readOllamaEmbedResponse(response);

      if (!response.ok) {
        throw new AiProviderRequestError(
          `Ollama embed request failed (${response.status}): ${this.ollamaErrorMessage(
            responseBody,
            response.statusText,
          )}`,
        );
      }

      const embeddings = parseEmbeddings(responseBody.embeddings);
      if (embeddings.length === 0) {
        throw new AiProviderRequestError(
          'Ollama embed response did not include embeddings.',
        );
      }

      return {
        embeddings,
        model: responseBody.model ?? runtimeConfig.model,
      };
    } catch (error) {
      if (error instanceof AiProviderRequestError) {
        throw error;
      }

      if (controller.signal.aborted) {
        throw new AiProviderRequestError('Ollama embed request timed out.', {
          cause: error,
        });
      }

      throw new AiProviderRequestError(
        error instanceof Error ? error.message : 'Ollama embed request failed.',
        {
          cause: error,
        },
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private ollamaHeaders(
    runtimeConfig: OllamaRuntimeConfig,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (runtimeConfig.apiKey) {
      headers.Authorization = `Bearer ${runtimeConfig.apiKey}`;
    }

    return headers;
  }

  private async readOllamaResponse(
    response: Response,
  ): Promise<OllamaChatResponse> {
    const text = await response.text();
    if (!text.trim()) {
      return {};
    }

    try {
      return JSON.parse(text) as OllamaChatResponse;
    } catch {
      throw new AiProviderRequestError(
        `Ollama Cloud API returned non-JSON response (${response.status}).`,
      );
    }
  }

  private async readOllamaEmbedResponse(
    response: Response,
  ): Promise<OllamaEmbedResponse> {
    const text = await response.text();
    if (!text.trim()) {
      return {};
    }

    try {
      return JSON.parse(text) as OllamaEmbedResponse;
    } catch {
      throw new AiProviderRequestError(
        `Ollama embed endpoint returned non-JSON response (${response.status}).`,
      );
    }
  }

  private ollamaErrorMessage(
    responseBody: OllamaChatResponse,
    fallback: string,
  ) {
    if (typeof responseBody.error === 'string') {
      return responseBody.error;
    }

    return fallback;
  }
}

function parseEmbeddings(value: unknown): number[][] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((embedding): embedding is number[] => {
      return (
        Array.isArray(embedding) &&
        embedding.every((item) => typeof item === 'number')
      );
    })
    .map((embedding) => [...embedding]);
}
