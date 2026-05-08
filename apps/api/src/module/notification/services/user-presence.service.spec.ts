/**
 * user-presence.service.spec.ts
 *
 * Unit tests for UserPresenceService.
 *
 * Verifies:
 *  - markOnline: INCRs the key and sets TTL
 *  - markOffline (count > 0): DECRs key, does NOT delete
 *  - markOffline (count <= 0): DECRs key, THEN deletes key
 *  - markOffline Redis error: absorbed silently (no throw)
 *  - refreshTtl: calls expire with correct TTL
 *  - refreshTtl Redis error: absorbed silently (no throw)
 *  - isOnline (key missing / null): returns false
 *  - isOnline (value = '0'): returns false
 *  - isOnline (value = '1'): returns true
 *  - isOnline (value = '3'): returns true (multi-tab)
 *  - isOnline Redis error: returns false (safe default for push fallback)
 *  - getConnectionCount (null): returns 0
 *  - getConnectionCount ('-1'): returns 0 (clamped to non-negative)
 *  - getConnectionCount ('2'): returns 2
 *  - getConnectionCount Redis error: returns 0
 *
 * Phase: N-5 — Delivery Orchestration Fix
 */

import { Test, TestingModule } from '@nestjs/testing';
import { UserPresenceService } from './user-presence.service';
import { RedisService } from '@/lib/redis/redis.service';

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('UserPresenceService', () => {
  let service: UserPresenceService;
  let redisService: {
    incr: jest.Mock;
    decr: jest.Mock;
    del: jest.Mock;
    expire: jest.Mock;
    get: jest.Mock;
  };

  const USER_ID = 'user-uuid-001';
  const KEY = `ws:connections:${USER_ID}`;

  beforeEach(async () => {
    redisService = {
      incr: jest.fn().mockResolvedValue(1),
      decr: jest.fn().mockResolvedValue(0),
      del: jest.fn().mockResolvedValue(undefined),
      expire: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserPresenceService,
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();

    service = module.get<UserPresenceService>(UserPresenceService);
  });

  // ─── markOnline ─────────────────────────────────────────────────────────────

  describe('markOnline', () => {
    it('increments the ws:connections key', async () => {
      await service.markOnline(USER_ID);
      expect(redisService.incr).toHaveBeenCalledWith(KEY);
    });

    it('sets TTL after incrementing', async () => {
      await service.markOnline(USER_ID);
      expect(redisService.expire).toHaveBeenCalledWith(
        KEY,
        UserPresenceService.TTL_SECONDS,
      );
    });

    it('calls expire after incr (order matters)', async () => {
      const calls: string[] = [];
      redisService.incr.mockImplementation(() => {
        calls.push('incr');
        return Promise.resolve(1);
      });
      redisService.expire.mockImplementation(() => {
        calls.push('expire');
        return Promise.resolve(undefined);
      });

      await service.markOnline(USER_ID);
      expect(calls).toEqual(['incr', 'expire']);
    });

    it('does not throw when Redis incr fails', async () => {
      redisService.incr.mockRejectedValue(new Error('Redis ECONNREFUSED'));
      await expect(service.markOnline(USER_ID)).resolves.toBeUndefined();
    });

    it('does not throw when Redis expire fails after incr', async () => {
      redisService.incr.mockResolvedValue(1);
      redisService.expire.mockRejectedValue(new Error('Redis timeout'));
      await expect(service.markOnline(USER_ID)).resolves.toBeUndefined();
    });
  });

  // ─── markOffline ────────────────────────────────────────────────────────────

  describe('markOffline', () => {
    it('decrements the ws:connections key', async () => {
      redisService.decr.mockResolvedValue(1); // still has connections
      await service.markOffline(USER_ID);
      expect(redisService.decr).toHaveBeenCalledWith(KEY);
    });

    it('does NOT delete key when count is still positive after decrement', async () => {
      redisService.decr.mockResolvedValue(1);
      await service.markOffline(USER_ID);
      expect(redisService.del).not.toHaveBeenCalled();
    });

    it('deletes key when decrement result is 0 (last connection closed)', async () => {
      redisService.decr.mockResolvedValue(0);
      await service.markOffline(USER_ID);
      expect(redisService.del).toHaveBeenCalledWith(KEY);
    });

    it('deletes key when decrement result is negative (edge case)', async () => {
      redisService.decr.mockResolvedValue(-1);
      await service.markOffline(USER_ID);
      expect(redisService.del).toHaveBeenCalledWith(KEY);
    });

    it('does not throw when Redis decr fails', async () => {
      redisService.decr.mockRejectedValue(new Error('Redis ECONNREFUSED'));
      await expect(service.markOffline(USER_ID)).resolves.toBeUndefined();
    });

    it('does not throw when Redis del fails after decr reaches 0', async () => {
      redisService.decr.mockResolvedValue(0);
      redisService.del.mockRejectedValue(new Error('Redis timeout'));
      await expect(service.markOffline(USER_ID)).resolves.toBeUndefined();
    });
  });

  // ─── refreshTtl ─────────────────────────────────────────────────────────────

  describe('refreshTtl', () => {
    it('calls expire with the correct key and TTL', async () => {
      await service.refreshTtl(USER_ID);
      expect(redisService.expire).toHaveBeenCalledWith(
        KEY,
        UserPresenceService.TTL_SECONDS,
      );
    });

    it('does not throw when Redis expire fails', async () => {
      redisService.expire.mockRejectedValue(new Error('Redis ECONNREFUSED'));
      await expect(service.refreshTtl(USER_ID)).resolves.toBeUndefined();
    });
  });

  // ─── isOnline ───────────────────────────────────────────────────────────────

  describe('isOnline', () => {
    it('returns false when key does not exist (null)', async () => {
      redisService.get.mockResolvedValue(null);
      expect(await service.isOnline(USER_ID)).toBe(false);
    });

    it('returns false when count is 0', async () => {
      redisService.get.mockResolvedValue('0');
      expect(await service.isOnline(USER_ID)).toBe(false);
    });

    it('returns true when count is 1 (single connection)', async () => {
      redisService.get.mockResolvedValue('1');
      expect(await service.isOnline(USER_ID)).toBe(true);
    });

    it('returns true when count is 3 (three tabs / devices)', async () => {
      redisService.get.mockResolvedValue('3');
      expect(await service.isOnline(USER_ID)).toBe(true);
    });

    it('returns false on Redis error (safe default for push fallback)', async () => {
      redisService.get.mockRejectedValue(new Error('Redis connection lost'));
      expect(await service.isOnline(USER_ID)).toBe(false);
    });

    it('reads from correct key', async () => {
      redisService.get.mockResolvedValue('1');
      await service.isOnline(USER_ID);
      expect(redisService.get).toHaveBeenCalledWith(KEY);
    });
  });

  // ─── getConnectionCount ─────────────────────────────────────────────────────

  describe('getConnectionCount', () => {
    it('returns 0 when key does not exist (null)', async () => {
      redisService.get.mockResolvedValue(null);
      expect(await service.getConnectionCount(USER_ID)).toBe(0);
    });

    it('returns 0 when value is negative (clamps to 0)', async () => {
      redisService.get.mockResolvedValue('-1');
      expect(await service.getConnectionCount(USER_ID)).toBe(0);
    });

    it('returns 0 when value is "0"', async () => {
      redisService.get.mockResolvedValue('0');
      expect(await service.getConnectionCount(USER_ID)).toBe(0);
    });

    it('returns 2 when value is "2"', async () => {
      redisService.get.mockResolvedValue('2');
      expect(await service.getConnectionCount(USER_ID)).toBe(2);
    });

    it('returns 0 on Redis error', async () => {
      redisService.get.mockRejectedValue(new Error('Redis ECONNREFUSED'));
      expect(await service.getConnectionCount(USER_ID)).toBe(0);
    });
  });
});
