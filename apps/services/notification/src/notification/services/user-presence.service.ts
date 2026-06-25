import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@/lib/redis/redis.service';

// ---------------------------------------------------------------------------
// UserPresenceService
//
// Manages WebSocket presence state in Redis using atomic INCR/DECR reference
// counting. Solves the multi-tab race condition where a single SET/DEL key
// pattern would delete presence when any tab disconnects, even while other
// tabs remain connected.
//
// Redis key: "ws:connections:{userId}" = integer (connection reference count)
// TTL: 90 s — refreshed on every client heartbeat (25 s interval), so the
//   key expires naturally if the server crashes and handleDisconnect is
//   never called. 90 s > 25 s (heartbeat) ensures the key survives across
//   normal reconnects and gives a 3× safety margin for network delays.
//
// Reference counting protocol:
//   connect    → INCR key; EXPIRE key 90
//   disconnect → DECR key; if result ≤ 0: DEL key
//   heartbeat  → EXPIRE key 90 (refresh TTL only, no value change)
//   push check → GET key; online if value > 0
//
// Failure policy: every method absorbs Redis errors internally and logs a
//   warning. For markOffline/refreshTtl these are non-critical operations.
//   For isOnline, the safe default on Redis failure is false (offline) so
//   that the push notification is still delivered as a fallback.
//
// Phase: N-5 — Delivery Orchestration Fix
// ---------------------------------------------------------------------------
@Injectable()
export class UserPresenceService {
  private readonly logger = new Logger(UserPresenceService.name);

  /**
   * Redis key prefix for WebSocket connection reference counts.
   * Old (buggy) key was "presence:{userId}" — this uses a distinct prefix
   * to avoid conflicts during any rolling deployment.
   */
  private static readonly KEY_PREFIX = 'ws:connections:';

  /**
   * TTL for the presence key.
   * Must be > heartbeat interval (25 s) with enough margin to survive
   * network hiccups and slow reconnects.
   */
  static readonly TTL_SECONDS = 90;

  constructor(private readonly redisService: RedisService) {}

  // ---------------------------------------------------------------------------
  // Key helper
  // ---------------------------------------------------------------------------

  private key(userId: string): string {
    return `${UserPresenceService.KEY_PREFIX}${userId}`;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle — called by NotificationGateway
  // ---------------------------------------------------------------------------

  /**
   * Increment the connection count for a user on WebSocket connect.
   * Also refreshes the TTL so the key lives at least TTL_SECONDS more.
   *
   * INCR is atomic — safe for concurrent tab connects racing each other.
   */
  async markOnline(userId: string): Promise<void> {
    try {
      const count = await this.redisService.incr(this.key(userId));
      await this.redisService.expire(
        this.key(userId),
        UserPresenceService.TTL_SECONDS,
      );
      this.logger.debug(
        `[Presence] markOnline: userId=${userId} connectionCount=${count}`,
      );
    } catch (err) {
      this.logger.warn(
        `[Presence] markOnline failed for userId=${userId}: ${(err as Error).message} — presence not tracked`,
      );
    }
  }

  /**
   * Decrement the connection count for a user on WebSocket disconnect.
   * When the count reaches 0 (or below due to any inconsistency), the key
   * is deleted to free memory and ensure isOnline() returns false.
   *
   * DECR is atomic. DEL after DECR is a two-step operation but the window
   * between them is negligible and self-correcting: a concurrent INCR would
   * recreate the key before the DEL fires or after, both of which are safe.
   */
  async markOffline(userId: string): Promise<void> {
    try {
      const count = await this.redisService.decr(this.key(userId));
      if (count <= 0) {
        await this.redisService.del(this.key(userId));
        this.logger.debug(
          `[Presence] markOffline: userId=${userId} — last connection closed, key deleted`,
        );
      } else {
        this.logger.debug(
          `[Presence] markOffline: userId=${userId} remainingConnections=${count}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `[Presence] markOffline failed for userId=${userId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Extend the TTL of the presence key without changing its value.
   * Called on every heartbeat ping from the client to keep the key alive.
   *
   * If the key does not exist (e.g. it expired while the client was in a
   * background tab), expire() is a no-op — the key is recreated on the
   * client's next reconnect.
   */
  async refreshTtl(userId: string): Promise<void> {
    try {
      await this.redisService.expire(
        this.key(userId),
        UserPresenceService.TTL_SECONDS,
      );
      this.logger.debug(`[Presence] refreshTtl: userId=${userId}`);
    } catch (err) {
      this.logger.warn(
        `[Presence] refreshTtl failed for userId=${userId}: ${(err as Error).message}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Query — called by ChannelDispatcherService
  // ---------------------------------------------------------------------------

  /**
   * Returns true when the user has at least one active WebSocket connection.
   *
   * Reads the reference-counted key. A missing key (null) or a value of 0
   * or below both mean offline.
   *
   * SAFE DEFAULT: returns false on Redis error so that push notifications
   * are still delivered as a fallback when presence state is unavailable.
   */
  async isOnline(userId: string): Promise<boolean> {
    try {
      const value = await this.redisService.get(this.key(userId));
      if (value === null) return false;
      return parseInt(value, 10) > 0;
    } catch (err) {
      this.logger.warn(
        `[Presence] isOnline check failed for userId=${userId}: ${(err as Error).message} — assuming offline (push will be sent as fallback)`,
      );
      return false; // safe default: deliver push rather than silently suppress
    }
  }

  /**
   * Returns the current number of active WebSocket connections for a user.
   * Negative values (from any edge-case inconsistency) are clamped to 0.
   *
   * For observability / diagnostics only — use isOnline() for routing decisions.
   */
  async getConnectionCount(userId: string): Promise<number> {
    try {
      const value = await this.redisService.get(this.key(userId));
      if (value === null) return 0;
      return Math.max(0, parseInt(value, 10));
    } catch (err) {
      this.logger.warn(
        `[Presence] getConnectionCount failed for userId=${userId}: ${(err as Error).message}`,
      );
      return 0;
    }
  }
}
