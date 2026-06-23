import type { ConfigService } from '@nestjs/config';
import type { Request, Response, NextFunction } from 'express';
import { DevTestUserMiddleware } from './dev-test-user.middleware';
import type { Env } from '@/config/env.schema';

/**
 * Phase 0 fail-closed gate for the synthetic-auth middleware.
 *
 * The x-test-user-id header must mint a synthetic admin/restaurant user ONLY in
 * the dev/test allowlist. Any other NODE_ENV value (production, staging, unset,
 * typo) must leave req.user untouched — a misconfigured environment fails with
 * the bypass DISABLED, not ENABLED.
 *
 * Covers Phase 0 cases 3a (production: header does NOT mint a user) and
 * 3c (test: header still works for developer ergonomics).
 */

function makeConfig(nodeEnv: string | undefined): ConfigService<Env, true> {
  return {
    get: (key: string) => (key === 'NODE_ENV' ? nodeEnv : undefined),
  } as unknown as ConfigService<Env, true>;
}

function runMiddleware(
  nodeEnv: string | undefined,
  headers: Record<string, string> = {},
): { req: Request; nextCalled: boolean } {
  const middleware = new DevTestUserMiddleware(makeConfig(nodeEnv));
  const req = { headers } as unknown as Request;
  const res = {} as Response;
  let nextCalled = false;
  const next: NextFunction = () => {
    nextCalled = true;
  };

  middleware.use(req, res, next);
  return { req, nextCalled };
}

const TEST_HEADER = {
  'x-test-user-id': '22222222-2222-4222-8222-222222222222',
};

describe('DevTestUserMiddleware (fail-closed gate)', () => {
  describe('enabled environments (dev/test allowlist) — case 3c', () => {
    it.each(['development', 'test'])(
      'mints the synthetic user from x-test-user-id when NODE_ENV=%s',
      (nodeEnv) => {
        const { req, nextCalled } = runMiddleware(nodeEnv, TEST_HEADER);

        expect(nextCalled).toBe(true);
        expect(req.user).toEqual({
          sub: '22222222-2222-4222-8222-222222222222',
          email: 'dev-22222222-2222-4222-8222-222222222222@test.local',
          roles: ['admin', 'restaurant'],
        });
      },
    );

    it('falls back to the default seeded user id when the header is absent (NODE_ENV=development)', () => {
      const { req } = runMiddleware('development', {});
      expect(req.user?.sub).toBe('11111111-1111-4111-8111-111111111111');
      expect(req.user?.roles).toEqual(['admin', 'restaurant']);
    });
  });

  describe('disabled environments (fail-closed) — case 3a', () => {
    it.each(['production', 'staging', 'PRODUCTION', 'prod', ''])(
      'never sets req.user when NODE_ENV=%j, even with x-test-user-id',
      (nodeEnv) => {
        const { req, nextCalled } = runMiddleware(nodeEnv, TEST_HEADER);

        expect(nextCalled).toBe(true);
        expect(req.user).toBeUndefined();
      },
    );

    it('never sets req.user when NODE_ENV is unset (undefined)', () => {
      const { req, nextCalled } = runMiddleware(undefined, TEST_HEADER);

      expect(nextCalled).toBe(true);
      expect(req.user).toBeUndefined();
    });
  });
});
