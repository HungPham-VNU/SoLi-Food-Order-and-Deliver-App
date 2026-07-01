import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ORDERING_DATABASE } from '@/drizzle/database.constants';
import type { OrderingDatabase } from '@/drizzle/database.module';

/**
 * Private management HTTP endpoints. `/live` proves the process is up; `/ready`
 * verifies the dependency required to serve traffic (the Ordering database).
 */
@Controller()
export class ManagementController {
  constructor(
    @Inject(ORDERING_DATABASE) private readonly database: OrderingDatabase,
  ) {}

  @Get('live')
  live() {
    return { status: 'ok', service: 'ordering' };
  }

  @Get('ready')
  async ready() {
    try {
      await this.database.execute(sql`select 1`);
      return { status: 'ready', service: 'ordering' };
    } catch {
      throw new ServiceUnavailableException(
        'Ordering database is unavailable.',
      );
    }
  }
}
