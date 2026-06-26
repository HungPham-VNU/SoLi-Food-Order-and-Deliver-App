import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InternalJwtError,
  verifyInternalJwt,
  type InternalAuthClaims,
} from '@uitfood/contracts';
import type { Env } from '@/config/env.schema';

export interface ReviewCaller {
  userId: string;
  roles: string[];
}

@Injectable()
export class InternalAuthService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  verifyReviewToken(token: string): ReviewCaller {
    try {
      const claims: InternalAuthClaims = verifyInternalJwt(token, {
        audience: 'review',
        secret: this.config.get('INTERNAL_AUTH_JWT_SECRET', { infer: true }),
        issuers: this.config
          .get('INTERNAL_AUTH_TRUSTED_ISSUERS', { infer: true })
          .split(',')
          .map((issuer) => issuer.trim())
          .filter(Boolean),
      });
      return { userId: claims.sub, roles: claims.roles ?? [] };
    } catch (error) {
      if (error instanceof InternalJwtError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }
}
