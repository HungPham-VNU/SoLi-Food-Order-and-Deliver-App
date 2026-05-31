import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/drizzle/drizzle.module';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminAnalyticsRepository } from './admin-analytics.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [AdminAnalyticsController],
  providers: [AdminAnalyticsService, AdminAnalyticsRepository],
})
export class AdminAnalyticsModule {}
