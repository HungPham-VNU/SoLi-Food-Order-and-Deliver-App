import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InternalJwtError,
  verifyInternalJwt,
  type InternalAuthClaims,
} from '@uitfood/contracts';
import type { Env } from '@/config/env.schema';

export interface PaymentCaller {
  userId: string;
  roles: string[];
  isAdmin: boolean;
  isService: boolean;
}

/**
 * Verifies the internal JWT carried on Payment RPCs. The gateway issues
 * user-scoped tokens for customer reads; the API/Ordering adapter issues
 * service tokens for attempt lifecycle operations. Both carry `aud=payment`.
 */
@Injectable()
export class InternalAuthService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  verifyPaymentToken(token: string): PaymentCaller {
    try {
      const claims: InternalAuthClaims = verifyInternalJwt(token, {
        audience: 'payment',
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
}
