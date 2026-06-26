import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  GatewayRequestWithSession,
  SessionAuthenticator,
} from '@/identity/identity.interfaces';
import { ORDERING_SESSION_AUTHENTICATOR } from './ordering.tokens';

/**
 * Authenticates the incoming session for Ordering routes and attaches it to the
 * request so InternalJwtService can mint an `aud=ordering` token carrying the
 * caller's id + roles. Ordering re-checks ownership/role in its RPC handlers.
 */
@Injectable()
export class OrderingSessionGuard implements CanActivate {
  constructor(
    @Inject(ORDERING_SESSION_AUTHENTICATOR)
    private readonly authenticator: SessionAuthenticator,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request =
      context.switchToHttp().getRequest<GatewayRequestWithSession>();
    const session = await this.authenticator.authenticate(request);
    if (session) {
      request.gatewaySession = session;
      return true;
    }
    throw new UnauthorizedException('Authentication required.');
  }
}
