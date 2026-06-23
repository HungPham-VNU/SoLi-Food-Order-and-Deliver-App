import { NotFoundException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { DevOnlyGuard } from './dev-only.guard';
import type { Env } from '@/config/env.schema';

/**
 * Phase 0: DevOnlyGuard must allow protected routes only in the dev/test
 * allowlist and otherwise throw NotFoundException (404, no existence leak).
 *
 * This complements the HTTP-level proof in
 * test/e2e/security-phase0.e2e-spec.ts (§A) with a fast deterministic check
 * across every NODE_ENV value.
 */

function makeConfig(nodeEnv: string | undefined): ConfigService<Env, true> {
  return {
    get: (key: string) => (key === 'NODE_ENV' ? nodeEnv : undefined),
  } as unknown as ConfigService<Env, true>;
}

function makeContext(): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method: 'POST', url: '/api/notifications/test/push' }),
    }),
  } as unknown as ExecutionContext;
}

describe('DevOnlyGuard', () => {
  it.each(['development', 'test'])(
    'allows the route when NODE_ENV=%s',
    (nodeEnv) => {
      const guard = new DevOnlyGuard(makeConfig(nodeEnv));
      expect(guard.canActivate(makeContext())).toBe(true);
    },
  );

  it.each(['production', 'staging', 'prod', '', undefined])(
    'throws NotFoundException (404) when NODE_ENV=%j',
    (nodeEnv) => {
      const guard = new DevOnlyGuard(makeConfig(nodeEnv));
      expect(() => guard.canActivate(makeContext())).toThrow(NotFoundException);
    },
  );
});
