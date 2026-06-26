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
import { REVIEW_SESSION_AUTHENTICATOR } from './review.tokens';

@Injectable()
export class ReviewSessionGuard implements CanActivate {
  constructor(
    @Inject(REVIEW_SESSION_AUTHENTICATOR)
    private readonly authenticator: SessionAuthenticator,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<GatewayRequestWithSession>();
    const session = await this.authenticator.authenticate(request);
    if (session) {
      request.gatewaySession = session;
      return true;
    }
    throw new UnauthorizedException('Authentication required.');
  }
}
