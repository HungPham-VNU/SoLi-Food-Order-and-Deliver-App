import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { SearchModule } from '../search.module';
import { AiSearchRankingStatsService } from './ai-search-ranking-stats.service';

async function main() {
  const app = await NestFactory.createApplicationContext(SearchModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const service = app.get(AiSearchRankingStatsService, { strict: false });
    const result = await service.refresh();
    console.log(
      `AI search ranking stats refreshed at ${result.refreshedAt.toISOString()}`,
    );
  } finally {
    await app.close();
  }
}

void main().catch((error) => {
  console.error('AI search ranking stats refresh failed:', error);
  process.exit(1);
});
