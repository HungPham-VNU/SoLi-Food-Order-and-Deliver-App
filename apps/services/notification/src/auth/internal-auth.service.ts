import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InternalJwtError, verifyInternalJwt } from '@uitfood/contracts';
import type { InternalAuthClaims } from '@uitfood/contracts';
import type { Env } from '@/config/env.schema';

@Injectable()
export class InternalAuthService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  verifyNotificationToken(token: string): InternalAuthClaims {
    try {
      return verifyInternalJwt(token, {
        audience: 'notification',
        secret: this.config.get('INTERNAL_AUTH_JWT_SECRET', { infer: true }),
        issuers: this.config
          .get('INTERNAL_AUTH_TRUSTED_ISSUERS', { infer: true })
          .split(',')
          .map((issuer) => issuer.trim())
          .filter(Boolean),
      });
    } catch (error) {
      if (error instanceof InternalJwtError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }
}
