import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InternalJwtError,
  verifyInternalJwt,
  type InternalAuthClaims,
} from '@uitfood/contracts';
import type { Env } from '@/config/env.schema';

export interface OrderingCaller {
  userId: string;
  roles: string[];
  isAdmin: boolean;
  isService: boolean;
}

/**
 * Verifies the internal JWT carried on Ordering RPCs. The gateway issues a
 * user-scoped `aud=ordering` token for customer/restaurant routes; other
 * services (e.g. Review) present a `service:*` token for service-to-service
 * reads. Ordering re-checks ownership in its handlers.
 */
@Injectable()
export class InternalAuthService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  verifyOrderingToken(token: string): OrderingCaller {
    try {
      const claims: InternalAuthClaims = verifyInternalJwt(token, {
        audience: 'ordering',
        secret: this.config.get('INTERNAL_AUTH_JWT_SECRET', { infer: true }),
        issuers: this.config
          .get('INTERNAL_AUTH_TRUSTED_ISSUERS', { infer: true })
          .split(',')
          .map((issuer) => issuer.trim())
          .filter(Boolean),
      });
      const roles = claims.roles ?? [];
      return {
        userId: claims.sub,
        roles,
        isAdmin: roles.includes('admin'),
        isService:
          roles.includes('service') || claims.sub.startsWith('service:'),
      };
    } catch (error) {
      if (error instanceof InternalJwtError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }

  /** Verifies the caller presents a trusted service token (service-to-service). */
  requireServiceToken(token: string): OrderingCaller {
    const caller = this.verifyOrderingToken(token);
    if (!caller.isService) {
      throw new UnauthorizedException('Ordering RPC requires a service token.');
    }
    return caller;
  }
}
