import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export const OLLAMA_PROVIDER = Symbol('OLLAMA_PROVIDER');

export type OllamaProvider = ReturnType<typeof createOpenAICompatible>;

export const ollamaProvider: Provider = {
  provide: OLLAMA_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService): OllamaProvider =>
    createOpenAICompatible({
      name: 'ollama',
      baseURL:
        config.get<string>('OLLAMA_BASE_URL') ?? 'http://localhost:11434/v1',
      apiKey: config.get<string>('OLLAMA_API_KEY') ?? 'ollama',
    }),
};

