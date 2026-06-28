import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InternalJwtError,
  verifyInternalJwt,
  type InternalAuthClaims,
} from '@uitfood/contracts';
import type { Env } from '@/config/env.schema';

export interface PromotionCaller {
  userId: string;
  roles: string[];
  isAdmin: boolean;
}

/**
 * Verifies the internal JWT carried on the discount lifecycle RPCs (preview,
 * reserve, confirm, rollback). The gateway issues a user-scoped token for the
 * public preview; Ordering issues a service token for reserve/confirm/rollback.
 * Both carry `aud=promotion`.
 */
@Injectable()
export class InternalAuthService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  verifyPromotionToken(token: string): PromotionCaller {
    try {
      const claims: InternalAuthClaims = verifyInternalJwt(token, {
        audience: 'promotion',
        secret: this.config.get('INTERNAL_AUTH_JWT_SECRET', { infer: true }),
        issuers: this.config
          .get('INTERNAL_AUTH_TRUSTED_ISSUERS', { infer: true })
          .split(',')
          .map((issuer) => issuer.trim())
          .filter(Boolean),
      });
      const roles = claims.roles ?? [];
      return { userId: claims.sub, roles, isAdmin: roles.includes('admin') };
    } catch (error) {
      if (error instanceof InternalJwtError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }
}
