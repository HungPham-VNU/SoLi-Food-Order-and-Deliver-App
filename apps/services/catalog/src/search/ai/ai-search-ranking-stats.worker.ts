import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AiSearchRankingStatsService } from './ai-search-ranking-stats.service';

@Injectable()
export class AiSearchRankingStatsWorker {
  private readonly logger = new Logger(AiSearchRankingStatsWorker.name);

  constructor(private readonly statsService: AiSearchRankingStatsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    this.logger.log('Starting scheduled AI search ranking stats refresh...');
    try {
      const result = await this.statsService.refresh();
      this.logger.log(
        `Successfully refreshed ranking stats at ${result.refreshedAt.toISOString()}`,
      );
    } catch (error) {
      this.logger.error(
        'Scheduled AI search ranking stats refresh failed',
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
