import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as http from 'http';
import * as https from 'https';

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
  let baseURL = raw.baseURL
    ? normalizeLocalOllamaApiBaseURL(raw.baseURL)
    : OLLAMA_CLOUD_API_BASE_URL;

  if (
    baseURL.startsWith('http://localhost') ||
    baseURL.startsWith('http://127.0.0.1')
  ) {
    baseURL = OLLAMA_CLOUD_API_BASE_URL;
  }

  const isDirectCloud = baseURL === OLLAMA_CLOUD_API_BASE_URL;
  return {
    endpoint: {
      mode: 'native',
      baseURL,
      isDirectCloud,
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
    const config = this.getRuntimeConfig();
    return !config.endpoint.isDirectCloud || Boolean(config.apiKey);
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

    if (runtimeConfig.endpoint.isDirectCloud && !runtimeConfig.apiKey) {
      throw new AiProviderNotConfiguredError(
        'AI provider is not configured. Set OLLAMA_API_KEY for Ollama Cloud.',
      );
    }

    const timeoutMs = request.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.makeRequest(
        `${runtimeConfig.endpoint.baseURL}/chat`,
        {
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
          timeoutMs,
          signal: controller.signal,
        },
      );

      const responseData =
        this.parseOllamaResponse<OllamaChatResponse>(response);

      if (response.status < 200 || response.status >= 300) {
        throw new AiProviderRequestError(
          `Ollama Cloud API request failed (${response.status}): ${this.ollamaErrorMessage(
            responseData,
            response.statusText,
          )}`,
        );
      }

      const content = responseData.message?.content;
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

    const timeoutMs = request.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.makeRequest(
        `${runtimeConfig.endpoint.baseURL}/embed`,
        {
          method: 'POST',
          headers: this.ollamaHeaders(runtimeConfig),
          body: JSON.stringify({
            model: runtimeConfig.model,
            input: request.input,
            truncate: request.truncate ?? true,
            ...(request.dimensions ? { dimensions: request.dimensions } : {}),
          }),
          timeoutMs,
          signal: controller.signal,
        },
      );

      const responseData =
        this.parseOllamaResponse<OllamaEmbedResponse>(response);

      if (response.status < 200 || response.status >= 300) {
        throw new AiProviderRequestError(
          `Ollama embed request failed (${response.status}): ${this.ollamaErrorMessage(
            responseData,
            response.statusText,
          )}`,
        );
      }

      const embeddings = parseEmbeddings(responseData.embeddings);
      if (embeddings.length === 0) {
        throw new AiProviderRequestError(
          'Ollama embed response did not include embeddings.',
        );
      }

      return {
        embeddings,
        model: responseData.model ?? runtimeConfig.model,
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

  private makeRequest(
    urlStr: string,
    options: {
      method: string;
      headers: Record<string, string>;
      body: string;
      timeoutMs: number;
      signal: AbortSignal;
    },
  ): Promise<{ status: number; statusText: string; text: string }> {
    return new Promise((resolve, reject) => {
      const url = new URL(urlStr);
      const requestFn =
        url.protocol === 'https:' ? https.request : http.request;

      const reqOptions = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: options.method,
        headers: {
          ...options.headers,
          'Content-Length': Buffer.byteLength(options.body),
        },
        family: 4, // Critical: Forces IPv4 to bypass Node 18 `fetch` IPv6 Happy Eyeballs hangs in Docker
      };

      const req = requestFn(reqOptions, (res) => {
        let responseText = '';
        res.on('data', (chunk) => {
          responseText += chunk;
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 500,
            statusText: res.statusMessage ?? '',
            text: responseText,
          });
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.setTimeout(options.timeoutMs, () => {
        req.destroy(new Error('Request timed out'));
      });

      const abortHandler = () => {
        req.destroy(new Error('AbortError'));
      };
      options.signal.addEventListener('abort', abortHandler);

      req.on('close', () => {
        options.signal.removeEventListener('abort', abortHandler);
      });

      req.write(options.body);
      req.end();
    });
  }

  private parseOllamaResponse<T>(response: {
    status: number;
    text: string;
  }): T | Record<string, never> {
    if (!response.text.trim()) {
      return {};
    }

    try {
      return JSON.parse(response.text) as T;
    } catch {
      throw new AiProviderRequestError(
        `Ollama API returned non-JSON response (${response.status}).`,
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
