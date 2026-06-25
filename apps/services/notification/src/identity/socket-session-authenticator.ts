import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type { IdentityRpcGateway } from './identity.interfaces';
import { IDENTITY_RPC_GATEWAY } from './identity.tokens';

export interface AuthenticatedSocketSession {
  userId: string;
  expiresAt?: string;
}

@Injectable()
export class SocketSessionAuthenticator {
  private readonly logger = new Logger(SocketSessionAuthenticator.name);

  constructor(
    @Inject(IDENTITY_RPC_GATEWAY) private readonly identity: IdentityRpcGateway,
  ) {}

  async authenticate(
    client: Socket,
  ): Promise<AuthenticatedSocketSession | null> {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      client.handshake.headers.authorization?.replace('Bearer ', '');
    const cookie = client.handshake.headers.cookie;

    if (!token && !cookie) return null;

    try {
      const response = await this.identity.introspectSession({
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(cookie ? { cookie } : {}),
        },
        correlationId:
          typeof client.handshake.headers['x-request-id'] === 'string'
            ? client.handshake.headers['x-request-id']
            : client.id,
      });
      if (!response.authenticated || !response.user) return null;
      return {
        userId: response.user.id,
        expiresAt: response.session?.expiresAt,
      };
    } catch (error) {
      this.logger.warn(
        `Socket session introspection failed for socketId=${client.id}: ${(error as Error).message}`,
      );
      return null;
    }
  }
}
