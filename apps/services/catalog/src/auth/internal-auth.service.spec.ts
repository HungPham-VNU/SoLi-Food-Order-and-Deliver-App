import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { signInternalJwt } from '@uitfood/contracts';
import type { Env } from '@/config/env.schema';
import { InternalAuthService } from './internal-auth.service';

/**
 * The InternalAuthService is the Catalog service's trust boundary: it only
 * accepts gateway-issued JWTs scoped to the `catalog` audience and signed with
 * the shared secret by a trusted issuer. Every mutating RPC handler depends on
 * it, so its accept/reject rules are pinned here.
 */
describe('InternalAuthService', () => {
  const SECRET = 'internal_auth_secret_for_local_dev_only_32_chars';
  const TRUSTED_ISSUERS = 'uitfood-gateway,uitfood-api';

  function makeService(
    overrides: Partial<Record<keyof Env, unknown>> = {},
  ): InternalAuthService {
    const values: Partial<Record<keyof Env, unknown>> = {
      INTERNAL_AUTH_JWT_SECRET: SECRET,
      INTERNAL_AUTH_TRUSTED_ISSUERS: TRUSTED_ISSUERS,
      ...overrides,
    };
    const config = {
      get: (key: keyof Env) => values[key],
    } as unknown as ConfigService<Env, true>;
    return new InternalAuthService(config);
  }

  function issue(
    options: {
      audience?: string;
      issuer?: string;
      subject?: string;
      roles?: string[];
      secret?: string;
    } = {},
  ): string {
    return signInternalJwt({
      issuer: options.issuer ?? 'uitfood-gateway',
      subject: options.subject ?? 'user-1',
      audience: options.audience ?? 'catalog',
      secret: options.secret ?? SECRET,
      correlationId: randomUUID(),
      roles: options.roles ?? ['customer'],
    });
  }

  it('accepts a gateway-issued catalog token and returns the caller', () => {
    const service = makeService();
    const caller = service.verifyCatalogToken(
      issue({ subject: 'user-42', roles: ['customer', 'restaurant_owner'] }),
    );

    expect(caller).toEqual({
      userId: 'user-42',
      roles: ['customer', 'restaurant_owner'],
      isAdmin: false,
    });
  });

  it('marks admin callers via the roles claim', () => {
    const service = makeService();
    const caller = service.verifyCatalogToken(issue({ roles: ['admin'] }));

    expect(caller.isAdmin).toBe(true);
  });

  it('rejects a token minted for another audience', () => {
    const service = makeService();
    expect(() =>
      service.verifyCatalogToken(issue({ audience: 'media' })),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a token from an untrusted issuer', () => {
    const service = makeService();
    expect(() =>
      service.verifyCatalogToken(issue({ issuer: 'attacker' })),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a token signed with the wrong secret', () => {
    const service = makeService();
    expect(() =>
      service.verifyCatalogToken(
        issue({ secret: 'a_different_secret_that_is_at_least_32_chars' }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a structurally malformed token', () => {
    const service = makeService();
    expect(() => service.verifyCatalogToken('not-a-jwt')).toThrow(
      UnauthorizedException,
    );
  });
});
