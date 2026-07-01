import { Module } from '@nestjs/common';
import { AiModule } from '@/lib/ai/ai.module';
import { AiSearchIntentService } from './ai/ai-search-intent.service';
import { AiSearchRankingService } from './ai/ai-search-ranking.service';
import { AiSearchRankingStatsService } from './ai/ai-search-ranking-stats.service';
import { AiSearchRankingStatsWorker } from './ai/ai-search-ranking-stats.worker';
import { AiSearchVerificationService } from './ai/ai-search-verification.service';
import { AiSearchRepository } from './ai/ai-search.repository';
import { AiSearchService } from './ai/ai-search.service';
import { SearchService } from './standard/search.service';
import { SearchRepository } from './standard/search.repository';
import { DatabaseModule } from '@/drizzle/database.module';
import { AiSearchIndexModule } from './indexing/ai-search-index.module';
import { SearchRpcController } from '@/rpc/search-rpc.controller';

@Module({
  imports: [DatabaseModule, AiModule, AiSearchIndexModule],
  controllers: [SearchRpcController],
  providers: [
    SearchService,
    SearchRepository,
    AiSearchService,
    AiSearchRepository,
    AiSearchIntentService,
    AiSearchRankingService,
    AiSearchRankingStatsService,
    AiSearchRankingStatsWorker,
    AiSearchVerificationService,
  ],
})
export class SearchModule {}
