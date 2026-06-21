import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OllamaAiProvider } from './ollama-ai.provider';

@Module({
  imports: [ConfigModule],
  providers: [OllamaAiProvider],
  exports: [OllamaAiProvider],
})
export class AiModule {}
