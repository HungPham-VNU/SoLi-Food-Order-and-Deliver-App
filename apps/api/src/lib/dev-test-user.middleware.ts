import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import type { Env } from '@/config/env.schema';
import { isDevOrTestEnv } from './environment';

// Augment Express Request so req.user is typeable in dev/test middleware.
// Production code uses @Session() from @thallesp/nestjs-better-auth.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User {
      sub: string;
      email: string;
      roles: string[];
    }
    interface Request {
      user?: User;
    }
  }
}

/**
 * DEV / TEST ONLY — never use in production.
 *
 * Populates `req.user` so that `@CurrentUser()` works without a real JWT
 * when guards are disabled.
 *
 * Resolution order:
 *  1. `x-test-user-id` header  → uses that UUID as the identity
 *  2. No header                → falls back to the seeded owner UUID
 *                                 (11111111-1111-4111-8111-111111111111)
 *
 * The synthetic user always receives `['admin', 'restaurant']` roles so
 * all ownership and role checks pass during manual testing.
 */
const DEFAULT_TEST_USER_ID = '11111111-1111-4111-8111-111111111111';

@Injectable()
export class DevTestUserMiddleware implements NestMiddleware {
  private readonly logger = new Logger(DevTestUserMiddleware.name);

  /**
   * Resolved once at construction from NODE_ENV. Fail-closed: anything other
   * than 'development'/'test' (including production or a misconfigured env)
   * leaves the synthetic-auth bypass DISABLED.
   */
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.enabled = isDevOrTestEnv(this.config.get('NODE_ENV', { infer: true }));

    if (this.enabled) {
      this.logger.warn(
        'DevTestUserMiddleware is ENABLED — the x-test-user-id header will mint ' +
          'a synthetic admin/restaurant user without authentication. ' +
          'This MUST run only in development/test environments.',
      );
    }
  }

  use(req: Request, _res: Response, next: NextFunction): void {
    // Defense-in-depth: even if this middleware is somehow wired up outside
    // dev/test, never synthesize a privileged user. AppModule also refrains
    // from registering it in production (belt-and-suspenders).
    if (!this.enabled) {
      next();
      return;
    }

    const testUserId =
      (req.headers['x-test-user-id'] as string | undefined) ??
      DEFAULT_TEST_USER_ID;

    req.user = {
      sub: testUserId,
      email: `dev-${testUserId}@test.local`,
      roles: ['admin', 'restaurant'],
    };

    next();
  }
}
