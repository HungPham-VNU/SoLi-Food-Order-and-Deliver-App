import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PromotionService } from '../services/promotion.service';

@Injectable()
export class PromotionReservationCleanupTask {
  private readonly logger = new Logger(PromotionReservationCleanupTask.name);

  constructor(private readonly promotionService: PromotionService) {}

  /**
   * Runs every minute.
   * Finds reservations older than 15 minutes and releases them.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    // 15 minutes ago
    const cutoff = new Date(Date.now() - 15 * 60 * 1000);
    const count = await this.promotionService.releaseStaleReservations(cutoff);
    if (count > 0) {
      this.logger.log(`Released ${count} stale reservations.`);
    }
  }
}
