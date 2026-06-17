import {
  OLLAMA_CLOUD_API_BASE_URL,
  resolveOllamaRuntimeConfig,
} from './ollama.provider';

describe('resolveOllamaRuntimeConfig', () => {
  it('defaults to the direct Ollama Cloud API', () => {
    const config = resolveOllamaRuntimeConfig({});

    expect(config).toEqual({
      endpoint: {
        mode: 'native',
        baseURL: OLLAMA_CLOUD_API_BASE_URL,
        isDirectCloud: true,
      },
      model: 'gpt-oss:20b',
      apiKey: '',
    });
  });

  it('normalizes direct cloud model names and trims the API key', () => {
    const config = resolveOllamaRuntimeConfig({
      baseURL: 'https://ollama.com',
      model: ' gemma4:31b-cloud',
      apiKey: ' test-key ',
    });

    expect(config).toEqual({
      endpoint: {
        mode: 'native',
        baseURL: 'https://ollama.com/api',
        isDirectCloud: true,
      },
      model: 'gemma4:31b',
      apiKey: 'test-key',
    });
  });

  it('ignores local base URLs so the service cannot run local Ollama', () => {
    const config = resolveOllamaRuntimeConfig({
      baseURL: 'http://localhost:11434/v1/',
      model: 'qwen2.5:7b',
      apiKey: 'test-key',
    });

    expect(config.endpoint).toEqual({
      mode: 'native',
      baseURL: OLLAMA_CLOUD_API_BASE_URL,
      isDirectCloud: true,
    });
    expect(config.model).toBe('qwen2.5:7b');
    expect(config.apiKey).toBe('test-key');
  });

  it('treats the local Ollama placeholder key as missing for cloud calls', () => {
    const config = resolveOllamaRuntimeConfig({
      model: 'gpt-oss:120b-cloud',
      apiKey: 'ollama',
    });

    expect(config.model).toBe('gpt-oss:120b');
    expect(config.apiKey).toBe('');
  });
});
