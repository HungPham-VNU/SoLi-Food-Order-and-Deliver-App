import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from '@/lib/ai/ai.module';
import { DatabaseModule } from '@/drizzle/drizzle.module';
import { AiSearchEmbeddingService } from './ai-search-embedding.service';
import { AiSearchEmbeddingWorker } from './ai-search-embedding.worker';
import { AiSearchIndexRepository } from './ai-search-index.repository';

@Module({
  imports: [DatabaseModule, AiModule, ConfigModule],
  providers: [
    AiSearchIndexRepository,
    AiSearchEmbeddingService,
    AiSearchEmbeddingWorker,
  ],
  exports: [AiSearchIndexRepository, AiSearchEmbeddingService],
})
export class AiSearchIndexModule {}
