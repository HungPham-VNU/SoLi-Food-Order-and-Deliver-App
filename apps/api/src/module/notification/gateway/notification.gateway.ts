import { Injectable, Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Interval } from '@nestjs/schedule';
import type { Namespace, Socket } from 'socket.io';
import { auth } from '@/lib/auth';
import { UserPresenceService } from '../services/user-presence.service';
import {
  WS_CONNECTION_ESTABLISHED,
  WS_NOTIFICATION_CREATED,
  WS_NOTIFICATION_PING,
} from './notification-payload.dto';
import { runObserved } from '@/observability/trace';

// ---------------------------------------------------------------------------
// NotificationGateway
//
// Real-time WebSocket gateway for the Notification BC.
//
// Namespace:  /notifications
// Transport:  Socket.IO (HTTP long-polling → WebSocket upgrade)
// Auth:       Better Auth session, validated once on connect via
//             auth.api.getSession() — the same session used by HTTP guards.
//
// Room strategy:
//   Each authenticated user is placed in room "room:user:{userId}".
//   One user may have multiple sockets (tabs / devices) — all join the same
//   room so a single sendToUser() call reaches all devices simultaneously.
//
// Presence tracking (Phase N-5 fix):
//   Redis key "ws:connections:{userId}" = integer reference count, TTL = 90 s.
//   Managed by UserPresenceService: INCR on connect, DECR on disconnect.
//   When DECR reaches 0 the key is deleted so isOnline() returns false.
//   TTL is refreshed on every client heartbeat ("notification:ping" ~25 s).
//   This correctly handles multi-tab: 2 tabs → count=2; tab 1 disconnects
//   → count=1 (key stays); tab 2 disconnects → count=0 → key deleted.
//   Replaces the old "presence:{userId}" = socket.id single-string pattern
//   which deleted presence when any tab disconnected (multi-tab race bug).
//
// Session expiry:
//   A per-socket setTimeout fires auth:expired and disconnects the client
//   when the Better Auth session TTL elapses. The timer reference is stored
//   in sessionTimers (keyed by socket.id) and MUST be cleared in
//   handleDisconnect to prevent memory leaks and stale-socket calls.
//
// Security:
//   - All state (userId, room assignment) is set server-side from the
//     validated session — clients cannot forge their own userId.
//   - server.to('room:user:X').emit() ensures user-room isolation.
//   - Never use client.broadcast.emit() (sends to all connected clients).
//
// Phase: N-2 — Real-time WebSocket Gateway
// ---------------------------------------------------------------------------
@Injectable()
@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim()),
    credentials: true,
  },
})
export class NotificationGateway
  implements OnGatewayConnection<Socket>, OnGatewayDisconnect<Socket>
{
  private readonly logger = new Logger(NotificationGateway.name);

  // NestJS assigns this property via the @WebSocketServer() decorator after
  // module initialisation. For namespaced gateways the runtime value is a
  // socket.io Namespace, not the root Server — we type it as Namespace so that
  // server.sockets.size resolves correctly (Map<string, Socket>.size).
  // The definite assignment assertion (!) is required because the TypeScript
  // strict-property-initialisation check cannot see the NestJS decorator magic.
  @WebSocketServer()
  server!: Namespace;

  /**
   * Per-socket session-expiry timer references, keyed by socket.id.
   *
   * MUST be cleared in handleDisconnect to prevent:
   *   (a) memory leaks — each timer closure holds a reference to the
   *       socket object, keeping it in memory indefinitely.
   *   (b) post-disconnect calls — client.emit() / client.disconnect()
   *       on a stale socket after handleDisconnect fires corrupts
   *       Socket.IO internal state silently.
   */
  private readonly sessionTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    // UserPresenceService manages WebSocket connection counts in Redis.
    // It internally uses RedisService (which is @Global()) — do NOT also
    // inject RedisService here directly; all presence operations go through
    // UserPresenceService for consistency and testability.
    private readonly presenceService: UserPresenceService,
  ) {}

  // ---------------------------------------------------------------------------
  // Connection lifecycle
  // ---------------------------------------------------------------------------

  async handleConnection(client: Socket): Promise<void> {
    return runObserved(
      'ws.notifications.connection',
      { 'socket.id': client.id, 'messaging.system': 'socket.io' },
      async () => {
        // Extract token from handshake:
        //   Mobile SDK: socket = io(url, { auth: { token } })
        //   Web SDK:    socket = io(url, { extraHeaders: { authorization: 'Bearer …' } })
        const token =
          (client.handshake.auth?.token as string | undefined) ??
          client.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          this.logger.warn(
            `[Gateway] Connection rejected — no token (socketId=${client.id})`,
          );
          client.disconnect(true);
          return;
        }

        // Single auth.api.getSession() call — extracts both userId and session
        // expiry in one round-trip. Two separate helpers would double the latency.
        let session: Awaited<ReturnType<typeof auth.api.getSession>>;
        try {
          session = await auth.api.getSession({
            headers: new Headers({ authorization: `Bearer ${token}` }),
          });
        } catch (err) {
          this.logger.warn(
            `[Gateway] Connection rejected — getSession threw (socketId=${client.id}): ${(err as Error).message}`,
          );
          client.disconnect(true);
          return;
        }

        const userId = session?.user?.id;
        if (!userId) {
          this.logger.warn(
            `[Gateway] Connection rejected — invalid or expired session (socketId=${client.id})`,
          );
          client.disconnect(true);
          return;
        }

        // Store userId on the socket so handleDisconnect can access it without
        // a separate Redis lookup.
        (client.data as { userId?: string }).userId = userId;

        // Join the per-user room — all devices/tabs for this user share one room.
        // Room naming convention: 'room:user:{userId}'
        // BOTH the join here AND sendToUser() must use the SAME room string.
        const room = `room:user:${userId}`;
        await client.join(room);
        this.logger.log(
          `[Gateway] Socket joined ${room} socketId=${client.id}`,
        );

        // Presence: INCR reference count so multi-tab users stay online until
        // ALL tabs disconnect. markOnline absorbs Redis errors internally.
        await this.presenceService.markOnline(userId);

        // Session expiry enforcement: emit 'auth:expired' and disconnect when the
        // Better Auth session TTL elapses. Without this, stale sessions remain
        // connected indefinitely and receive notifications they shouldn't.
        const sessionExpiresAt = session?.session?.expiresAt;
        if (sessionExpiresAt) {
          const ttlMs = new Date(sessionExpiresAt).getTime() - Date.now();
          if (ttlMs > 0) {
            // Cap at Node.js setTimeout limit (~24.8 days). Values above 2^31-1 ms
            // overflow to a 32-bit signed integer internally and fire immediately,
            // causing instant disconnect for users with long-lived sessions.
            const safeTtlMs = Math.min(ttlMs, 2_147_483_647);
            const timer = setTimeout(() => {
              // Timer has fired — remove from map before disconnect so
              // handleDisconnect's clearTimeout is a no-op (already cleaned up).
              this.sessionTimers.delete(client.id);
              client.emit('auth:expired');
              client.disconnect(true);
            }, safeTtlMs);
            this.sessionTimers.set(client.id, timer);
          }
          // ttlMs <= 0 means the session is already expired — client was rejected
          // above (session?.user?.id would be null for expired sessions), so this
          // branch is only a safety net for clocks that drift by a few milliseconds.
        }

        this.logger.log(
          `[Gateway] Socket connected: userId=${userId} socketId=${client.id}`,
        );

        // Diagnostic emit #1: 'connection:established' — confirms room join + emit path.
        // Client receives this immediately after connect to confirm the full pipeline works.
        this.server.to(room).emit(WS_CONNECTION_ESTABLISHED, {
          userId,
          room,
          connectedAt: new Date().toISOString(),
        });

        // Diagnostic emit #2: 'notification.created' — fires immediately after connect.
        // This allows the client to verify it receives realtime notifications WITHOUT
        // needing to trigger a full payment flow. Remove in production if not desired.
        this.server.to(room).emit(WS_NOTIFICATION_CREATED, {
          id: 'diagnostic',
          type: 'system_announcement',
          title: 'Kết nối realtime thành công',
          body: `WebSocket kết nối đến room ${room} thành công. Thông báo realtime đã sẵn sàng.`,
          data: { diagnostic: 'true', room, socketId: client.id },
          createdAt: new Date().toISOString(),
          isRead: false,
        });
        this.logger.log(
          `[Gateway] Diagnostic notification.created emitted to ${room} (socketId=${client.id})`,
        );
      },
    );
  }

  async handleDisconnect(client: Socket): Promise<void> {
    // Cancel the session expiry timer — prevents it firing on a stale socket.
    // clearTimeout is a safe no-op if the timer has already fired.
    const timer = this.sessionTimers.get(client.id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.sessionTimers.delete(client.id);
    }

    const userId = (client.data as { userId?: string }).userId;
    if (userId) {
      // DECR reference count. When count reaches 0 (last connection closed)
      // UserPresenceService deletes the key so isOnline() returns false.
      // Multi-tab: count stays > 0 while other tabs remain connected.
      await this.presenceService.markOffline(userId);
      this.logger.log(
        `[Gateway] Socket disconnected: userId=${userId} socketId=${client.id}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Client → Server messages
  // ---------------------------------------------------------------------------

  /**
   * Heartbeat handler — client sends 'notification:ping' every ~25 s.
   * Refreshes the presence key TTL (ws:connections:{userId}) so it does not
   * expire while the client is still connected in a background tab.
   * Using refreshTtl() extends the TTL without changing the reference count —
   * correct for multi-tab: all tabs share the same count key and any tab's
   * ping should extend the shared key lifetime.
   */
  @SubscribeMessage(WS_NOTIFICATION_PING)
  handlePing(client: Socket): void {
    const userId = (client.data as { userId?: string }).userId;
    if (!userId) return;

    // Fire-and-forget — heartbeat failures are non-critical.
    // refreshTtl absorbs errors internally.
    void this.presenceService.refreshTtl(userId);
  }

  // ---------------------------------------------------------------------------
  // Server → Client helpers (called by NotificationService)
  // ---------------------------------------------------------------------------

  /**
   * Emit an event to all connected sockets belonging to a specific user.
   *
   * Room name convention: 'room:user:{userId}' — MUST match the room joined
   * in handleConnection. If the room name here ever drifts from handleConnection,
   * no client will receive the event (Socket.IO will emit to an empty room).
   *
   * Returns true when the emit was dispatched to at least one socket in the
   * room; false when the user is offline (room is empty). Both cases are
   * expected — false is not an error. The notification is persisted in the DB
   * and will be retrieved via the inbox REST API on next connection.
   */
  sendToUser(userId: string, event: string, payload: unknown): boolean {
    if (!this.server) {
      this.logger.warn(
        `[Gateway] server not ready — dropping event "${event}" for userId=${userId}`,
      );
      return false;
    }
    const room = `room:user:${userId}`;
    this.logger.log(
      `[Gateway] Realtime emit: event=${event} room=${room} userId=${userId}`,
    );
    const emitted = this.server.to(room).emit(event, payload);
    if (!emitted) {
      this.logger.debug(
        `[Gateway] Emit returned false — no sockets in ${room} (user offline)`,
      );
    }
    return emitted;
  }

  /**
   * Namespace-level broadcast to ALL connected clients.
   * Used for system announcements (e.g. maintenance window, app update).
   *
   * IMPORTANT: Use server.emit() — NOT server.to('/notifications').emit().
   * The /notifications prefix is the namespace, not a room name. Calling
   * server.to('/notifications').emit() would treat the string as a room
   * name, delivering to nobody.
   */
  broadcastToAll(event: string, payload: unknown): void {
    if (!this.server) {
      this.logger.warn(
        `[Gateway] server not ready — dropping broadcast event "${event}"`,
      );
      return;
    }
    this.server.emit(event, payload);
  }

  // ---------------------------------------------------------------------------
  // Observability
  // ---------------------------------------------------------------------------

  /**
   * Log the number of connected WebSocket clients every 60 seconds.
   *
   * Uses server.sockets.size (namespace-scoped count for /notifications only).
   * Does NOT use server.engine.clientsCount — that counts ALL transport
   * connections across every namespace.
   *
   * ScheduleModule.forRoot() is imported once in AppModule — @Interval works
   * in all providers without re-importing ScheduleModule in NotificationModule.
   */
  @Interval(60_000)
  logConnectionMetrics(): void {
    if (!this.server) return;
    // server.sockets is a Map<SocketId, Socket> scoped to the /notifications
    // namespace — .size gives the count of currently connected clients.
    const count = this.server.sockets.size;
    this.logger.log({
      event: 'websocket.connections',
      namespace: '/notifications',
      count,
    });
  }
}
