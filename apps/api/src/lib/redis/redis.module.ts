import { Global, Module, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants.js';
import { RedisService } from './redis.service.js';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        const logger = new Logger('RedisModule');

        // Exponential back-off capped at 3 s; stops after 10 attempts
        const retryStrategy = (times: number): number | null =>
          times > 10 ? null : Math.min(times * 200, 3000);

        const redisUrl = process.env.REDIS_URL;

        let client: Redis;
        if (redisUrl) {
          // Cloud deployments (Render, Railway…) supply a REDIS_URL.
          // Explicitly set tls:{} for rediss:// because ioredis v5 does not
          // reliably propagate TLS from the URL protocol when extra options are
          // passed alongside the URL string.
          const isTls = redisUrl.startsWith('rediss://');
          logger.log(`Redis configured via REDIS_URL (TLS: ${isTls})`);
          client = new Redis(redisUrl, {
            lazyConnect: true,
            retryStrategy,
            ...(isTls && { tls: {} }),
          });
        } else {
          logger.log(
            `Redis configured via REDIS_HOST/REDIS_PORT (${process.env.REDIS_HOST ?? 'localhost'}:${process.env.REDIS_PORT ?? 6379})`,
          );
          client = new Redis({
            host: process.env.REDIS_HOST ?? 'localhost',
            port: Number(process.env.REDIS_PORT ?? 6379),
            lazyConnect: true,
            retryStrategy,
          });
        }

        client.on('connect', () => logger.log('Redis connected'));
        client.on('error', (err: Error) =>
          logger.error('Redis error', err.message),
        );
        client.on('close', () => logger.warn('Redis connection closed'));

        return client;
      },
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}
