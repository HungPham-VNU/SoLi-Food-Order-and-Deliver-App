import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/drizzle/drizzle.module';
import { RestaurantSnapshotRepository } from '../acl/repositories/restaurant-snapshot.repository';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsRepository } from './analytics.repository';

/**
 * AnalyticsModule — restaurant-facing read-only analytics queries.
 *
 * Mirrors OrderHistoryModule's wiring: declares the
 * RestaurantSnapshotRepository directly (rather than importing AclModule) to
 * avoid the circular-import pattern documented in OrderHistoryModule.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    AnalyticsRepository,
    RestaurantSnapshotRepository,
  ],
})
export class AnalyticsModule {}
