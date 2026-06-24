import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import { MEDIA_DATABASE } from '@/drizzle/database.constants';
import type { MediaDatabase } from '@/drizzle/database.module';

@Controller()
export class ManagementController {
  constructor(
    @Inject(MEDIA_DATABASE) private readonly database: MediaDatabase,
  ) {}

  @Get('live')
  live() {
    return { status: 'ok', service: 'media' };
  }

  @Get('ready')
  async ready() {
    try {
      await this.database.execute(sql`select 1`);
      return { status: 'ready', service: 'media' };
    } catch {
      throw new ServiceUnavailableException('Media database is unavailable.');
    }
  }
}
