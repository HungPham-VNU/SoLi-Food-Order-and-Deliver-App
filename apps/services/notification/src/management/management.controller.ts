import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { RedisService } from '@/lib/redis/redis.service';

@Controller()
export class ManagementController {
  constructor(private readonly redis: RedisService) {}

  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(): Promise<{ status: 'ok'; redis: 'reachable' }> {
    try {
      await this.redis.ping();
      return { status: 'ok', redis: 'reachable' };
    } catch {
      throw new ServiceUnavailableException({
        status: 'degraded',
        redis: 'unreachable',
      });
    }
  }
}
