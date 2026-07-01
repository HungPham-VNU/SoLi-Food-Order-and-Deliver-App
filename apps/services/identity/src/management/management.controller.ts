import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { IDENTITY_DATABASE } from '@/drizzle/database.constants';
import type { IdentityDatabase } from '@/drizzle/database.module';

@Controller()
export class ManagementController {
  constructor(
    @Inject(IDENTITY_DATABASE) private readonly database: IdentityDatabase,
  ) {}

  @Get('live')
  live() {
    return { status: 'ok', service: 'identity' };
  }

  @Get('ready')
  async ready() {
    try {
      await this.database.execute(sql`select 1`);
      return { status: 'ready', service: 'identity' };
    } catch {
      throw new ServiceUnavailableException(
        'Identity database is unavailable.',
      );
    }
  }
}
