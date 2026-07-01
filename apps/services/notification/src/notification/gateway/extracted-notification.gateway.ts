import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { SocketSessionAuthenticator } from '@/identity/socket-session-authenticator';
import { runObserved } from '@/observability/trace';
import type { Namespace, Socket } from 'socket.io';
import { UserPresenceService } from '../services/user-presence.service';
import {
  WS_NOTIFICATION_PING,
} from './notification-payload.dto';

@Injectable()
@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: (
      process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174'
    )
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  },
})
export class NotificationGateway
  implements OnGatewayConnection<Socket>, OnGatewayDisconnect<Socket>
{
  private readonly logger = new Logger(NotificationGateway.name);
  private readonly sessionTimers = new Map<string, NodeJS.Timeout>();

  @WebSocketServer()
  server!: Namespace;

  constructor(
    private readonly presenceService: UserPresenceService,
    private readonly sessionAuthenticator: SocketSessionAuthenticator,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    return runObserved(
      'ws.notifications.connection',
      { 'socket.id': client.id, 'messaging.system': 'socket.io' },
      async () => {
        const session = await this.sessionAuthenticator.authenticate(client);
        if (!session?.userId) {
          this.logger.warn(
            `Connection rejected for socketId=${client.id}: invalid or expired session`,
          );
          client.disconnect(true);
          return;
        }

        const userId = session.userId;
        (client.data as { userId?: string }).userId = userId;

        const room = `room:user:${userId}`;
        await client.join(room);
        await this.presenceService.markOnline(userId);

        if (session.expiresAt) {
          const ttlMs = new Date(session.expiresAt).getTime() - Date.now();
          if (ttlMs > 0) {
            const timer = setTimeout(
              () => {
                this.sessionTimers.delete(client.id);
                client.emit('auth:expired');
                client.disconnect(true);
              },
              Math.min(ttlMs, 2_147_483_647),
            );
            this.sessionTimers.set(client.id, timer);
          }
        }
      },
    );
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const timer = this.sessionTimers.get(client.id);
    if (timer) {
      clearTimeout(timer);
      this.sessionTimers.delete(client.id);
    }

    const userId = (client.data as { userId?: string }).userId;
    if (userId) await this.presenceService.markOffline(userId);
  }

  @SubscribeMessage(WS_NOTIFICATION_PING)
  handlePing(client: Socket): void {
    const userId = (client.data as { userId?: string }).userId;
    if (userId) void this.presenceService.refreshTtl(userId);
  }

  sendToUser(userId: string, event: string, payload: unknown): boolean {
    if (!this.server) return false;
    return this.server.to(`room:user:${userId}`).emit(event, payload);
  }

  broadcastToAll(event: string, payload: unknown): void {
    this.server?.emit(event, payload);
  }

  @Interval(60_000)
  logConnectionMetrics(): void {
    if (!this.server) return;
    this.logger.log({
      event: 'websocket.connections',
      namespace: '/notifications',
      count: this.server.sockets.size,
    });
  }
}
