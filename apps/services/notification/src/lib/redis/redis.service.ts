import {
  Injectable,
  Inject,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants.js';

// Ping every 4 minutes to keep the free Redis instance alive
const KEEP_ALIVE_INTERVAL_MS = 4 * 60 * 1000;

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private keepAliveTimer: NodeJS.Timeout | null = null;

  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    await this.client.set(key, value);
  }

  async setWithExpiry(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  /**
   * Atomically set a key only if it does not already exist (SET NX EX).
   * Returns true if the key was set (did not exist), false if key already existed.
   * Used for: idempotency keys (D5-A), cart checkout locks (Phase 4).
   */
  async setNx(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const count = await this.client.exists(key);
    return count > 0;
  }

  /**
   * Safely scan for all keys matching a pattern using SCAN cursor iteration.
   * Safe for production — does not block the Redis server unlike KEYS.
   */
  async scan(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, batch] = await this.client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');
    return keys;
  }

  /**
   * Atomically increment the integer value of a key by 1.
   * If the key does not exist it is initialised to 0 before the operation.
   * Returns the value of the key after the increment.
   * Used for: multi-device presence reference counting (Phase N-3+).
   */
  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  /**
   * Atomically decrement the integer value of a key by 1.
   * If the key does not exist it is initialised to 0 before the operation.
   * Returns the value of the key after the decrement.
   * Used for: multi-device presence reference counting (Phase N-3+).
   */
  async decr(key: string): Promise<number> {
    return this.client.decr(key);
  }

  /**
   * Set the TTL (time-to-live) of an existing key without changing its value.
   * This is the cleanest way to refresh a heartbeat TTL — no value read/write needed.
   * If the key does not exist, the command is a no-op.
   * Used for: WebSocket heartbeat TTL refresh (Phase N-2).
   */
  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(key, ttlSeconds);
  }

  /**
   * Atomically increment a key ONLY when it already exists in Redis.
   *
   * Implemented with a single Lua script so EXISTS + INCR execute as one
   * atomic operation — no race window between the check and the increment.
   *
   * Returns the new integer value when the key existed and was incremented,
   * or null when the key did not exist (caller should treat as a cache miss).
   *
   * Used for: atomic unread-count increment when a new in-app notification
   * is persisted (Phase N-5). When the cache is warm we increment in-place;
   * when it is cold we leave it absent so the next getUnreadCount() call
   * re-computes the correct count from the DB.
   */
  async incrIfExists(key: string): Promise<number | null> {
    // Lua script: atomically increment if key exists, else return false (0)
    const LUA_INCR_IF_EXISTS = `
      if redis.call('EXISTS', KEYS[1]) == 1 then
        return redis.call('INCR', KEYS[1])
      end
      return false
    `;
    const result = await this.client.eval(LUA_INCR_IF_EXISTS, 1, key);
    // Redis Lua false returns as null in ioredis
    return result === null || result === false ? null : (result as number);
  }

  /**
   * Add a scored member to a sorted set (ZADD).
   * Creates the key if it does not exist.
   * Used for: rate-limiting time windows keyed by unix timestamp.
   */
  async zadd(key: string, score: number, member: string): Promise<void> {
    await this.client.zadd(key, score, member);
  }

  /**
   * Return all members in a sorted set within a score range (ZRANGEBYSCORE).
   * Used for: counting events within a sliding time window for rate limiting.
   */
  async zrangebyscore(
    key: string,
    min: number | '-inf',
    max: number | '+inf',
  ): Promise<string[]> {
    return this.client.zrangebyscore(key, min, max);
  }

  /**
   * Remove all members in a sorted set within a score range (ZREMRANGEBYSCORE).
   * Used for: evicting stale entries outside the current rate-limit window.
   */
  async zrem(
    key: string,
    min: number | '-inf',
    max: number | '+inf',
  ): Promise<void> {
    await this.client.zremrangebyscore(key, min, max);
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  onModuleInit(): void {
    this.keepAliveTimer = setInterval(() => {
      this.client
        .ping()
        .then(() => this.logger.debug('Redis keep-alive ping sent'))
        .catch((err: Error) =>
          this.logger.warn('Redis keep-alive ping failed', err.message),
        );
    }, KEEP_ALIVE_INTERVAL_MS);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
    }
    await this.client.quit();
    this.logger.log('Redis connection closed gracefully');
  }
}
