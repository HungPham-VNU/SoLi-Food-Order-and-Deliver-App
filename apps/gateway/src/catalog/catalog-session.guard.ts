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
import { CATALOG_SESSION_AUTHENTICATOR } from './catalog.tokens';

/**
 * Authenticates the incoming session for Catalog mutation routes and attaches it
 * to the request so InternalJwtService can mint a 'catalog'-audience token.
 */
@Injectable()
export class CatalogSessionGuard implements CanActivate {
  constructor(
    @Inject(CATALOG_SESSION_AUTHENTICATOR)
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
