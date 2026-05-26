import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { sql } from 'drizzle-orm';
import { AppService } from './app.service';
import { DB_CONNECTION } from './drizzle/drizzle.constants';
import { RedisService } from './lib/redis/redis.service.js';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly redisService: RedisService,
    @Inject(DB_CONNECTION)
    private readonly db: { execute: (query: unknown) => Promise<unknown> },
  ) {}

  @AllowAnonymous()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @AllowAnonymous()
  @Get('live')
  live(): { status: string; uptimeSeconds: number } {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  @AllowAnonymous()
  @Get('ready')
  async ready(): Promise<{
    status: string;
    checks: { redis: string; postgres: string };
  }> {
    const checks = {
      redis: 'unknown',
      postgres: 'unknown',
    };

    try {
      checks.redis = await this.redisService.ping();
    } catch {
      checks.redis = 'error';
    }

    try {
      await this.db.execute(sql`select 1`);
      checks.postgres = 'ok';
    } catch {
      checks.postgres = 'error';
    }

    if (checks.redis !== 'PONG' || checks.postgres !== 'ok') {
      throw new ServiceUnavailableException({
        status: 'error',
        checks,
      });
    }

    return { status: 'ok', checks };
  }

  @AllowAnonymous()
  @Get('health')
  async health(): Promise<{
    status: string;
    checks: { redis: string; postgres: string };
  }> {
    return this.ready();
  }
}
