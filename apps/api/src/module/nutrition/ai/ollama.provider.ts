export const OLLAMA_CLOUD_API_BASE_URL = 'https://ollama.com/api';
const DEFAULT_OLLAMA_MODEL = 'gpt-oss:20b';
const LOCAL_OLLAMA_PLACEHOLDER_API_KEY = 'ollama';
const CLOUD_MODEL_SUFFIX = '-cloud';

export type OllamaEndpoint = {
  mode: 'native';
  baseURL: string;
  isDirectCloud: true;
};

export interface OllamaRuntimeConfig {
  endpoint: OllamaEndpoint;
  model: string;
  apiKey: string;
}

interface RawOllamaConfig {
  baseURL?: string;
  model?: string;
  apiKey?: string;
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
