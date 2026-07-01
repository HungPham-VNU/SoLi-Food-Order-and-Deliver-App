import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OllamaAiProvider } from './ollama-ai.provider';
import { HuggingFaceAiProvider } from './hugging-face-ai.provider';

@Module({
  imports: [ConfigModule],
  providers: [OllamaAiProvider, HuggingFaceAiProvider],
  exports: [OllamaAiProvider, HuggingFaceAiProvider],
})
export class AiModule {}
