import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/drizzle/database.module';
import { RestaurantSnapshotRepository } from '../acl/repositories/restaurant-snapshot.repository';
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
  providers: [
    AnalyticsService,
    AnalyticsRepository,
    RestaurantSnapshotRepository,
  ],
  // Exported so the TCP analytics RPC controller can delegate to it.
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
